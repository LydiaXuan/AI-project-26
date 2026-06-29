#!/usr/bin/env node
// ================================================================
// scrape.js — Google Play 竞品商店素材扒取工具（命令行）
//
//   贴链接或包名 → 自动下载竞品商店页的全部图片素材：
//     · 手机/平板截图（screenshots）
//     · 特色大图 / 推广图（feature graphic）
//     · 应用图标（icon）
//     · 宣传视频缩略图（video thumbnail）
//
// 用法示例：
//   node scrape.js com.spotify.music
//   node scrape.js "https://play.google.com/store/apps/details?id=com.spotify.music"
//   node scrape.js --country tw --lang zh-TW com.spotify.music com.zhiliaoapp.musically
//   node scrape.js --file apps.txt --out ./竞品图
//
// 抓取结果会写到 <out>/<应用名__包名>/ 目录下，并附 metadata.json。
// ================================================================
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import gplayPkg from 'google-play-scraper';
import { parseAppId, maxRes, safeName, extFromUrl, pool } from './lib/util.js';
import { downloadTo } from './lib/download.js';

const gplay = gplayPkg.default || gplayPkg;

// ── 解析命令行参数 ───────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    country: 'us',
    lang: 'en',
    out: './output',
    concurrency: 5,
    file: null,
    skip: new Set(),        // 跳过的素材类型：screenshots|feature|icon|video
    inputs: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--country': case '-c': opts.country = argv[++i]; break;
      case '--lang':    case '-l': opts.lang = argv[++i]; break;
      case '--out':     case '-o': opts.out = argv[++i]; break;
      case '--concurrency': opts.concurrency = Math.max(1, parseInt(argv[++i], 10) || 5); break;
      case '--file':    case '-f': opts.file = argv[++i]; break;
      case '--no-screenshots': opts.skip.add('screenshots'); break;
      case '--no-feature':     opts.skip.add('feature'); break;
      case '--no-icon':        opts.skip.add('icon'); break;
      case '--no-video':       opts.skip.add('video'); break;
      case '--help': case '-h': opts.help = true; break;
      default:
        if (a.startsWith('-')) { console.warn(`⚠ 未知参数：${a}`); }
        else opts.inputs.push(a);
    }
  }
  return opts;
}

const HELP = `
Google Play 竞品商店素材扒取工具

用法：
  node scrape.js [选项] <链接或包名> [更多链接或包名...]

选项：
  -c, --country <码>   商店地区，默认 us（如 tw / hk / jp / kr）
  -l, --lang    <码>   语言，默认 en（如 zh-TW / zh-CN / ja）
  -o, --out     <目录> 输出目录，默认 ./output
  -f, --file    <文件> 从文本文件读取，每行一个链接/包名（# 开头为注释）
      --concurrency <n> 单个应用内图片并发下载数，默认 5
      --no-screenshots  不抓截图
      --no-feature      不抓特色大图/推广图
      --no-icon         不抓图标
      --no-video        不抓视频缩略图
  -h, --help            显示帮助

示例：
  node scrape.js com.spotify.music
  node scrape.js -c tw -l zh-TW com.spotify.music com.zhiliaoapp.musically
  node scrape.js --file apps.txt --out ./竞品图
`;

// ── 从文件 / 参数收集输入，去重解析成 appId ─────────────────────
async function collectAppIds(opts) {
  let raw = [...opts.inputs];
  if (opts.file) {
    const text = await readFile(opts.file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t && !t.startsWith('#')) raw.push(t);
    }
  }
  const seen = new Set();
  const ids = [];
  const bad = [];
  for (const r of raw) {
    const id = parseAppId(r);
    if (!id) { bad.push(r); continue; }
    if (!seen.has(id)) { seen.add(id); ids.push(id); }
  }
  return { ids, bad };
}

// ── 把一个 app 数据对象转成待下载素材清单 ───────────────────────
function buildAssets(app, skip) {
  const assets = [];
  if (!skip.has('icon') && app.icon)
    assets.push({ url: maxRes(app.icon), name: 'icon' + extFromUrl(app.icon, '.png'), label: '图标' });
  if (!skip.has('feature') && app.headerImage)
    assets.push({ url: maxRes(app.headerImage), name: 'feature' + extFromUrl(app.headerImage), label: '特色大图' });
  if (!skip.has('video') && app.videoImage)
    assets.push({ url: maxRes(app.videoImage), name: 'video-thumb' + extFromUrl(app.videoImage), label: '视频缩略图' });
  if (!skip.has('screenshots') && Array.isArray(app.screenshots)) {
    const pad = String(app.screenshots.length).length;
    app.screenshots.forEach((url, i) => {
      const n = String(i + 1).padStart(Math.max(2, pad), '0');
      assets.push({
        url: maxRes(url),
        name: join('screenshots', `${n}${extFromUrl(url)}`),
        label: `截图${n}`,
      });
    });
  }
  return assets;
}

// ── 处理单个 app ────────────────────────────────────────────────
async function processApp(appId, opts) {
  process.stdout.write(`\n📦 ${appId} … 拉取商店信息`);
  let app;
  try {
    app = await gplay.app({ appId, country: opts.country, lang: opts.lang });
  } catch (e) {
    console.log(`  ✗ 失败：${e.message}`);
    return { appId, ok: false, error: e.message };
  }
  const dir = join(opts.out, `${safeName(app.title)}__${appId}`);
  const assets = buildAssets(app, opts.skip);
  console.log(`  → ${app.title}（${app.developer?.devId || app.developer || '?'}），共 ${assets.length} 张`);

  await mkdir(dir, { recursive: true });

  const results = await pool(assets, opts.concurrency, async (asset) => {
    const bytes = await downloadTo(asset.url, join(dir, asset.name));
    return bytes;
  });

  let okCount = 0;
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { okCount++; }
    else failed.push({ name: assets[i].name, error: r.reason?.message || String(r.reason) });
  });

  // 写元数据，方便对照
  const meta = {
    appId,
    title: app.title,
    developer: app.developer?.devId || app.developer || null,
    url: app.url,
    score: app.score,
    country: opts.country,
    lang: opts.lang,
    scrapedAt: new Date().toISOString(),
    counts: {
      screenshots: Array.isArray(app.screenshots) ? app.screenshots.length : 0,
      feature: app.headerImage ? 1 : 0,
      icon: app.icon ? 1 : 0,
      videoThumb: app.videoImage ? 1 : 0,
    },
    sources: {
      icon: app.icon || null,
      headerImage: app.headerImage || null,
      videoImage: app.videoImage || null,
      video: app.video || null,
      screenshots: app.screenshots || [],
    },
    downloadedTo: dir,
    failed,
  };
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log(`  ✓ 完成：${okCount}/${assets.length} 张 → ${dir}`);
  if (failed.length) console.log(`    ⚠ ${failed.length} 张失败（详见 metadata.json）`);
  return { appId, ok: true, title: app.title, total: assets.length, okCount, failed: failed.length, dir };
}

// ── 主流程 ──────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (opts.inputs.length === 0 && !opts.file)) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 1);
  }

  const { ids, bad } = await collectAppIds(opts);
  if (bad.length) console.warn(`⚠ 无法识别（已跳过）：\n   ${bad.join('\n   ')}`);
  if (ids.length === 0) {
    console.error('✗ 没有有效的链接 / 包名。用 --help 看示例。');
    process.exit(1);
  }

  console.log(`开始抓取 ${ids.length} 个应用｜地区=${opts.country} 语言=${opts.lang} 输出=${opts.out}`);

  const summary = [];
  for (const id of ids) {        // 应用之间串行，避免请求过密被限流
    summary.push(await processApp(id, opts));
  }

  console.log('\n──────── 汇总 ────────');
  for (const s of summary) {
    if (!s.ok) console.log(`✗ ${s.appId}：${s.error}`);
    else console.log(`✓ ${s.title}：${s.okCount}/${s.total} 张${s.failed ? `（${s.failed} 失败）` : ''}`);
  }
  const failedApps = summary.filter((s) => !s.ok).length;
  process.exit(failedApps ? 2 : 0);
}

main().catch((e) => {
  console.error('未捕获错误：', e);
  process.exit(1);
});
