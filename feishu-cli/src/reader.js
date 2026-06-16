// 读群晖 data 文件夹里的记录，挑出「采用(adopted)」的变体作为待推送素材。
// 兼容两种存储布局：单文件 records.json（本分支）/ 每条一个 records/<id>.json。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeEffect } from './effect.js';

// "YYYY-MM-DD" → 毫秒时间戳；空/无效返回 0。
function parseDate(s) {
  if (!s || typeof s !== 'string') return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function readRecords(dataDir) {
  const single = join(dataDir, 'records.json');
  if (existsSync(single)) {
    const data = JSON.parse(readFileSync(single, 'utf8'));
    return Array.isArray(data) ? data : [];
  }
  const dir = join(dataDir, 'records');
  if (existsSync(dir)) {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean);
  }
  throw new Error(`在 ${dataDir} 下没找到 records.json，也没有 records/ 目录`);
}

// 取变体在某 attr 下的素材（适配新旧两种存储）
// 新版：v.assets[attr]；老版：v.img 视为「记录里第一个非视频 attr」的内容
function getAssetForVariant(v, attr, recAttrs) {
  if (v?.assets && Object.prototype.hasOwnProperty.call(v.assets, attr)) {
    return v.assets[attr] || '';
  }
  if (!v?.img || v?.assets) return '';
  const primary = (Array.isArray(recAttrs) ? recAttrs : []).find((a) => a !== '视频') || 'icon';
  if (attr === primary || (attr === 'icon' && !recAttrs)) return v.img;
  return '';
}

// 返回素材列表：每个采用的变体一条
export function collectAdoptedMaterials(dataDir) {
  const records = readRecords(dataDir);
  const materials = [];
  for (const r of records) {
    const variants = Array.isArray(r.variants) ? r.variants : [];
    const control = variants.find((v) => v.role === 'control') || variants[0];
    const recAttrs = (Array.isArray(r.attrs) && r.attrs.length) ? r.attrs : ['icon'];
    const hasVideo = recAttrs.includes('视频');
    const hasImage = recAttrs.some((a) => a !== '视频');

    for (const v of variants) {
      if (!v.adopted) continue;
      // 优先用「点采用按钮的时间戳」(v.adoptedAt)；老数据没有这个字段，退到
      // endDate(实验结束日) / startDate / 记录的 updatedAt / createdAt。
      const adoptedTime = v.adoptedAt
        || parseDate(r.endDate)
        || parseDate(r.startDate)
        || r.updatedAt
        || r.createdAt
        || 0;
      const videoUrl = hasVideo ? getAssetForVariant(v, '视频', recAttrs) : '';
      // 图片：优先选第一个非视频 attr；老数据 v.img 是 fallback
      const firstImgAttr = recAttrs.find((a) => a !== '视频');
      const img = (hasImage && firstImgAttr) ? (getAssetForVariant(v, firstImgAttr, recAttrs) || v.img || '') : '';

      materials.push({
        key: `${r.id}::${v.name}`,
        recordId: r.id,
        project: r.project || '',
        type: r.type || '',
        ratio: r.ratio || '',
        component: r.component || '',
        attrs: recAttrs,
        confidence: r.confidence,
        startDate: r.startDate || '',
        endDate: r.endDate || '',
        summary: r.summary || '',
        adoptedTime,
        updatedAt: r.updatedAt || r.createdAt || 0,
        variantName: v.name,
        installs: v.installs,
        retained: v.retained,
        ciLow: v.ciLow,
        ciHigh: v.ciHigh,
        img,
        videoUrl,
        effect: computeEffect(v, control),
      });
    }
  }
  return materials;
}
