#!/usr/bin/env node
// 图测工具采用素材 → 飞书群推送 CLI
//   node src/index.js --list-chats   列出机器人所在群，拿 chat_id
//   node src/index.js --once         发送「自上次以来新采用」的素材（默认，首次只记账不发）
//   node src/index.js --test         挑历史里最新一条采用素材发一次，看效果（不写状态、不影响正式逻辑）
//   node src/index.js --seed         把现有所有 adopted 标为已发，下次起只发新增（首次部署用）
//   node src/index.js --all          忽略历史，把所有 adopted 都发一遍（慎用，会刷屏）
//   node src/index.js --dry-run      预演，不真正发送
import { config, assertConfig } from './config.js';
import { collectAdoptedMaterials } from './reader.js';
import { loadState, saveState } from './state.js';
import { buildCard } from './card.js';
import { listChats, uploadImage, sendMessage } from './feishu.js';

const args = new Set(process.argv.slice(2));
const has = (f) => args.has(f);

// 两个推送模块：各取各的正文，发给各自的群。配了群的模块才启用。
const MODULES = [
  { name: 'buying', label: '同步买量', chats: () => config.chatIdsBuying },
  { name: 'review', label: '复盘总结', chats: () => config.chatIdsReview },
];
const activeModules = () => MODULES.filter((mod) => mod.chats().length > 0);

function dataUrlToBuffer(dataUrl) {
  const m = /^data:.*?;base64,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  return Buffer.from(m[1], 'base64');
}

// 给日志用：素材形态的简短描述
function mediaSummary(m) {
  const parts = [];
  if (m.videoUrl) parts.push('视频');
  if (m.img) parts.push('图');
  return parts.length ? parts.join('+') : '无素材';
}

// 没配任何群就报错退出
function assertHasChats() {
  if (!activeModules().length) {
    console.error('未配置任何推送群。请在 .env 填 FEISHU_CHAT_ID_BUYING / FEISHU_CHAT_ID_REVIEW（或旧版 FEISHU_CHAT_ID）。');
    process.exit(1);
  }
}

async function cmdListChats() {
  assertConfig(['appId', 'appSecret']);
  const chats = await listChats();
  if (!chats.length) {
    console.log('机器人还没在任何群里。请先把应用对应的机器人拉进目标群，再重试。');
    return;
  }
  console.log('机器人所在的群（把目标群的 chat_id 填到 .env 的对应变量）：\n');
  for (const c of chats) {
    console.log(`  ${c.name || '(无名群)'}\n    chat_id = ${c.chat_id}\n`);
  }
}

// 预览模式：挑一条采用素材，按启用的模块各发一张卡，看消息长什么样。
// 完全不写状态文件，不影响 --once 的「首次记账」行为。
async function cmdTest({ dryRun }) {
  assertConfig(['dataDir']);
  const materials = collectAdoptedMaterials(config.dataDir);
  if (!materials.length) {
    console.log('没有找到任何 adopted 素材。请先在图测工具里把某个变体标为「采用」后重试。');
    return;
  }
  materials.sort((a, b) => (b.adoptedTime || 0) - (a.adoptedTime || 0));
  const m = materials[0];
  const when = m.endDate || m.startDate || '(无日期)';
  console.log(`【试发】挑选最新采用：${m.project} / ${m.variantName}（${when}，效果 ${m.effect || '—'}，${mediaSummary(m)}）`);
  console.log('  ※ 仅本次预览，不会写状态文件，正式 --once 仍按首次记账流程跑。');
  if (dryRun) {
    activeModules().forEach((mod) => console.log(`  (--dry-run) [${mod.label}] → ${mod.chats().length} 群`));
    return;
  }
  assertConfig(['appId', 'appSecret']);
  assertHasChats();
  let imageKey = null;
  const buf = dataUrlToBuffer(m.img);
  if (buf) imageKey = await uploadImage(buf);
  for (const mod of activeModules()) {
    const card = buildCard(m, imageKey, mod.name);
    for (const cid of mod.chats()) await sendMessage(cid, 'interactive', card);
    console.log(`  ✓ [${mod.label}] → ${mod.chats().length} 群`);
  }
  console.log('去飞书里看看吧。');
}

// 把当前所有 (素材 × 启用模块) 标为「已发」，不真正发送。首次部署或想从今天开始重新计时用。
function cmdSeed({ dryRun }) {
  assertConfig(['dataDir']);
  const materials = collectAdoptedMaterials(config.dataDir);
  const mods = activeModules();
  const sent = [];
  for (const m of materials) for (const mod of mods) sent.push(`${m.key}#${mod.name}`);
  console.log(`发现 ${materials.length} 条历史 adopted 素材 × ${mods.length} 个模块，${dryRun ? '（dry-run，不写状态）' : '已全部'}标记为已发。`);
  console.log('下次 --once 将只发「自现在起新增的采用素材」。');
  if (!dryRun) saveState({ lastRun: Date.now(), sent });
}

async function cmdPush({ all, dryRun }) {
  assertConfig(['dataDir']); // 先只校验数据源，发不发再说

  const materials = collectAdoptedMaterials(config.dataDir);
  const state = loadState();
  const firstRun = state.lastRun === 0 && state.sent.length === 0;
  const mods = activeModules();

  // 待发单元：每条素材 × 每个启用的模块
  const allUnits = [];
  for (const m of materials) {
    for (const mod of mods) {
      allUnits.push({ m, mod, subKey: `${m.key}#${mod.name}` });
    }
  }

  // 首次运行（state 空 + 非 --all）：把现有 adopted 当历史，本次不发，只记账
  if (firstRun && !all) {
    console.log(`首次运行：发现 ${materials.length} 条历史 adopted 素材（${mods.length} 个模块）。`);
    console.log(`按"今天采用今天发，历史不再补发"的策略，本次不发送，仅记录为已发。`);
    if (!dryRun) saveState({ lastRun: Date.now(), sent: allUnits.map((u) => u.subKey) });
    else console.log('（--dry-run，未写状态。真实运行会把这些标记为已发。）');
    return;
  }

  const sent = new Set(state.sent);
  // 兼容旧状态：老格式只存 m.key（无 #module），命中也算已发，避免升级后重复刷屏
  const isSent = (u) => sent.has(u.subKey) || sent.has(u.m.key);
  const todo = all ? allUnits : allUnits.filter((u) => !isSent(u));
  // 正式推送按 adoptedTime 顺序发，老的在前
  todo.sort((a, b) => (a.m.adoptedTime || 0) - (b.m.adoptedTime || 0));

  console.log(`采用素材 ${materials.length} 条 × ${mods.length} 模块，本次待发 ${todo.length} 条${all ? '（--all 全量）' : '（增量）'}${dryRun ? '（--dry-run 不实发）' : ''}。`);
  if (!todo.length) return;

  // 真要发了才校验飞书凭证 + 群配置
  if (!dryRun) {
    assertConfig(['appId', 'appSecret']);
    assertHasChats();
  }

  let ok = 0;
  const imageKeyCache = new Map(); // 同一素材的图只上传一次（两个模块共用）
  for (const u of todo) {
    const { m, mod } = u;
    const tag = `[${mod.label}] ${m.project} / ${m.variantName}`;
    if (dryRun) {
      console.log(`  [dry] ${tag} · 效果 ${m.effect || '—'} · ${mediaSummary(m)} → ${mod.chats().length} 群`);
      continue;
    }
    try {
      let imageKey = imageKeyCache.get(m.key);
      if (imageKey === undefined) {
        imageKey = null;
        const buf = dataUrlToBuffer(m.img);
        if (buf) imageKey = await uploadImage(buf);
        imageKeyCache.set(m.key, imageKey);
      }
      const card = buildCard(m, imageKey, mod.name);
      for (const cid of mod.chats()) {
        await sendMessage(cid, 'interactive', card);
      }
      sent.add(u.subKey);
      ok++;
      console.log(`  ✓ ${tag} → ${mod.chats().length} 群`);
    } catch (e) {
      console.error(`  ✗ ${tag}：${e.message}`);
    }
  }

  if (!dryRun) {
    saveState({ lastRun: Date.now(), sent: [...sent] });
    console.log(`完成：成功 ${ok}/${todo.length}，已记录到本地状态。`);
  }
}

function help() {
  console.log(`用法：
  node src/index.js --list-chats   列出机器人所在群，拿 chat_id
  node src/index.js --once         发送新增的采用素材（默认，首次只记账不发）
  node src/index.js --test         挑历史最新一条试发一次（不写状态，不影响正式逻辑）
  node src/index.js --seed         把现有 adopted 都标为已发，从下次起只推新增
  node src/index.js --all          忽略历史，全量补发（慎用）
  node src/index.js --dry-run      预演，不真正发送`);
}

async function main() {
  if (has('--help') || has('-h')) return help();
  if (has('--list-chats')) return cmdListChats();
  if (has('--test')) return cmdTest({ dryRun: has('--dry-run') });
  if (has('--seed')) return cmdSeed({ dryRun: has('--dry-run') });
  return cmdPush({ all: has('--all'), dryRun: has('--dry-run') });
}

main().catch((e) => {
  console.error('运行出错：', e.message);
  process.exit(1);
});
