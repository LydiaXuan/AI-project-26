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

function dataUrlToBuffer(dataUrl) {
  const m = /^data:.*?;base64,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  return Buffer.from(m[1], 'base64');
}

async function cmdListChats() {
  assertConfig(['appId', 'appSecret']);
  const chats = await listChats();
  if (!chats.length) {
    console.log('机器人还没在任何群里。请先把应用对应的机器人拉进目标群，再重试。');
    return;
  }
  console.log('机器人所在的群（把目标群的 chat_id 填到 .env 的 FEISHU_CHAT_ID）：\n');
  for (const c of chats) {
    console.log(`  ${c.name || '(无名群)'}\n    chat_id = ${c.chat_id}\n`);
  }
}

// 预览模式：挑一条采用素材发出去，看消息长什么样。完全不写状态文件，
// 不影响 --once 的"首次记账"行为。
async function cmdTest({ dryRun }) {
  assertConfig(['dataDir']);
  const materials = collectAdoptedMaterials(config.dataDir);
  if (!materials.length) {
    console.log('没有找到任何 adopted 素材。请先在图测工具里把某个变体标为「采用」后重试。');
    return;
  }
  materials.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const m = materials[0];
  console.log(`【试发】挑选最新采用：${m.project} / ${m.variantName}（效果 ${m.effect || '—'}，图${m.img ? '有' : '无'}）`);
  console.log('  ※ 仅本次预览，不会写状态文件，正式 --once 仍按首次记账流程跑。');
  if (dryRun) {
    console.log('  (--dry-run，未真正发送)');
    return;
  }
  assertConfig(['appId', 'appSecret', 'chatId']);
  let imageKey = null;
  const buf = dataUrlToBuffer(m.img);
  if (buf) imageKey = await uploadImage(buf);
  const card = buildCard(m, imageKey);
  for (const cid of config.chatIds) {
    await sendMessage(cid, 'interactive', card);
  }
  console.log(`✓ 已发送到 ${config.chatIds.length} 个群。去飞书里看看吧。`);
}

// 把当前所有 adopted 素材标为「已发」，不真正发送。用户首次部署或想从今天开始重新计时用。
function cmdSeed({ dryRun }) {
  assertConfig(['dataDir']);
  const materials = collectAdoptedMaterials(config.dataDir);
  const sent = materials.map((m) => m.key);
  console.log(`发现 ${materials.length} 条历史 adopted 素材，${dryRun ? '（dry-run，不写状态）' : '已全部'}标记为已发。`);
  console.log('下次 --once 将只发「自现在起新增的采用素材」。');
  if (!dryRun) saveState({ lastRun: Date.now(), sent });
}

async function cmdPush({ all, dryRun }) {
  assertConfig(['dataDir']); // 先只校验数据源，发不发再说

  const materials = collectAdoptedMaterials(config.dataDir);
  const state = loadState();
  const firstRun = state.lastRun === 0 && state.sent.length === 0;

  // 首次运行（state 空 + 非 --all）：把现有 adopted 当历史，本次不发任何东西，只记账
  if (firstRun && !all) {
    console.log(`首次运行：发现 ${materials.length} 条历史 adopted 素材。`);
    console.log(`按"今天采用今天发，历史不再补发"的策略，本次不发送，仅记录为已发。`);
    if (!dryRun) saveState({ lastRun: Date.now(), sent: materials.map((m) => m.key) });
    else console.log('（--dry-run，未写状态。真实运行会把这些标记为已发。）');
    return;
  }

  const sent = new Set(state.sent);
  const todo = all ? materials : materials.filter((m) => !sent.has(m.key));
  todo.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));

  console.log(`采用素材共 ${materials.length} 条，本次待发 ${todo.length} 条${all ? '（--all 全量）' : '（增量）'}${dryRun ? '（--dry-run 不实发）' : ''}。`);
  if (!todo.length) return;

  // 真要发了才校验飞书凭证
  if (!dryRun) assertConfig(['appId', 'appSecret', 'chatId']);

  let ok = 0;
  for (const m of todo) {
    const tag = `${m.project} / ${m.variantName}`;
    if (dryRun) {
      console.log(`  [dry] ${tag} · 效果 ${m.effect || '—'} · 图${m.img ? '有' : '无'}`);
      continue;
    }
    try {
      let imageKey = null;
      const buf = dataUrlToBuffer(m.img);
      if (buf) imageKey = await uploadImage(buf);
      const card = buildCard(m, imageKey);
      for (const cid of config.chatIds) {
        await sendMessage(cid, 'interactive', card); // 上传一次图，发给每个群
      }
      sent.add(m.key);
      ok++;
      console.log(`  ✓ ${tag}${config.chatIds.length > 1 ? ` → ${config.chatIds.length} 个群` : ''}`);
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
