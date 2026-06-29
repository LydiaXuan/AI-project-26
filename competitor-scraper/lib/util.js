// ================================================================
// util.js — 通用工具：解析输入、最大化分辨率、文件名清洗、并发下载
// ================================================================

/**
 * 从用户输入里解析出 Google Play 包名（appId）。
 * 支持以下几种写法：
 *   com.spotify.music
 *   https://play.google.com/store/apps/details?id=com.spotify.music&hl=en
 *   play.google.com/store/apps/details?id=com.spotify.music
 *   带任意多余空格 / 引号
 * 解析不出来返回 null。
 */
export function parseAppId(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/^["']|["']$/g, '');
  if (!s) return null;

  // 链接形式：取 id= 参数
  const m = s.match(/[?&]id=([^&\s]+)/);
  if (m) return decodeURIComponent(m[1]);

  // 没有协议但像个链接（含 details?id 但被截断）—— 上面已覆盖，这里兜底
  if (/play\.google\.com/.test(s)) {
    const m2 = s.match(/id=([A-Za-z0-9._]+)/);
    if (m2) return m2[1];
    return null;
  }

  // 裸包名：形如 com.xxx.yyy
  if (/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(s)) return s;

  return null;
}

/**
 * 把 googleusercontent 图片 URL 改写成尽可能高的分辨率。
 * 这类 URL 末尾常带尺寸参数，例如：
 *   .../xxxxx=w526-h296            （截图缩略）
 *   .../xxxxx=w240-h480-rw         （带圆角/裁切修饰）
 *   .../xxxxx=s180                 （图标）
 * 把这些参数统一替换为 =s0（原图）。=s0 对 Google 图床表示“原始尺寸”。
 */
export function maxRes(url) {
  if (!url || typeof url !== 'string') return url;
  if (!/googleusercontent\.com/.test(url)) return url;
  // 去掉末尾 = 之后的尺寸/修饰参数，换成 =s0
  return url.replace(/=[^=/]*$/, '=s0');
}

/** 把任意字符串清成安全文件名（保留中英文，去掉路径非法字符）。 */
export function safeName(s) {
  return String(s ?? '')
    .replace(/[\\/:*?"<>|]+/g, '_')   // 文件系统非法字符
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'untitled';
}

/** 根据图片 URL 猜后缀，猜不到给默认。 */
export function extFromUrl(url, fallback = '.jpg') {
  const m = String(url).match(/\.(png|jpe?g|webp|gif)(?:[?=].*)?$/i);
  if (m) return '.' + m[1].toLowerCase().replace('jpeg', 'jpg');
  // googleusercontent 一般不带扩展名，默认 jpg（Play 截图多为 jpg/webp）
  return fallback;
}

/** sleep 毫秒。 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 简单的并发池：对 items 逐个跑 worker(item, index)，最多 limit 个并发。
 * 返回每个任务的 {status, value|reason}（不会因单个失败整体中断）。
 */
export async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await worker(items[i], i) };
      } catch (e) {
        results[i] = { status: 'rejected', reason: e };
      }
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}
