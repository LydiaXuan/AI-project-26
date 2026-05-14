// db.js — 纯浏览器存储：File System Access + IndexedDB + 待同步队列 + 回收站
// 注：运行时已 inline 进 public/index.html。此文件为开发参考。
const IDB_NAME = 'viso-aso-db';
const IDB_VER = 1;
let _db = null, _folderHandle = null;
export const state = { records: [], meta: { projects: [], owners: [], ratios: [], components: [], lastId: {} }, recycle: [], pending: [], profile: null };

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, IDB_VER);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function kvGet(k) { await openDB(); return new Promise(r => { const tx = _db.transaction('kv', 'readonly'); const rq = tx.objectStore('kv').get(k); rq.onsuccess = () => r(rq.result); }); }
async function kvSet(k, v) { await openDB(); return new Promise(r => { const tx = _db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = r; }); }

export async function restoreFolderHandle() {
  const h = await kvGet('folderHandle');
  if (!h) return null;
  try {
    if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') { _folderHandle = h; return h; }
  } catch {}
  return null;
}
export async function pickFolder() {
  const h = await window.showDirectoryPicker({ mode: 'readwrite' });
  await h.requestPermission({ mode: 'readwrite' });
  _folderHandle = h; await kvSet('folderHandle', h); return h;
}
export function hasFolder() { return !!_folderHandle; }

async function readJSON(name, fallback) {
  if (!_folderHandle) return fallback;
  try {
    const fh = await _folderHandle.getFileHandle(name);
    const f = await fh.getFile();
    return JSON.parse(await f.text());
  } catch { return fallback; }
}
async function writeJSON(name, data) {
  if (!_folderHandle) { queue(name, data); return; }
  try {
    const fh = await _folderHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
  } catch (e) { console.warn('write fail, queueing', name, e); queue(name, data); }
}
function queue(name, data) {
  state.pending = state.pending.filter(p => p.name !== name);
  state.pending.push({ name, data, ts: Date.now() });
  kvSet('pending', state.pending);
}
export async function flushPending() {
  if (!_folderHandle || !state.pending.length) return 0;
  const q = [...state.pending]; let ok = 0;
  for (const p of q) {
    try {
      const fh = await _folderHandle.getFileHandle(p.name, { create: true });
      const w = await fh.createWritable(); await w.write(JSON.stringify(p.data, null, 2)); await w.close();
      state.pending = state.pending.filter(x => x !== p); ok++;
    } catch {}
  }
  await kvSet('pending', state.pending); return ok;
}

export async function loadAll() {
  state.records = await readJSON('records.json', []);
  state.meta = await readJSON('meta.json', { projects: [], owners: [], ratios: [], components: [], lastId: {} });
  state.recycle = await readJSON('recycle.json', []);
  state.pending = (await kvGet('pending')) || [];
  cleanRecycle();
}
export async function saveRecords() { await writeJSON('records.json', state.records); }
export async function saveMeta() { await writeJSON('meta.json', state.meta); }
export async function saveRecycle() { await writeJSON('recycle.json', state.recycle); }

export function nextRecordId() {
  const year = new Date().getFullYear();
  const last = state.meta.lastId?.[year] || 0;
  const n = last + 1;
  state.meta.lastId = state.meta.lastId || {};
  state.meta.lastId[year] = n;
  return `${year}-${String(n).padStart(2, '0')}`;
}

export async function softDelete(id) {
  const i = state.records.findIndex(r => r.id === id);
  if (i < 0) return;
  const rec = state.records.splice(i, 1)[0];
  rec._deletedAt = Date.now();
  state.recycle.push(rec);
  await Promise.all([saveRecords(), saveRecycle()]);
}
export async function restoreRecord(id) {
  const i = state.recycle.findIndex(r => r.id === id);
  if (i < 0) return;
  const rec = state.recycle.splice(i, 1)[0];
  delete rec._deletedAt;
  state.records.push(rec);
  await Promise.all([saveRecords(), saveRecycle()]);
}
export async function purgeRecord(id) {
  state.recycle = state.recycle.filter(r => r.id !== id);
  await saveRecycle();
}
function cleanRecycle() {
  const THIRTY = 30 * 24 * 3600 * 1000;
  const cutoff = Date.now() - THIRTY;
  const before = state.recycle.length;
  state.recycle = state.recycle.filter(r => (r._deletedAt || 0) > cutoff);
  if (state.recycle.length !== before) saveRecycle();
}
