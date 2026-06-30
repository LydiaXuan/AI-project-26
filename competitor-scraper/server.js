#!/usr/bin/env node
// ================================================================
// server.js — 竞品素材监控 · 本地网页看板
//   浏览器打开 http://localhost:8787
//   · 列表页：竞品卡片 + 有更新标记
//   · 详情页：按类型筛选（五图/置顶大图/icon/视频/活动图）+ 变更时间线
//   · 可在网页里添加竞品、点“抓取”（走 Karing 代理）
// 启动：node server.js  [--port 8787] [--proxy http://127.0.0.1:3067]
// ================================================================
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProxy } from './lib/proxy.js';
import {
  listCompetitors, addCompetitor, removeCompetitor,
  getSummary, getDetail, scrapeAndSnapshot, appDir, TYPE_LABEL,
} from './lib/store.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WEB = join(ROOT, 'web');

// ── 参数 ────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, def) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; }
const PORT = parseInt(arg('--port', process.env.PORT || '8787'), 10);
let proxy = null;
try { proxy = resolveProxy(arg('--proxy', null)); } catch (e) { console.error(e.message); }
const AGENT = proxy?.agent || null;
console.log(`代理：${proxy ? proxy.proxyUrl : '直连（未设代理，抓取可能超时）'}`);

// 正在抓取的集合（避免重复并发）+ 简单状态
const scraping = new Set();

// ── 工具 ────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
      try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); }
    });
  });
}
async function serveFile(res, file) {
  if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  const buf = await readFile(file);
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(buf);
}

// ── 路由 ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const path = decodeURIComponent(u.pathname);
  try {
    // 静态首页
    if (path === '/' || path === '/index.html') return serveFile(res, join(WEB, 'index.html'));
    if (path === '/styles.css') return serveFile(res, join(WEB, 'styles.css'));
    if (path === '/app.js') return serveFile(res, join(WEB, 'app.js'));

    // 图片：/asset/<appId>/<file>
    if (path.startsWith('/asset/')) {
      const rest = path.slice('/asset/'.length);
      const slash = rest.indexOf('/');
      const appId = rest.slice(0, slash);
      const file = rest.slice(slash + 1);
      if (file.includes('..') || appId.includes('..')) { res.writeHead(400); return res.end('bad'); }
      return serveFile(res, join(appDir(appId), 'assets', file));
    }

    // API
    if (path === '/api/meta') {
      return sendJson(res, 200, { typeLabel: TYPE_LABEL, proxy: proxy?.proxyUrl || null });
    }
    if (path === '/api/competitors' && req.method === 'GET') {
      return sendJson(res, 200, await getSummary());
    }
    if (path === '/api/competitors' && req.method === 'POST') {
      const { link, links } = await readBody(req);
      const arr = links || (link ? [link] : []);
      const results = [];
      for (const l of arr) {
        try { results.push({ link: l, ...(await addCompetitor(l)) }); }
        catch (e) { results.push({ link: l, error: e.message }); }
      }
      return sendJson(res, 200, { results });
    }
    if (path.startsWith('/api/competitor/') && req.method === 'DELETE') {
      const appId = path.slice('/api/competitor/'.length);
      return sendJson(res, 200, { removed: await removeCompetitor(appId) });
    }
    if (path.startsWith('/api/competitor/') && req.method === 'GET') {
      const appId = path.slice('/api/competitor/'.length);
      return sendJson(res, 200, await getDetail(appId));
    }
    if (path === '/api/scrape' && req.method === 'POST') {
      const { appId } = await readBody(req);
      const targets = appId ? [appId] : (await listCompetitors()).map((c) => c.appId);
      const results = [];
      for (const id of targets) {
        if (scraping.has(id)) { results.push({ appId: id, skipped: '正在抓取中' }); continue; }
        scraping.add(id);
        try { results.push(await scrapeAndSnapshot(id, { agent: AGENT })); }
        catch (e) { results.push({ appId: id, error: e.message }); }
        finally { scraping.delete(id); }
      }
      return sendJson(res, 200, { results });
    }

    res.writeHead(404); res.end('not found');
  } catch (e) {
    console.error('请求出错:', e);
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n看板已启动 →  http://localhost:${PORT}\n（浏览器打开上面地址；Ctrl+C 退出）`);
});
