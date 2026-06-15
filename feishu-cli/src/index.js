#!/usr/bin/env node
// 图测工具采用素材 → 飞书群推送 CLI
//   node src/index.js --list-chats   列出机器人所在群，拿 chat_id
//   node src/index.js --once         发送自上次以来新采用的素材（默认）
//   node src/index.js --all          忽略历史，发送全部采用素材
//   node src/index.js --dry-run      只打印将发什么，不真正发送
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

async function cmdPush({ all, dryRun }) {
  assertConfig(dryRun ? ['dataDir'] : ['appId', 'appSecret', 'chatId', 'dataDir']);

  const materials = collectAdoptedMaterials(config.dataDir);
  const state = loadState();
  const sent = new Set(state.sent);

  const todo = all ? materials : materials.filter((m) => !sent.has(m.key));
  // 时间稳定排序：旧的先发
  todo.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));

  console.log(`采用素材共 ${materials.length} 条，本次待发 ${todo.length} 条${all ? '（--all 全量）' : ''}${dryRun ? '（--dry-run 不实发）' : ''}。`);
  if (!todo.length) return;

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
      await sendMessage(config.chatId, 'interactive', buildCard(m, imageKey));
      sent.add(m.key);
      ok++;
      console.log(`  ✓ ${tag}`);
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
  node src/index.js --once         发送新采用的素材（默认，可省略）
  node src/index.js --all          发送全部采用素材（忽略历史）
  node src/index.js --dry-run      预演，不真正发送`);
}

async function main() {
  if (has('--help') || has('-h')) return help();
  if (has('--list-chats')) return cmdListChats();
  return cmdPush({ all: has('--all'), dryRun: has('--dry-run') });
}

main().catch((e) => {
  console.error('运行出错：', e.message);
  process.exit(1);
});
