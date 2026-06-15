// 飞书 Open API 封装：换 token / 上传图片 / 列群 / 发消息。零依赖，Node18+ 全局 fetch。
import { config } from './config.js';

const RETRIES = 3;
const BACKOFF = [5000, 15000, 45000]; // 网络抖动重试间隔

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < RETRIES) {
        console.warn(`  [${label}] 失败，${BACKOFF[i] / 1000}s 后重试：${e.message}`);
        await sleep(BACKOFF[i]);
      }
    }
  }
  throw lastErr;
}

let _token = null, _tokenExp = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const data = await withRetry(async () => {
    const res = await fetch(`${config.domain}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    });
    const j = await res.json();
    if (j.code !== 0) throw new Error(`换 token 失败 code=${j.code} ${j.msg}`);
    return j;
  }, 'token');
  _token = data.tenant_access_token;
  _tokenExp = Date.now() + (data.expire - 120) * 1000; // 提前 2 分钟过期
  return _token;
}

// 上传图片，返回 image_key。input 为 Buffer。
export async function uploadImage(buffer) {
  const token = await getToken();
  return withRetry(async () => {
    const form = new FormData();
    form.append('image_type', 'message');
    form.append('image', new Blob([buffer]), 'icon.jpg');
    const res = await fetch(`${config.domain}/open-apis/im/v1/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const j = await res.json();
    if (j.code !== 0) throw new Error(`上传图片失败 code=${j.code} ${j.msg}`);
    return j.data.image_key;
  }, 'upload');
}

// 列出机器人所在的群（找 chat_id 用）
export async function listChats() {
  const token = await getToken();
  const out = [];
  let pageToken = '';
  do {
    const url = new URL(`${config.domain}/open-apis/im/v1/chats`);
    url.searchParams.set('page_size', '100');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (j.code !== 0) throw new Error(`列群失败 code=${j.code} ${j.msg}`);
    out.push(...(j.data.items || []));
    pageToken = j.data.has_more ? j.data.page_token : '';
  } while (pageToken);
  return out;
}

// 发一条消息到群。msgType: 'interactive' | 'image' | 'text'
export async function sendMessage(chatId, msgType, content) {
  const token = await getToken();
  return withRetry(async () => {
    const url = new URL(`${config.domain}/open-apis/im/v1/messages`);
    url.searchParams.set('receive_id_type', 'chat_id');
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ receive_id: chatId, msg_type: msgType, content: JSON.stringify(content) }),
    });
    const j = await res.json();
    if (j.code !== 0) throw new Error(`发消息失败 code=${j.code} ${j.msg}`);
    return j.data;
  }, 'send');
}
