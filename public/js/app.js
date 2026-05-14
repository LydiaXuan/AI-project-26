// app.js — 主逻辑
// 注：本工具的运行时代码全部 inline 进 public/index.html（单文件构建产物）。
// 本文件保留作为开发参考拆分点：
//   - routing / view rendering
//   - form state (formData) + variant cards
//   - timeline split-pane master-detail
//   - dashboard KPI + ranking + summary table + CSV
//   - OCR (Tesseract.js) + batch icon crop
//   - settings: profile, chips, recycle bin, drive
//
// 完整实现见 public/index.html 内 <script> 段。
import { computeEffect, effectBadgeHTML, EFFECT_META } from './effects.js';
import { state, loadAll, saveRecords, saveMeta, saveRecycle, nextRecordId,
         softDelete, restoreRec, purgeRec, pickFolder, restoreHandle, flushPending } from './db.js';

export { computeEffect, effectBadgeHTML, EFFECT_META, state,
         loadAll, saveRecords, saveMeta, saveRecycle, nextRecordId,
         softDelete, restoreRec, purgeRec, pickFolder, restoreHandle, flushPending };
