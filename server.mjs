import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 5173;
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

const API_URL = process.env.AI_API_URL || '';
const API_KEY = process.env.AI_API_KEY || '';
const API_MODEL = process.env.AI_MODEL || '';
const isConfigured = () => Boolean(API_URL && API_KEY && API_MODEL);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
      raw += chunk;
    });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('请求体不是合法 JSON')); } });
    req.on('error', reject);
  });
}

// Extract the first JSON object/array found in a model response, tolerating
// code fences and surrounding prose that some models add.
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try { return JSON.parse(candidate.trim()); } catch { /* fall through */ }
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const open = candidate[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) { depth -= 1; if (depth === 0) { try { return JSON.parse(candidate.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

async function callModel(messages, { temperature = 0.2, maxTokens = 1500 } = {}) {
  if (!isConfigured()) throw new Error('AI 服务未配置，请设置 AI_API_URL、AI_API_KEY 和 AI_MODEL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: API_MODEL, messages, temperature, max_tokens: maxTokens }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || `${response.status} ${response.statusText}`;
      throw new Error(`AI 接口返回错误：${detail}`);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 接口未返回内容');
    return content;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('AI 接口请求超时，请稍后重试');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Free Google Translate endpoint (en -> zh-CN). No API key required.
async function googleTranslate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`谷歌翻译返回 ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.[0]) ? data[0].map((seg) => seg?.[0] || '').join('').trim() : '';
  } finally {
    clearTimeout(timer);
  }
}

async function handleTranslate(req, res) {
  const body = await readBody(req);
  const keywords = Array.isArray(body.keywords) ? body.keywords.map((word) => String(word || '').trim()).filter(Boolean) : [];
  if (!keywords.length) { sendJson(res, 400, { error: '缺少需要翻译的关键词' }); return; }
  const unique = [...new Set(keywords)];
  const translations = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < unique.length) {
      const word = unique[cursor];
      cursor += 1;
      try { const value = await googleTranslate(word); if (value) translations[word] = value; } catch (error) { console.error('translate failed:', word, error.message); }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(5, unique.length) }, worker));
    sendJson(res, 200, { translations });
  } catch (error) {
    sendJson(res, 502, { error: error.message || '翻译失败' });
  }
}

async function handleAnalyze(req, res) {
  const body = await readBody(req);
  const title = String(body.title || '').trim();
  const subtitle = String(body.subtitle || '').trim();
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 300) : [];
  if (!rows.length) { sendJson(res, 400, { error: '没有可分析的关键词数据' }); return; }
  const table = rows
    .map((row) => `${row.keyword} | 排名:${row.rank ?? 0} 搜索指数:${row.searchIndex ?? 0} 流行度:${row.popularity ?? 0} 搜索结果数:${row.results ?? 0} 安装量:${row.installs ?? 0}`)
    .join('\n');
  const messages = [
    { role: 'system', content: '你是资深 iOS App Store ASO 关键词策略专家，熟悉苹果 100 字符关键词字段规则。' },
    { role: 'user', content: `App 主标题：${title || '（未填写）'}\nApp 副标题：${subtitle || '（未填写）'}\n\n下面是候选关键词及其指标（搜索指数与流行度越高越好，排名越靠前越好，搜索结果数越少竞争越小，安装量越高越好）：\n${table}\n\n请分析后只返回一个 JSON 对象，结构如下（不要有多余文字）：\n{\n  "summary": "一句话总体结论",\n  "highFrequencyWords": ["高频核心词"],\n  "asoWords": ["值得布局的 ASO 词"],\n  "goodWords": ["推荐优先使用的关键词"],\n  "combinations": ["建议的关键词组合"],\n  "keywordField": "建议填入 iOS 100 字符字段的关键词串，用英文逗号分隔且不加空格，不超过 100 字符，且不包含标题或副标题里已出现的词"\n}` },
  ];
  try {
    const content = await callModel(messages, { temperature: 0.3, maxTokens: 1600 });
    const parsed = extractJson(content);
    if (!parsed) { sendJson(res, 502, { error: 'AI 返回内容无法解析为 JSON' }); return; }
    const toList = (value) => (Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []);
    const analysis = {
      summary: String(parsed.summary || 'AI 分析完成').trim(),
      highFrequencyWords: toList(parsed.highFrequencyWords),
      asoWords: toList(parsed.asoWords),
      goodWords: toList(parsed.goodWords),
      combinations: toList(parsed.combinations),
      keywordField: String(parsed.keywordField || '').trim(),
    };
    sendJson(res, 200, { analysis });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function serveStatic(req, res) {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const target = normalize(join(PUBLIC_DIR, relative));
  if (!target.startsWith(PUBLIC_DIR.replace(new RegExp(`${sep}$`), '') + sep) && target !== PUBLIC_DIR.replace(new RegExp(`${sep}$`), '')) {
    sendJson(res, 403, { error: '禁止访问' });
    return;
  }
  try {
    const file = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = (req.url || '/').split('?')[0];
    if (url === '/api/status' && req.method === 'GET') { sendJson(res, 200, { configured: isConfigured(), model: isConfigured() ? API_MODEL : null }); return; }
    if (url === '/api/translate' && req.method === 'POST') { await handleTranslate(req, res); return; }
    if (url === '/api/ai-analyze' && req.method === 'POST') { await handleAnalyze(req, res); return; }
    if (url.startsWith('/api/')) { sendJson(res, 404, { error: '未知的接口' }); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { sendJson(res, 405, { error: '方法不被允许' }); return; }
    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 400, { error: error.message || '请求处理失败' });
  }
});

server.listen(PORT, () => {
  console.log(`iOS 关键词库已启动：http://localhost:${PORT}`);
  console.log(isConfigured() ? `AI 接口已配置，模型：${API_MODEL}` : 'AI 接口未配置（AI 翻译 / AI 分析将不可用）。请复制 ai-api.local.bat.example 为 ai-api.local.bat 并填写后再启动。');
});
