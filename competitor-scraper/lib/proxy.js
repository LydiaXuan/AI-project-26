// ================================================================
// proxy.js — 代理解析：把命令行 --proxy 或环境变量统一成一个 agent
//
// 命令行没走系统代理时（很常见），Node 直连 Google Play 会超时。
// 这里支持：
//   · 命令行 --proxy http://127.0.0.1:7890
//   · 环境变量 HTTPS_PROXY / HTTP_PROXY / ALL_PROXY
// 解析出代理 URL 后，构造 https-proxy-agent，供 got 使用。
// ================================================================
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 解析代理地址。优先级：显式 cliProxy > 环境变量。
 * 允许用户只写 "127.0.0.1:7890"，自动补 http:// 前缀。
 * 返回 { proxyUrl, agent } 或 null（表示不走代理，直连）。
 */
export function resolveProxy(cliProxy) {
  let raw =
    cliProxy ||
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY  || process.env.http_proxy  ||
    process.env.ALL_PROXY   || process.env.all_proxy   ||
    null;
  if (!raw) return null;

  raw = String(raw).trim();
  if (!/^[a-z]+:\/\//i.test(raw)) raw = 'http://' + raw; // 补协议

  let proxyUrl;
  try {
    proxyUrl = new URL(raw).toString();
  } catch {
    throw new Error(`代理地址无法解析：${raw}（示例：http://127.0.0.1:7890）`);
  }

  const agent = new HttpsProxyAgent(proxyUrl);
  return { proxyUrl, agent };
}
