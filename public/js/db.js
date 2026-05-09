// ── API client（替换 Firebase SDK）────────────────────────────
// 所有数据请求通过 fetch 发往同源 Flask 后端

function getToken() { return localStorage.getItem('jwt_token'); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('jwt_token');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── 无需初始化（Firebase 遗留接口，保留兼容签名）──────────────
export function initDB() {}

// ── 设置 ──────────────────────────────────────────────────────
export async function getSettings() {
  try { return await apiFetch('/api/settings'); }
  catch { return null; }
}

export async function createSettings(data) {
  return apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
}

export async function updateSettings(data) {
  return apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// ── 用户 ──────────────────────────────────────────────────────
export async function getUser(uid) {
  try { return await apiFetch(`/api/users/${uid}`); }
  catch { return null; }
}

export async function getAllUsers() {
  return apiFetch('/api/users');
}

export async function setUser(uid, data) {
  return apiFetch(`/api/users/${uid}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function updateUser(uid, data) {
  return apiFetch(`/api/users/${uid}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteUser(uid) {
  return apiFetch(`/api/users/${uid}`, { method: 'DELETE' });
}

// ── 项目 ──────────────────────────────────────────────────────
export async function getProjects() {
  return apiFetch('/api/projects');
}

export async function addProject(name) {
  return apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function deleteProject(id) {
  return apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
}

// ── 测试人员（存在 settings 里）──────────────────────────────
export async function addTester(name) {
  const s = await getSettings();
  const testers = s?.testers || [];
  if (!testers.includes(name)) await updateSettings({ ...s, testers: [...testers, name] });
}

export async function removeTester(name) {
  const s = await getSettings();
  await updateSettings({ ...s, testers: (s?.testers || []).filter(t => t !== name) });
}

// ── 测试记录 ──────────────────────────────────────────────────
export async function createTest(data) {
  return apiFetch('/api/tests', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTest(id, data) {
  return apiFetch(`/api/tests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTest(id) {
  return apiFetch(`/api/tests/${id}`, { method: 'DELETE' });
}

// 替换实时订阅（Firestore onSnapshot）→ 一次性 fetch，返回空函数作为 unsubscribe
export function subscribeTests(callback) {
  apiFetch('/api/tests').then(callback).catch(console.error);
  return () => {};
}

export function subscribeProjects(callback) {
  apiFetch('/api/projects').then(callback).catch(console.error);
  return () => {};
}
