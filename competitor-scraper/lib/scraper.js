// ================================================================
// scraper.js — 共享抓取核心：给个 appId，返回分类好的素材 URL
//   命令行工具和网页服务都用它，避免重复逻辑。
//   素材类型：icon / feature(置顶大图) / video(视频缩略) / screenshot(五图) / event(活动图)
// ================================================================
import gplayPkg from 'google-play-scraper';
import { fetchEventImages } from './events.js';
import { maxRes } from './util.js';

const gplay = gplayPkg.default || gplayPkg;

/**
 * 抓取单个应用的全部素材 URL（已最大化分辨率）。
 * @param {string} appId
 * @param {object} [opts]
 * @param {string} [opts.country='us']
 * @param {string} [opts.lang='en']
 * @param {import('http').Agent} [opts.agent] 代理
 * @param {boolean} [opts.skipEvents=false]
 */
export async function scrapeApp(appId, { country = 'us', lang = 'en', agent, skipEvents = false } = {}) {
  const requestOptions = agent ? { agent: { https: agent, http: agent } } : undefined;
  const app = await gplay.app({ appId, country, lang, requestOptions });

  const assets = [];
  if (app.icon) assets.push({ type: 'icon', url: maxRes(app.icon) });
  if (app.headerImage) assets.push({ type: 'feature', url: maxRes(app.headerImage) });
  if (app.videoImage) assets.push({ type: 'video', url: maxRes(app.videoImage) });
  for (const u of app.screenshots || []) assets.push({ type: 'screenshot', url: maxRes(u) });

  let eventError = null;
  if (!skipEvents) {
    const ev = await fetchEventImages(appId, { country, agent });
    eventError = ev.error || null;
    for (const u of ev.urls || []) assets.push({ type: 'event', url: u }); // 已带 =s0
  }

  return {
    appId,
    title: app.title,
    developer: app.developer?.devId || app.developer || null,
    url: app.url,
    score: app.score ?? null,
    iconUrl: app.icon || null,
    videoUrl: app.video || null,
    assets,
    eventError,
  };
}
