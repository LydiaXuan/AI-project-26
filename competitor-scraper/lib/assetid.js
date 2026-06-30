// ================================================================
// assetid.js — 从 googleusercontent 图片 URL 提取稳定 ID
//
// Google Play 的素材图都是 https://play-lh.googleusercontent.com/<ID>=尺寸
// 同一张图的 <ID> 固定、换图时 <ID> 变。用它做：去重存储 + 变更比对。
// ================================================================

/** 取稳定 ID（去掉尺寸参数与域名，留路径主体，清成安全文件名片段）。 */
export function assetIdFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // 尺寸参数形如 =w526-h296，直接拼在路径后，没有 ?，所以按 '=' 截断
    let p = u.pathname.replace(/^\/+/, '').split('=')[0];
    p = p.replace(/[^\w-]/g, '_');
    return p || null;
  } catch {
    // 不是合法 URL：退化为对整串做清洗
    const s = String(url).split('=')[0].replace(/^https?:\/\//, '');
    return s.replace(/[^\w-]/g, '_').slice(0, 120) || null;
  }
}
