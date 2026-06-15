// 读群晖 data 文件夹里的记录，挑出「采用(adopted)」的变体作为待推送素材。
// 兼容两种存储布局：单文件 records.json（本分支）/ 每条一个 records/<id>.json。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeEffect } from './effect.js';

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

// 返回素材列表：每个采用的变体一条
export function collectAdoptedMaterials(dataDir) {
  const records = readRecords(dataDir);
  const materials = [];
  for (const r of records) {
    const variants = Array.isArray(r.variants) ? r.variants : [];
    const control = variants.find((v) => v.role === 'control') || variants[0];
    for (const v of variants) {
      if (!v.adopted) continue;
      materials.push({
        key: `${r.id}::${v.name}`,
        recordId: r.id,
        project: r.project || '',
        type: r.type || '',
        ratio: r.ratio || '',
        component: r.component || '',
        confidence: r.confidence,
        startDate: r.startDate || '',
        endDate: r.endDate || '',
        summary: r.summary || '',
        updatedAt: r.updatedAt || r.createdAt || 0,
        variantName: v.name,
        installs: v.installs,
        retained: v.retained,
        ciLow: v.ciLow,
        ciHigh: v.ciHigh,
        img: v.img || '',
        effect: computeEffect(v, control),
      });
    }
  }
  return materials;
}
