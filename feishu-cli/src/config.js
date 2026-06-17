// 极简 .env 读取（零依赖）。优先用进程已有的环境变量，缺的再从 .env 补。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '..', '.env');

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = existsSync(ENV_PATH) ? parseEnv(readFileSync(ENV_PATH, 'utf8')) : {};
const get = (k) => process.env[k] ?? fileEnv[k];

const splitIds = (raw) => (raw || '').split(',').map((s) => s.trim()).filter(Boolean);

const chatIdRaw = get('FEISHU_CHAT_ID') || '';          // 兼容旧单群配置
// 两个模块各自的群（逗号分隔多群）；没配新变量时降级用旧的 FEISHU_CHAT_ID
const buyingRaw = get('FEISHU_CHAT_ID_BUYING') || chatIdRaw;
const reviewRaw = get('FEISHU_CHAT_ID_REVIEW') || chatIdRaw;

export const config = {
  appId: get('FEISHU_APP_ID'),
  appSecret: get('FEISHU_APP_SECRET'),
  chatId: chatIdRaw,                                   // 原始值（仅用于校验是否填了）
  chatIds: splitIds(chatIdRaw),                        // 兼容老逻辑：旧单群列表
  chatIdsBuying: splitIds(buyingRaw),                  // 同步买量群
  chatIdsReview: splitIds(reviewRaw),                  // 测试复盘总结群
  dataDir: get('DATA_DIR'),
  domain: (get('FEISHU_DOMAIN') || 'https://open.feishu.cn').replace(/\/+$/, ''),
};

// 校验必填项；missingFor 指定本次命令真正需要的字段
export function assertConfig(needed) {
  const labels = {
    appId: 'FEISHU_APP_ID',
    appSecret: 'FEISHU_APP_SECRET',
    chatId: 'FEISHU_CHAT_ID',
    dataDir: 'DATA_DIR',
  };
  const missing = needed.filter((k) => !config[k]);
  if (missing.length) {
    console.error('缺少必填配置：' + missing.map((k) => labels[k]).join(', '));
    console.error('请在 feishu-cli/.env 里补齐（参考 .env.example）。');
    process.exit(1);
  }
}
