// ================================================================
// download.js — 带重试/退避的图片下载（用 got，支持代理 agent）
// ================================================================
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import got from 'got';
import { sleep } from './util.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * 下载一个 URL 到 destPath，失败按 2/4/8s 退避重试。
 * @param {object} [opts]
 * @param {import('http').Agent} [opts.agent] 代理 agent（https-proxy-agent）
 * @param {number} [opts.retries=3]
 * @returns {Promise<number>} 写入的字节数
 */
export async function downloadTo(url, destPath, { agent, retries = 3 } = {}) {
  const options = {
    responseType: 'buffer',
    headers: { 'user-agent': UA, accept: 'image/*,*/*' },
    timeout: { request: 30000 },
    retry: { limit: 0 },          // 自己控制重试，关掉 got 内置的
    followRedirect: true,
  };
  if (agent) options.agent = { https: agent, http: agent };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await got(url, options);
      const buf = res.body;
      if (!buf || buf.length === 0) throw new Error('empty body');
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, buf);
      return buf.length;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(2000 * Math.pow(2, attempt)); // 2s,4s,8s
    }
  }
  throw lastErr;
}
