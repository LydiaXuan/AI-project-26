// 本地记录「上次发送时间 + 已发素材 key」，避免重复推送。
// 文件放在 feishu-cli/ 下，已被 .gitignore。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '..', '.feishu-cli-state.json');

export function loadState() {
  if (!existsSync(STATE_PATH)) return { lastRun: 0, sent: [] };
  try {
    const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    return { lastRun: s.lastRun || 0, sent: Array.isArray(s.sent) ? s.sent : [] };
  } catch {
    return { lastRun: 0, sent: [] };
  }
}

export function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
