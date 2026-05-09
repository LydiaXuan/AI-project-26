'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const { exec } = require('child_process');

const PORT = parseInt(process.env.PORT || '5000');
const SECRET = process.env.SECRET_KEY || 'change-me-in-production';
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── 数据存储（JSON 文件）─────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readData(file) {
  const p = path.join(DATA_DIR, file);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeData(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}
const getUsers    = () => readData('users.json')    || [];
const saveUsers   = u  => writeData('users.json', u);
const getTests    = () => readData('tests.json')    || [];
const saveTests   = t  => writeData('tests.json', t);
const getProjects = () => readData('projects.json') || [];
const saveProjects= p  => writeData('projects.json', p);
const getSettings = () => readData('settings.json') || {};
const saveSettings= s  => writeData('settings.json', s);

// ── 密码 & JWT ───────────────────────────────────────────────────
function hashPwd(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(pwd, salt, 260000, 32, 'sha256').toString('hex');
  return `${salt}:${h}`;
}
function checkPwd(pwd, stored) {
  const [salt, h] = stored.split(':');
  const test = crypto.pbkdf2Sync(pwd, salt, 260000, 32, 'sha256').toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(h)); } catch { return false; }
}
function makeToken(userId) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400 * 30 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
function verifyToken(token) {
  try {
    const [h, p, s] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── 工具 ─────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();
const uuid   = () => crypto.randomUUID();
function userToDict(u) {
  const d = { ...u };
  delete d.pwd_hash;
  d.isAdmin  = !!d.is_admin;  delete d.is_admin;
  d.joinedAt = d.joined_at;   delete d.joined_at;
  return d;
}

// ── HTTP 工具 ────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
function json200(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(data));
}
function jsonErr(res, status, msg) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify({ error: msg }));
}
function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}
function requireAuth(req, res) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const payload = verifyToken(token);
  if (!payload) { jsonErr(res, 401, 'Unauthorized'); return null; }
  const user = getUsers().find(u => u.id === payload.sub);
  if (!user) { jsonErr(res, 401, 'Unauthorized'); return null; }
  return user;
}

// ── 静态文件 MIME ────────────────────────────────────────────────
const MIME = { '.html':'text/html','.js':'application/javascript','.css':'text/css',
               '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
               '.svg':'image/svg+xml','.ico':'image/x-icon' };

// ── 路由 ─────────────────────────────────────────────────────────
async function handleRequest(req, res) {
  const { pathname } = url.parse(req.url);
  const method = req.method;

  Object.entries(CORS_HEADERS).forEach(([k,v]) => res.setHeader(k, v));
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (!pathname.startsWith('/api/')) {
    let fp = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(PUBLIC_DIR, 'index.html');
    try {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(fp));
    } catch { res.writeHead(404); return res.end('Not found'); }
  }

  // /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { email='', password='' } = await readBody(req);
    const em = email.trim().toLowerCase();
    if (!em || !password) return jsonErr(res, 400, '请输入邮箱和密码');
    const user = getUsers().find(u => u.email === em);
    if (!user || !checkPwd(password, user.pwd_hash)) return jsonErr(res, 401, '邮箱或密码错误');
    if (!user.approved) return jsonErr(res, 403, '账号待审批');
    return json200(res, { token: makeToken(user.id), user: userToDict(user) });
  }

  // /api/auth/register
  if (pathname === '/api/auth/register' && method === 'POST') {
    const { email='', name='', password='', accessCode='' } = await readBody(req);
    const em = email.trim().toLowerCase();
    const nm = name.trim();
    const code = accessCode.trim();
    if (!em || !nm || !password || !code) return jsonErr(res, 400, '请填写所有字段');
    const settings = getSettings();
    if (code !== (settings.accessCode || 'sanyi')) return jsonErr(res, 403, '入场码错误');
    const users = getUsers();
    if (users.find(u => u.email === em)) return jsonErr(res, 409, '该邮箱已注册');
    const user = { id: uuid(), email: em, name: nm, pwd_hash: hashPwd(password),
                   is_admin: users.length === 0 ? 1 : 0, approved: 1, joined_at: nowIso() };
    users.push(user);
    saveUsers(users);
    return json200(res, { token: makeToken(user.id), user: userToDict(user) });
  }

  // /api/auth/me
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = requireAuth(req, res); if (!user) return;
    return json200(res, { user: userToDict(user) });
  }

  // /api/settings
  if (pathname === '/api/settings') {
    const user = requireAuth(req, res); if (!user) return;
    if (method === 'GET') return json200(res, getSettings());
    if (method === 'PUT') {
      const data = await readBody(req);
      saveSettings({ ...getSettings(), ...data });
      return json200(res, { ok: true });
    }
  }

  // /api/users
  if (pathname === '/api/users' && method === 'GET') {
    const user = requireAuth(req, res); if (!user) return;
    if (!user.is_admin) return jsonErr(res, 403, 'Forbidden');
    return json200(res, getUsers().map(userToDict));
  }

  // /api/users/:uid
  const um = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (um) {
    const uid = um[1];
    const user = requireAuth(req, res); if (!user) return;
    if (method === 'GET') {
      if (uid !== user.id && !user.is_admin) return jsonErr(res, 403, 'Forbidden');
      const target = getUsers().find(u => u.id === uid);
      return target ? json200(res, userToDict(target)) : jsonErr(res, 404, 'Not found');
    }
    if (!user.is_admin) return jsonErr(res, 403, 'Forbidden');
    if (method === 'PATCH') {
      const data = await readBody(req);
      const users = getUsers();
      const idx = users.findIndex(u => u.id === uid);
      if (idx === -1) return jsonErr(res, 404, 'Not found');
      if ('isAdmin'  in data) users[idx].is_admin = data.isAdmin  ? 1 : 0;
      if ('approved' in data) users[idx].approved  = data.approved ? 1 : 0;
      if ('name'     in data) users[idx].name      = data.name;
      saveUsers(users);
      return json200(res, { ok: true });
    }
    if (method === 'DELETE') {
      if (uid === user.id) return jsonErr(res, 400, '不能删除自己');
      saveUsers(getUsers().filter(u => u.id !== uid));
      return json200(res, { ok: true });
    }
  }

  // /api/projects
  if (pathname === '/api/projects') {
    const user = requireAuth(req, res); if (!user) return;
    if (method === 'GET') return json200(res, getProjects().sort((a,b) => a.name.localeCompare(b.name)));
    if (method === 'POST') {
      const { name='' } = await readBody(req);
      if (!name.trim()) return jsonErr(res, 400, '名称不能为空');
      const project = { id: uuid(), name: name.trim(), created_at: nowIso() };
      const projects = getProjects(); projects.push(project); saveProjects(projects);
      return json200(res, project);
    }
  }

  // /api/projects/:pid
  const pm = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (pm && method === 'DELETE') {
    const user = requireAuth(req, res); if (!user) return;
    saveProjects(getProjects().filter(p => p.id !== pm[1]));
    return json200(res, { ok: true });
  }

  // /api/admin/update — git pull + restart
  if (pathname === '/api/admin/update' && method === 'POST') {
    const user = requireAuth(req, res); if (!user) return;
    if (!user.is_admin) return jsonErr(res, 403, '仅管理员可操作');
    exec('git pull', { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        json200(res, { ok: false, log: stderr || err.message });
      } else {
        json200(res, { ok: true, log: stdout || '已是最新版本' });
        setTimeout(() => process.exit(0), 800);
      }
    });
    return;
  }

  // /api/tests
  if (pathname === '/api/tests') {
    const user = requireAuth(req, res); if (!user) return;
    if (method === 'GET') return json200(res, getTests().sort((a,b) => b.created_at.localeCompare(a.created_at)));
    if (method === 'POST') {
      const data = await readBody(req); delete data.id;
      const test = { ...data, id: uuid(), created_at: nowIso(), updated_at: nowIso() };
      const tests = getTests(); tests.push(test); saveTests(tests);
      return json200(res, { id: test.id });
    }
  }

  // /api/tests/:tid
  const tm = pathname.match(/^\/api\/tests\/([^/]+)$/);
  if (tm) {
    const user = requireAuth(req, res); if (!user) return;
    const tid = tm[1];
    if (method === 'PATCH') {
      const updates = await readBody(req); delete updates.id;
      const tests = getTests();
      const idx = tests.findIndex(t => t.id === tid);
      if (idx === -1) return jsonErr(res, 404, 'Not found');
      tests[idx] = { ...tests[idx], ...updates, updated_at: nowIso() };
      saveTests(tests);
      return json200(res, { ok: true });
    }
    if (method === 'DELETE') {
      saveTests(getTests().filter(t => t.id !== tid));
      return json200(res, { ok: true });
    }
  }

  jsonErr(res, 404, 'Not found');
}

// ── 启动 ─────────────────────────────────────────────────────────
ensureDataDir();
http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error(err);
    res.writeHead(500); res.end('Internal Server Error');
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 服务启动: http://0.0.0.0:${PORT}`);
  console.log(`📁 数据目录: ${DATA_DIR}`);
});
