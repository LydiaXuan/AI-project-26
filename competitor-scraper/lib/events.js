// ================================================================
// events.js — 抓「Events & offers / 活动与优惠」板块的活动横幅图
//
// google-play-scraper 的 app() 不返回这些图，需自己解析商店页 HTML。
// 经真实页面验证的规律（hl=en 下）：
//   每个活动卡片都有时间标记 "Ends in" / "Ends on"（也可能 "Starts ..."），
//   其后约 90~400 字符内的第一个 play-lh 图片 URL 就是该活动的横幅图，
//   顺序固定：[Ends 标记] → [图片URL] → [标题]。
// 因为标记是英文，这里强制用 hl=en 抓页面，保证锚点稳定。
// ================================================================
import got from 'got';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 每个活动卡片的时间标记（英文，hl=en）
const MARKERS = /(Ends in|Ends on|Starts in|Starts on)/g;
// 活动图链接（停在尺寸参数 = 之前，拿到不带尺寸的“裸” URL）
const IMG = /https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_\-]+/;
// 标记之后多大窗口内找图（字符数）
const WINDOW = 400;

/**
 * 抓某个 app 的活动图 URL（已补 =s0 取原图，已去重）。
 * @param {string} appId 包名
 * @param {object} [opts]
 * @param {string} [opts.country='us'] 商店地区（gl）
 * @param {import('http').Agent} [opts.agent] 代理 agent
 * @returns {Promise<{urls:string[], error?:string}>}
 */
export async function fetchEventImages(appId, { country = 'us', agent } = {}) {
  // 固定 hl=en —— 活动横幅图与语言无关，但时间标记需要英文才稳定
  const url =
    `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}` +
    `&hl=en&gl=${encodeURIComponent(country)}`;

  const options = {
    responseType: 'text',
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
    timeout: { request: 30000 },
    retry: { limit: 2 },
    followRedirect: true,
  };
  if (agent) options.agent = { https: agent, http: agent };

  let html;
  try {
    html = (await got(url, options)).body;
  } catch (e) {
    return { urls: [], error: e.message };
  }

  const urls = [];
  const seen = new Set();
  let m;
  MARKERS.lastIndex = 0;
  while ((m = MARKERS.exec(html)) !== null) {
    const slice = html.slice(m.index, m.index + WINDOW);
    const im = slice.match(IMG);
    if (im) {
      const base = im[0]; // 不含尺寸参数
      if (!seen.has(base)) {
        seen.add(base);
        urls.push(base + '=s0'); // 补成原图
      }
    }
  }
  return { urls };
}
