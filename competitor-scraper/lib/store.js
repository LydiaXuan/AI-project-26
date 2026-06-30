// ================================================================
// store.js — 本地数据层（竞品清单 + 版本化快照 + 变更比对）
//
// 目录结构：
//   data/
//     competitors.json          竞品清单 [{id,appId,url,name,country,lang,addedAt}]
//     apps/<appId>/
//       meta.json               应用信息（标题/开发者/评分/最近抓取…）
//       assets/<assetId>.<ext>  去重图片池（同一张图只存一份）
//       snapshots.json          历次快照 [{scrapedAt, items:[{type,assetId,ext,url}]}]
//
// 每次抓取 = 比对上一份快照，得出“新增/移除”= 变更记录。
// 图片按 googleusercontent 的稳定 ID 去重，没变就不重复下、不重复存。
// ================================================================
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import got from 'got';
import { parseAppId } from './util.js';
import { assetIdFromUrl } from './assetid.js';
import { scrapeApp } from './scraper.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const APPS = join(DATA, 'apps');
const LIST = join(DATA, 'competitors.json');

export const ASSET_TYPES = ['screenshot', 'feature', 'icon', 'video', 'event'];
export const TYPE_LABEL = {
  screenshot: '五图', feature: '置顶大图', icon: 'icon', video: '视频', event: '活动图',
};

// ── 小工具 ──────────────────────────────────────────────────────
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}
async function writeJson(file, obj) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}
const appDir = (appId) => join(APPS, appId);
const slugId = (appId) => appId.replace(/[^\w.-]/g, '_');

// ── 竞品清单 ────────────────────────────────────────────────────
export async function listCompetitors() {
  return await readJson(LIST, []);
}

export async function addCompetitor(link, { country = 'us', lang = 'en', name = null } = {}) {
  const appId = parseAppId(link);
  if (!appId) throw new Error(`无法识别链接/包名：${link}`);
  const all = await readJson(LIST, []);
  if (all.some((c) => c.appId === appId)) {
    return { appId, already: true };
  }
  const entry = {
    id: slugId(appId),
    appId,
    url: `https://play.google.com/store/apps/details?id=${appId}`,
    name: name || appId,
    country, lang,
    addedAt: new Date().toISOString(),
  };
  all.push(entry);
  await writeJson(LIST, all);
  return { appId, already: false, entry };
}

export async function removeCompetitor(appId) {
  const all = await readJson(LIST, []);
  const next = all.filter((c) => c.appId !== appId);
  await writeJson(LIST, next);
  return all.length !== next.length;
}

// ── 抓取 + 快照 + 比对 ──────────────────────────────────────────
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function extFromContentType(ct) {
  if (!ct) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  return '.jpg';
}

// 下载到去重池，返回 {assetId, ext}。已存在则跳过下载。
async function downloadAsset(appId, url, agent) {
  const assetId = assetIdFromUrl(url);
  if (!assetId) throw new Error('无法解析素材 ID: ' + url);
  const dir = join(appDir(appId), 'assets');
  await mkdir(dir, { recursive: true });
  // 已存在（任意扩展名）则复用
  const files = existsSync(dir) ? await readdir(dir) : [];
  const hit = files.find((f) => f.startsWith(assetId + '.'));
  if (hit) return { assetId, ext: hit.slice(assetId.length) };

  const options = {
    responseType: 'buffer',
    headers: { 'user-agent': UA, accept: 'image/*,*/*' },
    timeout: { request: 30000 },
    retry: { limit: 2 },
    followRedirect: true,
  };
  if (agent) options.agent = { https: agent, http: agent };
  const res = await got(url, options);
  const ext = extFromContentType(res.headers['content-type']);
  await writeFile(join(dir, assetId + ext), res.body);
  return { assetId, ext };
}

/**
 * 抓取某竞品并写入一份新快照，返回本次变更。
 * @param {string} appId
 * @param {object} [opts]
 * @param {import('http').Agent} [opts.agent]
 * @param {Function} [opts.scrapeFn] 可注入（测试用），默认真实 scrapeApp
 */
export async function scrapeAndSnapshot(appId, { agent, scrapeFn = scrapeApp } = {}) {
  const list = await readJson(LIST, []);
  const entry = list.find((c) => c.appId === appId) || { appId, country: 'us', lang: 'en' };

  const res = await scrapeFn(appId, { country: entry.country, lang: entry.lang, agent });

  // 下载所有素材到去重池（并发受限简单串行/小并发）
  const items = [];
  for (const a of res.assets) {
    try {
      const { assetId, ext } = await downloadAsset(appId, a.url, agent);
      items.push({ type: a.type, assetId, ext, url: a.url });
    } catch (e) {
      // 单张失败不阻断
      items.push({ type: a.type, assetId: assetIdFromUrl(a.url), ext: null, url: a.url, error: e.message });
    }
  }

  const dir = appDir(appId);
  const snapshots = await readJson(join(dir, 'snapshots.json'), []);
  const prev = snapshots[snapshots.length - 1] || null;
  const scrapedAt = new Date().toISOString();
  const snapshot = { scrapedAt, items };

  // 比对：按 assetId 求新增/移除
  const prevIds = new Set((prev?.items || []).map((i) => i.assetId));
  const curIds = new Set(items.map((i) => i.assetId));
  const added = items.filter((i) => !prevIds.has(i.assetId));
  const removed = (prev?.items || []).filter((i) => !curIds.has(i.assetId));
  const isFirst = !prev;
  const changed = !isFirst && (added.length > 0 || removed.length > 0);

  snapshots.push(snapshot);
  await writeJson(join(dir, 'snapshots.json'), snapshots);

  // 更新名字（首次用真实标题回填清单）
  if (entry && (entry.name === entry.appId || !entry.name) && res.title) {
    entry.name = res.title;
    const idx = list.findIndex((c) => c.appId === appId);
    if (idx >= 0) { list[idx] = entry; await writeJson(LIST, list); }
  }

  await writeJson(join(dir, 'meta.json'), {
    appId,
    title: res.title,
    developer: res.developer,
    url: res.url,
    score: res.score,
    iconUrl: res.iconUrl,
    videoUrl: res.videoUrl,
    lastScrapeAt: scrapedAt,
    lastChangeAt: changed ? scrapedAt : (await readJson(join(dir, 'meta.json'), {})).lastChangeAt || (isFirst ? scrapedAt : null),
    eventError: res.eventError || null,
  });

  return { appId, isFirst, changed, addedCount: added.length, removedCount: removed.length, total: items.length };
}

// ── 读取：列表摘要 / 详情 ───────────────────────────────────────
function countByType(items) {
  const c = {};
  for (const t of ASSET_TYPES) c[t] = 0;
  for (const i of items || []) if (c[i.type] !== undefined) c[i.type]++;
  return c;
}

export async function getSummary() {
  const list = await readJson(LIST, []);
  const out = [];
  for (const c of list) {
    const dir = appDir(c.appId);
    const meta = await readJson(join(dir, 'meta.json'), null);
    const snaps = await readJson(join(dir, 'snapshots.json'), []);
    const latest = snaps[snaps.length - 1] || null;
    const prev = snaps[snaps.length - 2] || null;
    let hasUpdate = false;
    if (latest && prev) {
      const prevIds = new Set(prev.items.map((i) => i.assetId));
      hasUpdate = latest.items.some((i) => !prevIds.has(i.assetId)) ||
        prev.items.some((i) => !new Set(latest.items.map((x) => x.assetId)).has(i.assetId));
    }
    out.push({
      appId: c.appId,
      name: meta?.title || c.name || c.appId,
      developer: meta?.developer || null,
      url: c.url,
      lastScrapeAt: meta?.lastScrapeAt || null,
      lastChangeAt: meta?.lastChangeAt || null,
      counts: countByType(latest?.items),
      total: latest?.items.length || 0,
      hasUpdate,
      scraped: !!latest,
    });
  }
  return out;
}

// 把一个 item 转成可被前端访问的图片地址
function itemView(appId, i) {
  return {
    type: i.type,
    assetId: i.assetId,
    src: i.ext ? `/asset/${encodeURIComponent(appId)}/${i.assetId}${i.ext}` : null,
    url: i.url,
  };
}

export async function getDetail(appId) {
  const dir = appDir(appId);
  const meta = await readJson(join(dir, 'meta.json'), null);
  const snaps = await readJson(join(dir, 'snapshots.json'), []);
  const latest = snaps[snaps.length - 1] || null;

  // 当前素材按类型分组
  const current = {};
  for (const t of ASSET_TYPES) current[t] = [];
  for (const i of latest?.items || []) {
    if (current[i.type]) current[i.type].push(itemView(appId, i));
  }

  // 变更记录：逐对相邻快照比对
  const changes = [];
  for (let k = 1; k < snaps.length; k++) {
    const a = snaps[k - 1], b = snaps[k];
    const aIds = new Set(a.items.map((i) => i.assetId));
    const bIds = new Set(b.items.map((i) => i.assetId));
    const added = b.items.filter((i) => !aIds.has(i.assetId));
    const removed = a.items.filter((i) => !bIds.has(i.assetId));
    if (added.length || removed.length) {
      changes.push({
        at: b.scrapedAt,
        added: added.map((i) => itemView(appId, i)),
        removed: removed.map((i) => itemView(appId, i)),
      });
    }
  }
  changes.reverse(); // 最新在前

  return {
    appId,
    title: meta?.title || appId,
    developer: meta?.developer || null,
    url: meta?.url || `https://play.google.com/store/apps/details?id=${appId}`,
    score: meta?.score ?? null,
    lastScrapeAt: meta?.lastScrapeAt || null,
    lastChangeAt: meta?.lastChangeAt || null,
    snapshotCount: snaps.length,
    firstScrapeAt: snaps[0]?.scrapedAt || null,
    counts: countByType(latest?.items),
    current,
    changes,
    eventError: meta?.eventError || null,
  };
}

export { DATA, appDir };
