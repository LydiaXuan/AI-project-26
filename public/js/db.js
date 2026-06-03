// ================================================================
// db.js – 纯浏览器存储层
//   • File System Access API 直接读写群晖网络盘上的 JSON 文件
//   • IndexedDB 持久化文件夹 handle + 待同步队列
//   • 自动每日备份 + 编辑历史 + 回收站
// ================================================================

// ── IndexedDB 工具 ───────────────────────────────────────────────
const IDB_NAME = 'chart-recorder';
const IDB_VER  = 1;
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta'))    db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
async function idbGet(store, key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly').objectStore(store).get(key);
    tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error);
  });
}
async function idbSet(store, key, value) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const s = db.transaction(store, 'readwrite').objectStore(store);
    const tx = key === undefined ? s.put(value) : s.put(value, key);
    tx.onsuccess = () => res(); tx.onerror = () => rej(tx.error);
  });
}
async function idbDel(store, key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    tx.onsuccess = () => res(); tx.onerror = () => rej(tx.error);
  });
}
async function idbAll(store) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly').objectStore(store).getAll();
    tx.onsuccess = () => res(tx.result || []); tx.onerror = () => rej(tx.error);
  });
}

// ── 文件夹 handle 管理 ──────────────────────────────────────────
let _folder = null;

export async function isReady() {
  if (_folder) return await verifyPermission(_folder);
  const saved = await idbGet('meta', 'folder');
  if (!saved) return false;
  if (await verifyPermission(saved, false)) { _folder = saved; return true; }
  _folder = saved;
  return false;
}

export async function resumeAccess() {
  const saved = _folder || await idbGet('meta', 'folder');
  if (!saved) return false;
  const ok = await verifyPermission(saved, true);
  if (ok) { _folder = saved; await ensureSubfolder('backups'); }
  return ok;
}

export async function pickFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error('当前浏览器不支持 File System Access API，请用 Chrome 或 Edge');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  _folder = handle;
  await idbSet('meta', 'folder', handle);
  await ensureSubfolder('backups');
  return true;
}

async function verifyPermission(handle, prompt = false) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (prompt && (await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

export function getFolderName() { return _folder?.name || ''; }

async function ensureSubfolder(name) {
  if (!_folder) return null;
  return await _folder.getDirectoryHandle(name, { create: true });
}

// ── 基础文件 I/O ────────────────────────────────────────────────
async function readJSON(filename, defaultValue = null) {
  if (!_folder) throw new Error('数据文件夹未选择');
  try {
    const fh = await _folder.getFileHandle(filename);
    const f = await fh.getFile();
    const text = await f.text();
    return text ? JSON.parse(text) : defaultValue;
  } catch (e) {
    if (e.name === 'NotFoundError') return defaultValue;
    throw e;
  }
}
async function writeJSON(filename, data) {
  if (!_folder) throw new Error('数据文件夹未选择');
  const fh = await _folder.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}
async function readJSONIn(subfolder, filename, defaultValue = null) {
  if (!_folder) return defaultValue;
  try {
    const dir = await _folder.getDirectoryHandle(subfolder);
    const fh = await dir.getFileHandle(filename);
    const f = await fh.getFile();
    const text = await f.text();
    return text ? JSON.parse(text) : defaultValue;
  } catch (e) {
    if (e.name === 'NotFoundError') return defaultValue;
    throw e;
  }
}
async function writeJSONIn(subfolder, filename, data) {
  const dir = await ensureSubfolder(subfolder);
  const fh = await dir.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}
async function listIn(subfolder) {
  if (!_folder) return [];
  try {
    const dir = await _folder.getDirectoryHandle(subfolder);
    const out = [];
    for await (const [name] of dir.entries()) out.push(name);
    return out.sort();
  } catch { return []; }
}

// ── 工具 ────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const uuid = () => crypto.randomUUID();
const HISTORY_LIMIT = 5;
const TRASH_RETENTION_DAYS = 30;
const BACKUP_RETENTION_DAYS = 30;

function pushHistory(record, prev) {
  if (!prev) return record;
  const snap = { ...prev };
  delete snap._history;
  const history = (record._history || []);
  history.unshift({ ts: nowIso(), snapshot: snap });
  record._history = history.slice(0, HISTORY_LIMIT);
  return record;
}

// ── 每日快照 ────────────────────────────────────────────────────
async function ensureDailySnapshot(tests) {
  const fname = `tests-${todayStr()}.json`;
  const existing = await readJSONIn('backups', fname, null);
  if (existing !== null) return;
  await writeJSONIn('backups', fname, tests);
  await purgeOldBackups();
}
async function purgeOldBackups() {
  const files = await listIn('backups');
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);
  const dir = await ensureSubfolder('backups');
  for (const name of files) {
    const m = name.match(/^tests-(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    if (new Date(m[1]) < cutoff) {
      try { await dir.removeEntry(name); } catch {}
    }
  }
}

// ── 待同步队列 ──────────────────────────────────────────────────
async function queueWrite(item) {
  await idbSet('pending', undefined, { id: uuid(), ts: nowIso(), ...item });
}
export async function getPendingCount() {
  return (await idbAll('pending')).length;
}
export async function retryPending() {
  const items = await idbAll('pending');
  let success = 0, fail = 0;
  for (const it of items) {
    try {
      if (it.kind === 'createTest')   await _createTestImpl(it.payload, it.id);
      else if (it.kind === 'updateTest') await _updateTestImpl(it.targetId, it.payload, it.id);
      else if (it.kind === 'deleteTest') await _deleteTestImpl(it.targetId, it.id);
      else if (it.kind === 'settings')   await _writeSettingsImpl(it.payload, it.id);
      else if (it.kind === 'project')    await _writeProjectsImpl(it.payload, it.id);
      else if (it.kind === 'restoreTrash') await _restoreFromTrashImpl(it.targetId, it.id);
      else if (it.kind === 'rollback')   await _rollbackImpl(it.targetId, it.payload, it.id);
      success++;
      await idbDel('pending', it.id);
    } catch (e) { console.error('retry failed', it, e); fail++; }
  }
  return { success, fail };
}

// ── Settings ────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  testers: [], ratioPresets: [], experimentTypes: [],
};
async function _writeSettingsImpl(data, queueId) {
  const cur = await readJSON('settings.json', DEFAULT_SETTINGS);
  const merged = { ...cur, ...data };
  await writeJSON('settings.json', merged);
  if (queueId) await idbDel('pending', queueId);
  return merged;
}
export async function getSettings() {
  if (!_folder) return null;
  return await readJSON('settings.json', DEFAULT_SETTINGS);
}
export async function updateSettings(data) {
  try { return await _writeSettingsImpl(data); }
  catch (e) { await queueWrite({ kind: 'settings', payload: data }); throw e; }
}
export async function createSettings(data) { return updateSettings(data); }

// ── Projects ────────────────────────────────────────────────────
async function _writeProjectsImpl(projects, queueId) {
  await writeJSON('projects.json', projects);
  if (queueId) await idbDel('pending', queueId);
}
export async function getProjects() {
  if (!_folder) return [];
  const list = await readJSON('projects.json', []);
  return list.sort((a,b) => a.name.localeCompare(b.name));
}
export async function addProject(name) {
  const list = await readJSON('projects.json', []);
  const project = { id: uuid(), name: name.trim(), created_at: nowIso() };
  list.push(project);
  try { await _writeProjectsImpl(list); }
  catch (e) { await queueWrite({ kind: 'project', payload: list }); throw e; }
  return project;
}
export async function deleteProject(id) {
  const list = (await readJSON('projects.json', [])).filter(p => p.id !== id);
  try { await _writeProjectsImpl(list); }
  catch (e) { await queueWrite({ kind: 'project', payload: list }); throw e; }
}

// ── Testers (在 settings 里)─────────────────────────────────────
export async function addTester(name) {
  const s = await getSettings();
  const testers = s?.testers || [];
  if (testers.includes(name)) return;
  await updateSettings({ testers: [...testers, name] });
}
export async function removeTester(name) {
  const s = await getSettings();
  await updateSettings({ testers: (s?.testers || []).filter(t => t !== name) });
}

// ── Tests (核心) ────────────────────────────────────────────────
async function _createTestImpl(data, queueId) {
  const tests = await readJSON('tests.json', []);
  await ensureDailySnapshot(tests);
  const test = { ...data, id: data.id || uuid(), created_at: data.created_at || nowIso(), updated_at: nowIso() };
  tests.push(test);
  await writeJSON('tests.json', tests);
  if (queueId) await idbDel('pending', queueId);
  return test;
}
async function _updateTestImpl(id, updates, queueId) {
  const tests = await readJSON('tests.json', []);
  await ensureDailySnapshot(tests);
  const idx = tests.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('记录不存在');
  const prev = tests[idx];
  const next = pushHistory({ ...prev, ...updates, updated_at: nowIso() }, prev);
  tests[idx] = next;
  await writeJSON('tests.json', tests);
  if (queueId) await idbDel('pending', queueId);
  return next;
}
async function _deleteTestImpl(id, queueId) {
  const tests = await readJSON('tests.json', []);
  await ensureDailySnapshot(tests);
  const idx = tests.findIndex(t => t.id === id);
  if (idx === -1) {
    if (queueId) await idbDel('pending', queueId);
    return;
  }
  const removed = tests.splice(idx, 1)[0];
  removed._deleted_at = nowIso();
  const trash = await readJSON('tests-trash.json', []);
  trash.push(removed);
  // 清理过期回收站
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);
  const cleanedTrash = trash.filter(t => new Date(t._deleted_at) >= cutoff);
  await writeJSON('tests-trash.json', cleanedTrash);
  await writeJSON('tests.json', tests);
  if (queueId) await idbDel('pending', queueId);
}
async function _restoreFromTrashImpl(id, queueId) {
  const trash = await readJSON('tests-trash.json', []);
  const idx = trash.findIndex(t => t.id === id);
  if (idx === -1) {
    if (queueId) await idbDel('pending', queueId);
    return;
  }
  const rec = trash.splice(idx, 1)[0];
  delete rec._deleted_at;
  rec.updated_at = nowIso();
  const tests = await readJSON('tests.json', []);
  tests.push(rec);
  await writeJSON('tests.json', tests);
  await writeJSON('tests-trash.json', trash);
  if (queueId) await idbDel('pending', queueId);
}
async function _rollbackImpl(id, historyIndex, queueId) {
  const tests = await readJSON('tests.json', []);
  const idx = tests.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('记录不存在');
  const cur = tests[idx];
  const hist = cur._history || [];
  if (!hist[historyIndex]) throw new Error('历史版本不存在');
  const restored = pushHistory({ ...hist[historyIndex].snapshot, _history: cur._history, updated_at: nowIso() }, cur);
  tests[idx] = restored;
  await writeJSON('tests.json', tests);
  if (queueId) await idbDel('pending', queueId);
  return restored;
}

export async function getTests() {
  if (!_folder) return [];
  const tests = await readJSON('tests.json', []);
  return tests.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
}
export async function createTest(data) {
  try { return await _createTestImpl(data); }
  catch (e) { await queueWrite({ kind: 'createTest', payload: data }); throw e; }
}
export async function updateTest(id, updates) {
  try { return await _updateTestImpl(id, updates); }
  catch (e) { await queueWrite({ kind: 'updateTest', targetId: id, payload: updates }); throw e; }
}
export async function deleteTest(id) {
  try { return await _deleteTestImpl(id); }
  catch (e) { await queueWrite({ kind: 'deleteTest', targetId: id }); throw e; }
}

// ── 回收站 ──────────────────────────────────────────────────────
export async function getTrash() {
  if (!_folder) return [];
  const list = await readJSON('tests-trash.json', []);
  return list.sort((a,b) => (b._deleted_at||'').localeCompare(a._deleted_at||''));
}
export async function restoreFromTrash(id) {
  try { return await _restoreFromTrashImpl(id); }
  catch (e) { await queueWrite({ kind: 'restoreTrash', targetId: id }); throw e; }
}
export async function purgeTrashItem(id) {
  const trash = (await readJSON('tests-trash.json', [])).filter(t => t.id !== id);
  await writeJSON('tests-trash.json', trash);
}

// ── 编辑历史回滚 ────────────────────────────────────────────────
export async function getRecordHistory(id) {
  const tests = await readJSON('tests.json', []);
  return tests.find(t => t.id === id)?._history || [];
}
export async function rollbackRecord(id, historyIndex) {
  try { return await _rollbackImpl(id, historyIndex); }
  catch (e) { await queueWrite({ kind: 'rollback', targetId: id, payload: historyIndex }); throw e; }
}

// ── 每日整库快照恢复 ────────────────────────────────────────────
export async function getDailyBackups() {
  const files = await listIn('backups');
  return files.filter(f => /^tests-\d{4}-\d{2}-\d{2}\.json$/.test(f))
              .map(f => f.match(/^tests-(\d{4}-\d{2}-\d{2})\.json$/)[1])
              .sort().reverse();
}
export async function restoreFromBackup(date) {
  const data = await readJSONIn('backups', `tests-${date}.json`, null);
  if (data === null) throw new Error('快照不存在');
  const tests = await readJSON('tests.json', []);
  await ensureDailySnapshot(tests); // 先把当前状态再备一份
  await writeJSON('tests.json', data);
  return data;
}

// ── 兼容旧接口：subscribeTests / subscribeProjects ─────────────
export function subscribeTests(cb) {
  getTests().then(cb).catch(console.error);
  return () => {};
}
export function subscribeProjects(cb) {
  getProjects().then(cb).catch(console.error);
  return () => {};
}

// ── 兼容旧接口（单纯返回） ──────────────────────────────────────
export function initDB() {}
