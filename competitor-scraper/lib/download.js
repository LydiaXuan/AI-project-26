// ================================================================
// download.js — 带重试/退避的图片下载（用 Node 内置 fetch）
// ================================================================
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sleep } from './util.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * 下载一个 URL 到 destPath，失败按 2/4/8s 退避重试。
 * 返回写入的字节数。
 */
export async function downloadTo(url, destPath, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('empty body');
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
