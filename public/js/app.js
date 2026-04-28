// ================================================================
// app.js  –  图测记录工具
// ================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { FIREBASE_CONFIG, SUPER_ADMIN_EMAIL } from './config.js';
import { calculateEffect, effectBadgeHTML } from './effects.js';
import {
  initDB, getSettings, createSettings, updateSettings,
  getUser, getAllUsers, setUser, updateUser,
  getProjects, addProject, deleteProject,
  addTester, removeTester,
  createTest, updateTest, deleteTest,
  subscribeTests, subscribeProjects
} from './db.js';

// ── Firebase init ─────────────────────────────────────────────
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const storage = getStorage(firebaseApp);
initDB(firebaseApp);

// ── State ─────────────────────────────────────────────────────
const state = {
  user: null, userData: null, settings: null,
  view: 'dashboard', tests: [], projects: [],
  filterProject: 'all', editTestId: null, activeVariant: null,
  _unsubTests: null, _unsubProjects: null,
};
const formState = { images: [null,null,null,null], previews: [null,null,null,null] };
const charts = {};
function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
  Object.keys(charts).forEach(k => delete charts[k]);
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id='toast-container'; c.className='toast-container'; document.body.appendChild(c); }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`; el.textContent = msg;
  c.appendChild(el); setTimeout(() => el.remove(), 3500);
}

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(src) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<img src="${src}" />`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
}

// ── Paste handler ─────────────────────────────────────────────
document.addEventListener('paste', e => {
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!text.startsWith('GPLAY|')) return;
  e.preventDefault();
  const data = parsePaste(text);
  if (!data) return;
  if (state.activeVariant === null) { toast('请先点击某个变体的「从 Play 提取」按钮', 'info'); return; }
  const i = state.activeVariant;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) { el.value = val; el.dispatchEvent(new Event('input')); } };
  setVal(`v${i}_fi`, data.fi); setVal(`v${i}_ciL`, data.ciL); setVal(`v${i}_ciH`, data.ciH); setVal(`v${i}_ri`, data.ri);
  if (data.ciL !== undefined && data.ciH !== undefined) updateEffectBadge(i);
  state.activeVariant = null;
  document.querySelectorAll('.paste-active-hint').forEach(el => el.remove());
  toast(`已自动填入${i === 0 ? '原始' : `测试${i}`}的数据`, 'success');
});

function parsePaste(text) {
  try {
    const obj = {};
    text.split('|').slice(1).forEach(p => { const idx = p.indexOf(':'); if (idx > 0) obj[p.slice(0,idx)] = p.slice(idx+1); });
    return obj;
  } catch { return null; }
}

// ── Auth ──────────────────────────────────────────────────────
async function signInWithGoogle() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { toast('登录失败：' + err.message, 'error'); }
}
async function signOutUser() {
  if (state._unsubTests) state._unsubTests();
  if (state._unsubProjects) state._unsubProjects();
  await fbSignOut(auth);
}

onAuthStateChanged(auth, async user => {
  if (!user) { state.user = null; state.userData = null; renderLogin(); return; }
  state.user = user;
  let userData = await getUser(user.uid);
  const settings = await getSettings();
  if (!settings) {
    await createSettings({ accessCode: 'sanyi', testers: [user.displayName || user.email], allowlist: [user.email] });
    await setUser(user.uid, { email: user.email, name: user.displayName || user.email, photoURL: user.photoURL || null, isAdmin: true, approved: true, joinedAt: new Date().toISOString() });
    userData = await getUser(user.uid);
  }
  state.settings = await getSettings();
  if (!userData || !userData.approved) { renderAccessCode(user); return; }
  state.userData = userData;
  await startMainApp();
});

async function handleAccessCode(code) {
  const settings = await getSettings();
  if (!settings || code.trim() !== settings.accessCode) { toast('入场码错误，请联系管理员', 'error'); return; }
  const isSpecialAdmin = SUPER_ADMIN_EMAIL && state.user.email === SUPER_ADMIN_EMAIL;
  await setUser(state.user.uid, { email: state.user.email, name: state.user.displayName || state.user.email, photoURL: state.user.photoURL || null, isAdmin: isSpecialAdmin || false, approved: true, joinedAt: new Date().toISOString() });
  const al = settings.allowlist || [];
  if (!al.includes(state.user.email)) await updateSettings({ allowlist: [...al, state.user.email] });
  toast('验证成功，欢迎加入！', 'success');
  state.userData = await getUser(state.user.uid);
  state.settings = await getSettings();
  await startMainApp();
}

async function startMainApp() {
  state._unsubTests = subscribeTests(tests => { state.tests = tests; if (state.view === 'dashboard') renderDashboard(); if (state.view === 'timeline') renderTimeline(); });
  state._unsubProjects = subscribeProjects(projects => { state.projects = projects; });
  state.settings = await getSettings();
  navigate('dashboard');
}

// ── Navigation ────────────────────────────────────────────────
function navigate(view, params = {}) {
  destroyCharts(); state.view = view; Object.assign(state, params);
  if (view !== 'form') { state.editTestId = null; formState.images = [null,null,null,null]; formState.previews = [null,null,null,null]; }
  render();
}
function render() {
  switch (state.view) {
    case 'dashboard': renderDashboard(); break;
    case 'timeline':  renderTimeline();  break;
    case 'form':      renderFormView();  break;
    case 'admin':     renderAdmin();     break;
  }
}

// ── Shell ─────────────────────────────────────────────────────
function escHtml(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderShell(content, activeTab) {
  const u = state.userData;
  const av = u?.photoURL ? `<img class="user-avatar" src="${u.photoURL}" />` : `<div class="user-avatar-placeholder">${(u?.name||'?')[0].toUpperCase()}</div>`;
  const adminBtn = u?.isAdmin ? `<button class="nav-tab${activeTab==='admin'?' active':''}" onclick="navigate('admin')">⚙️ 管理</button>` : '';
  document.getElementById('app').innerHTML = `
    <nav class="navbar">
      <div class="navbar-brand">📊 图测记录<span>Chart Testing</span></div>
      <div class="nav-tabs">
        <button class="nav-tab${activeTab==='dashboard'?' active':''}" onclick="navigate('dashboard')">仪表盘</button>
        <button class="nav-tab${activeTab==='timeline'?' active':''}" onclick="navigate('timeline')">时间线</button>
        <button class="nav-tab btn-primary" style="margin-left:8px" onclick="navigate('form')">＋ 新增记录</button>
      </div>
      <div class="navbar-right">
        ${adminBtn}
        <div class="user-pill">${av}<span>${escHtml(u?.name||u?.email||'')}</span></div>
        <button class="btn-icon" title="退出登录" onclick="signOutUser()">🚪</button>
      </div>
    </nav>
    <main class="page">${content}</main>`;
}

// ── Login ─────────────────────────────────────────────────────
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">📊</div>
        <h1>图测记录工具</h1>
        <p>Chart A/B Testing Tracker</p>
        <button class="btn-google" onclick="signInWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
          使用 Google 账号登录
        </button>
      </div>
    </div>`;
}

function renderAccessCode(user) {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="access-card">
        <h2>🔐 输入入场码</h2>
        <p>你的账号尚未获得访问权限，请输入团队入场码</p>
        <div class="user-email">${user.photoURL?`<img class="user-avatar" src="${user.photoURL}" />`:''}${escHtml(user.email)}</div>
        <div class="form-group">
          <input class="form-control" id="access-input" type="password" placeholder="请输入入场码" />
          <div class="access-error" id="access-error"></div>
        </div>
        <button class="btn btn-primary" style="width:100%" onclick="handleAccessCode(document.getElementById('access-input').value)">确认进入</button>
        <div style="margin-top:16px;text-align:center"><button class="btn btn-secondary btn-sm" onclick="signOutUser()">切换账号</button></div>
      </div>
    </div>`;
  document.getElementById('access-input').addEventListener('keydown', e => { if (e.key==='Enter') handleAccessCode(e.target.value); });
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const tests = state.tests;
  const now = new Date();
  const thisMonth = tests.filter(t => { const d = new Date(t.startDate); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
  let totalV=0, appliedV=0;
  tests.forEach(t => (t.variants||[]).forEach((v,i) => { if(i===0)return; totalV++; if(v.applied)appliedV++; }));
  const rate = totalV>0 ? Math.round(appliedV/totalV*100) : 0;

  renderShell(`
    <div class="page-header"><div class="page-title">仪表盘</div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">总测试次数</div><div class="stat-value">${tests.length}</div><div class="stat-sub">所有项目累计</div></div>
      <div class="stat-card accent-blue"><div class="stat-label">本月测试</div><div class="stat-value">${thisMonth.length}</div><div class="stat-sub">${now.getMonth()+1} 月</div></div>
      <div class="stat-card accent-green"><div class="stat-label">累计应用</div><div class="stat-value">${appliedV}</div><div class="stat-sub">共 ${totalV} 个测试变体</div></div>
      <div class="stat-card accent-orange"><div class="stat-label">应用率</div><div class="stat-value">${rate}%</div><div class="stat-sub">测试变体应用比例</div></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card"><h3>📅 测试时间趋势（近12周）</h3><canvas id="ch-timeline"></canvas></div>
      <div class="chart-card"><h3>🥧 测试效果分布</h3><canvas id="ch-effects"></canvas></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card"><h3>👤 各测试人累计次数</h3><canvas id="ch-testers"></canvas></div>
      <div class="chart-card"><h3>📁 各项目测试次数</h3><canvas id="ch-projects"></canvas></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card"><h3>✅ 应用率（按项目）</h3><canvas id="ch-apply-rate"></canvas></div>
      <div class="chart-card"><h3>🏆 各测试人应用次数</h3><canvas id="ch-tester-apply"></canvas></div>
    </div>
  `, 'dashboard');
  setTimeout(() => initCharts(tests), 60);
}

function initCharts(tests) {
  const CLR = ['#4F6CF6','#7C3AED','#DB2777','#D97706','#059669','#0284C7','#DC2626','#4B5563','#0891B2','#65A30D'];

  // 1. Weekly trend
  const wLabels=[], wData=[];
  for (let i=11;i>=0;i--) {
    const d = new Date(); d.setDate(d.getDate()-i*7);
    const ws = new Date(d); ws.setDate(ws.getDate()-ws.getDay()); ws.setHours(0,0,0,0);
    const we = new Date(ws); we.setDate(we.getDate()+7);
    wLabels.push(`${ws.getMonth()+1}/${ws.getDate()}`);
    wData.push(tests.filter(t => { const td=new Date(t.startDate); return td>=ws&&td<we; }).length);
  }
  charts.timeline = new Chart(document.getElementById('ch-timeline'), {
    type:'line', data:{labels:wLabels,datasets:[{label:'次数',data:wData,borderColor:'#4F6CF6',backgroundColor:'rgba(79,108,246,.1)',fill:true,tension:.3,pointRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  });

  // 2. Effect distribution
  const EC={}, EL={great:'🏆 很好',good:'✅ 不错',neutral_p:'⚖️ 持平(+)',neutral_n:'⚖️ 持平(-)',bad:'📉 不好',empirical:'📈 经验'};
  const EBG={great:'#DCFCE7',good:'#D1FAE5',neutral_p:'#FEF3C7',neutral_n:'#F3F4F6',bad:'#FEE2E2',empirical:'#DBEAFE'};
  const EB={great:'#14532D',good:'#065F46',neutral_p:'#92400E',neutral_n:'#374151',bad:'#7F1D1D',empirical:'#1E3A8A'};
  tests.forEach(t=>(t.variants||[]).forEach((v,i)=>{ if(i===0)return; const e=v.effect||'empirical'; EC[e]=(EC[e]||0)+1; }));
  const eKeys=Object.keys(EC);
  charts.effects = new Chart(document.getElementById('ch-effects'), {
    type:'doughnut', data:{labels:eKeys.map(k=>EL[k]||k),datasets:[{data:eKeys.map(k=>EC[k]),backgroundColor:eKeys.map(k=>EBG[k]||'#ccc'),borderColor:eKeys.map(k=>EB[k]||'#999'),borderWidth:2}]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}
  });

  // 3. Tests per tester
  const TC={};
  tests.forEach(t=>{TC[t.tester]=(TC[t.tester]||0)+1;});
  const te=Object.entries(TC).sort((a,b)=>b[1]-a[1]);
  charts.testers = new Chart(document.getElementById('ch-testers'), {
    type:'bar', data:{labels:te.map(e=>e[0]),datasets:[{data:te.map(e=>e[1]),backgroundColor:CLR,borderRadius:6}]},
    options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}
  });

  // 4. Tests per project
  const PC={};
  tests.forEach(t=>{PC[t.projectName]=(PC[t.projectName]||0)+1;});
  const pe=Object.entries(PC).sort((a,b)=>b[1]-a[1]);
  charts.projects = new Chart(document.getElementById('ch-projects'), {
    type:'bar', data:{labels:pe.map(e=>e[0]),datasets:[{data:pe.map(e=>e[1]),backgroundColor:CLR,borderRadius:6}]},
    options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}
  });

  // 5. Apply rate per project
  const PA={};
  tests.forEach(t=>{
    if(!PA[t.projectName])PA[t.projectName]={total:0,applied:0};
    (t.variants||[]).forEach((v,i)=>{ if(i===0)return; PA[t.projectName].total++; if(v.applied)PA[t.projectName].applied++; });
  });
  const pae=Object.entries(PA).sort((a,b)=>b[1].total-a[1].total);
  charts.applyRate = new Chart(document.getElementById('ch-apply-rate'), {
    type:'bar',
    data:{labels:pae.map(e=>e[0]),datasets:[
      {label:'已应用',data:pae.map(e=>e[1].applied),backgroundColor:'#2E9E4F',borderRadius:4},
      {label:'未应用',data:pae.map(e=>e[1].total-e[1].applied),backgroundColor:'#E5E7EB',borderRadius:4}
    ]},
    options:{responsive:true,indexAxis:'y',plugins:{legend:{position:'bottom'}},scales:{x:{stacked:true,beginAtZero:true},y:{stacked:true}}}
  });

  // 6. Apply count per tester
  const TA={};
  tests.forEach(t=>{ if(!TA[t.tester])TA[t.tester]=0; (t.variants||[]).forEach((v,i)=>{if(i===0)return;if(v.applied)TA[t.tester]++;}); });
  const tae=Object.entries(TA).sort((a,b)=>b[1]-a[1]);
  charts.tApply = new Chart(document.getElementById('ch-tester-apply'), {
    type:'bar', data:{labels:tae.map(e=>e[0]),datasets:[{data:tae.map(e=>e[1]),backgroundColor:'#4F6CF6',borderRadius:6}]},
    options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}
  });
}

// ── Timeline ──────────────────────────────────────────────────
function renderTimeline() {
  const projOpts = state.projects.map(p=>`<option value="${p.id}" ${state.filterProject===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  let tests = state.filterProject==='all' ? state.tests : state.tests.filter(t=>t.projectId===state.filterProject);

  const body = tests.length===0
    ? `<div class="empty-state"><div class="empty-icon">🔍</div><p>暂无测试记录</p></div>`
    : `<div class="timeline">${tests.map(t=>buildTestCard(t)).join('')}</div>`;

  renderShell(`
    <div class="page-header"><div class="page-title">历史时间线</div></div>
    <div class="timeline-filters">
      <label style="font-size:13px;color:var(--text-muted);font-weight:600">筛选项目：</label>
      <select class="form-control" style="width:200px" onchange="filterTimeline(this.value)">
        <option value="all" ${state.filterProject==='all'?'selected':''}>全部项目</option>${projOpts}
      </select>
      <span style="font-size:12px;color:var(--text-muted)">共 ${tests.length} 条记录</span>
    </div>
    ${body}
  `, 'timeline');
}

function filterTimeline(val) { state.filterProject=val; renderTimeline(); }

function buildTestCard(t) {
  const vars = t.variants||[];
  const thumbs = vars.map((v,i)=>`
    <div class="variant-thumb-wrap">
      ${v.imageUrl ? `<img class="variant-thumb" src="${v.imageUrl}" onclick="openLightbox('${v.imageUrl}')" style="cursor:zoom-in"/>` : `<div class="variant-thumb-placeholder">🖼</div>`}
      <div class="variant-label">${i===0?'原始':`测试${i}`}</div>
    </div>`).join('');
  const badges = vars.map((v,i)=>i===0?'':effectBadgeHTML(v.effect||'empirical')).join(' ');
  const rows = vars.map((v,i)=>`
    <tr>
      <td><div class="variant-img-cell">${v.imageUrl?`<img src="${v.imageUrl}" onclick="openLightbox('${v.imageUrl}')" style="cursor:zoom-in"/>`:'<span style="font-size:18px">🖼</span>'}<span>${i===0?'🔵 原始':`🔴 测试${i}`}</span></div></td>
      <td>${v.firstInstalls??'-'}</td>
      <td>${(v.ciLower!==null&&v.ciLower!==''&&v.ciLower!==undefined)?`[${v.ciLower}%, ${v.ciUpper}%]`:(v.empiricalDelta!=null?`增幅 ${v.empiricalDelta}%`:'-')}</td>
      <td>${v.retainedInstalls??'-'}</td>
      <td>${i===0?'<span style="color:var(--text-muted)">基准</span>':effectBadgeHTML(v.effect||'empirical')}</td>
      <td>${i===0?'-':v.applied?'<span class="applied-yes">✓ 已应用</span>':'<span class="applied-no">未应用</span>'}</td>
    </tr>`).join('');

  return `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="test-card" id="card-${t.id}">
        <div class="test-card-header" onclick="toggleCard('${t.id}')">
          <div class="test-card-meta">
            <h3>${escHtml(t.projectName||'')} <span class="badge badge-blue">${escHtml(t.tester||'')}</span></h3>
            <div class="meta-row">
              <span class="meta-chip">📅 ${t.startDate||''} → ${t.endDate||''}</span>
              <span class="meta-chip">置信度 ${t.confidence}%</span>
              <span class="meta-chip">比例 ${escHtml(t.testRatio||'')}</span>
              ${t.biVizType?`<span class="bi-type-tag">${escHtml(t.biVizType)}</span>`:''}
            </div>
            <div class="meta-row" style="margin-top:6px">${badges}</div>
          </div>
          <div class="test-card-images">${thumbs}</div>
          <div class="test-card-expand"><span class="expand-icon">▼</span></div>
        </div>
        <div class="test-card-body">
          <table class="variants-table">
            <thead><tr><th>变体</th><th>首次安装数</th><th>置信区间</th><th>保留安装数</th><th>测试效果</th><th>是否应用</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">✏️ 编辑</button>
            ${state.userData?.isAdmin?`<button class="btn btn-danger btn-sm" onclick="deleteTestRecord('${t.id}')">🗑 删除</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

function toggleCard(id) { document.getElementById('card-'+id)?.classList.toggle('expanded'); }
function editTest(id) { state.editTestId=id; navigate('form'); }
async function deleteTestRecord(id) {
  if (!confirm('确认删除？此操作不可撤销。')) return;
  try { await deleteTest(id); toast('已删除','success'); } catch(e) { toast('删除失败：'+e.message,'error'); }
}

// ── Form ──────────────────────────────────────────────────────
const VDEFS = [
  {key:'control',label:'🔵 原始图（Control）',cls:'control'},
  {key:'test1',  label:'🔴 测试图 1',         cls:'test1'},
  {key:'test2',  label:'🟣 测试图 2',         cls:'test2'},
  {key:'test3',  label:'🩷 测试图 3',         cls:'test3'},
];
const BI_TYPES = ['折线图','柱状图','饼图','散点图','漏斗图','热力图','面积图','其他'];

function renderFormView() {
  const isEdit = !!state.editTestId;
  const test = isEdit ? state.tests.find(t=>t.id===state.editTestId) : null;

  // pre-fill image previews for edit
  if (test) test.variants?.forEach((v,i)=>{ if(v.imageUrl&&!formState.previews[i]) formState.previews[i]=v.imageUrl; });

  const projOpts = state.projects.map(p=>`<option value="${p.id}" data-name="${escHtml(p.name)}" ${test?.projectId===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const testerOpts = (state.settings?.testers||[]).map(n=>`<option value="${n}" ${(test?.tester===n||(!test&&n===state.userData?.name))?'selected':''}>${escHtml(n)}</option>`).join('');
  const confOpts = [90,95,98,99].map(v=>`<input type="radio" class="radio-option" name="conf" id="conf-${v}" value="${v}" ${(test?.confidence??95)==v?'checked':''}/><label class="radio-label" for="conf-${v}">${v}%</label>`).join('');
  const biOpts = BI_TYPES.map(b=>`<option value="${b}" ${test?.biVizType===b?'selected':''}>${b}</option>`).join('');
  const varHTML = VDEFS.map((_,i)=>buildVariantBlock(i, test?.variants?.[i]||{})).join('');

  renderShell(`
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>${isEdit?'✏️ 编辑测试记录':'＋ 新增测试记录'}</h2>
          <button class="modal-close" onclick="navigate('timeline')">✕</button>
        </div>
        <div class="modal-body">
          <form id="test-form" onsubmit="handleFormSubmit(event)">
            <div class="form-section">
              <div class="form-section-title">📋 基本信息</div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">项目名称</label><select class="form-control" id="f-project" required><option value="">选择项目…</option>${projOpts}</select></div>
                <div class="form-group"><label class="form-label">测试人</label><select class="form-control" id="f-tester" required>${testerOpts}</select></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">测试开始日期</label><input class="form-control" id="f-start" type="date" required value="${test?.startDate||''}"/></div>
                <div class="form-group"><label class="form-label">测试结束日期</label><input class="form-control" id="f-end" type="date" value="${test?.endDate||''}"/></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">置信度</label><div class="radio-group">${confOpts}</div></div>
                <div class="form-group"><label class="form-label">测试比例</label><input class="form-control" id="f-ratio" type="text" placeholder="如 25/25/25/25" value="${escHtml(test?.testRatio||'')}"/></div>
              </div>
              <div class="form-group"><label class="form-label">BI 可视化类型</label><select class="form-control" id="f-bitype"><option value="">不指定</option>${biOpts}</select></div>
            </div>
            <div class="form-section">
              <div class="form-section-title">🖼️ 变体数据</div>
              ${varHTML}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="navigate('timeline')">取消</button>
              <button type="submit" class="btn btn-primary" id="f-submit">${isEdit?'💾 保存修改':'🚀 提交记录'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>`, 'timeline');
}

function buildVariantBlock(i, v={}) {
  const d = VDEFS[i];
  const isCtrl = i===0;
  const isEmp = (!v.ciLower && !v.ciUpper && v.empiricalDelta!=null);
  const prevSrc = formState.previews[i];
  const imgHTML = prevSrc
    ? `<div class="img-preview-wrap"><img class="img-preview" src="${prevSrc}" onclick="openLightbox('${prevSrc}')" style="cursor:zoom-in"/><button type="button" class="img-remove" onclick="removeImg(${i})">✕</button></div>`
    : `<div class="img-upload-area" id="uarea-${i}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event,${i})"><span class="upload-icon">📤</span><span class="upload-hint">点击或拖拽上传</span><input type="file" accept="image/*" onchange="handleImgSelect(event,${i})"/></div>`;

  const ciHTML = `<div class="ci-group">
    <div class="form-group" style="margin-bottom:0"><label class="form-label">CI 下限 %</label><input class="form-control" id="v${i}_ciL" type="number" step="0.1" placeholder="-5.2" value="${v.ciLower??''}" oninput="updateBadge(${i})"/></div>
    <div class="form-group" style="margin-bottom:0"><label class="form-label">CI 上限 %</label><input class="form-control" id="v${i}_ciH" type="number" step="0.1" placeholder="10.8" value="${v.ciUpper??''}" oninput="updateBadge(${i})"/></div>
  </div>`;
  const empHTML = `<div><label class="form-label">增幅（无置信区间）%</label><input class="form-control" id="v${i}_delta" type="number" step="0.1" placeholder="5.3" value="${v.empiricalDelta??''}" oninput="updateBadge(${i})"/></div>`;

  return `
    <div class="variant-block ${d.cls}" id="vblock-${i}">
      <div class="variant-block-header">
        <span class="variant-block-title">${d.label}</span>
        <div style="display:flex;align-items:center;gap:10px">
          ${!isCtrl?`<button type="button" class="paste-btn" id="pbtn-${i}" onclick="activatePaste(${i})">📋 从 Play 提取</button>`:''}
          <span id="ebadge-${i}">${i>0?effectBadgeHTML(v.effect||calculateEffect(v.ciLower??null,v.ciUpper??null)):''}</span>
        </div>
      </div>
      <div class="form-row">
        <div>${imgHTML}</div>
        <div>
          <div class="form-group"><label class="form-label">首次安装数（调整）</label><input class="form-control" id="v${i}_fi" type="number" placeholder="12345" value="${v.firstInstalls??''}"/></div>
          <div class="form-group"><label class="form-label">保留安装数（调整）</label><input class="form-control" id="v${i}_ri" type="number" placeholder="8765" value="${v.retainedInstalls??''}"/></div>
        </div>
      </div>
      <div class="form-row" style="margin-top:10px">
        <div class="form-group" style="margin-bottom:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="form-label" style="margin-bottom:0">置信区间</label>
            ${!isCtrl?`<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="v${i}_emp" ${isEmp?'checked':''} onchange="toggleEmp(${i})"/> 经验决策（无区间）</label>`:''}
          </div>
          <div id="v${i}_ciwrap">${isCtrl?'<span style="font-size:12px;color:var(--text-muted)">原始图为基准，无需填写</span>':isEmp?empHTML:ciHTML}</div>
        </div>
        ${!isCtrl?`<div class="form-group" style="margin-bottom:0"><label class="form-label">是否应用</label><div class="toggle-wrap" style="margin-top:8px"><label class="toggle"><input type="checkbox" id="v${i}_applied" ${v.applied?'checked':''}/><span class="toggle-slider"></span></label><span class="toggle-label">应用此变体</span></div></div>`:''}
      </div>
    </div>`;
}

function activatePaste(i) {
  state.activeVariant = i;
  document.querySelectorAll('.paste-active-hint').forEach(el=>el.remove());
  const btn = document.getElementById(`pbtn-${i}`);
  if (btn) { const h=document.createElement('span'); h.className='paste-active-hint'; h.textContent='⌨️ 等待粘贴…'; btn.replaceWith(h); }
  toast('请到提取工具复制数据，然后 Ctrl+V 粘贴', 'info');
}

function toggleEmp(i) {
  const checked = document.getElementById(`v${i}_emp`).checked;
  const wrap = document.getElementById(`v${i}_ciwrap`);
  wrap.innerHTML = checked
    ? `<div><label class="form-label">增幅（无置信区间）%</label><input class="form-control" id="v${i}_delta" type="number" step="0.1" placeholder="5.3" oninput="updateBadge(${i})"/></div>`
    : `<div class="ci-group"><div class="form-group" style="margin-bottom:0"><label class="form-label">CI 下限 %</label><input class="form-control" id="v${i}_ciL" type="number" step="0.1" placeholder="-5.2" oninput="updateBadge(${i})"/></div><div class="form-group" style="margin-bottom:0"><label class="form-label">CI 上限 %</label><input class="form-control" id="v${i}_ciH" type="number" step="0.1" placeholder="10.8" oninput="updateBadge(${i})"/></div></div>`;
  updateBadge(i);
}

function updateBadge(i) {
  const badge = document.getElementById(`ebadge-${i}`); if(!badge||i===0) return;
  const emp = document.getElementById(`v${i}_emp`)?.checked;
  if (emp) { badge.innerHTML = effectBadgeHTML('empirical'); return; }
  const lo = document.getElementById(`v${i}_ciL`)?.value;
  const hi = document.getElementById(`v${i}_ciH`)?.value;
  badge.innerHTML = effectBadgeHTML(calculateEffect(lo!==''&&lo!=null?parseFloat(lo):null, hi!==''&&hi!=null?parseFloat(hi):null));
}

function handleImgSelect(e, i) {
  const file = e.target.files?.[0]; if(!file) return;
  formState.images[i] = file;
  const r = new FileReader(); r.onload = ev => showPreview(i, ev.target.result); r.readAsDataURL(file);
}
function handleDrop(e, i) {
  e.preventDefault(); document.getElementById(`uarea-${i}`)?.classList.remove('drag-over');
  const file = e.dataTransfer.files?.[0]; if(!file||!file.type.startsWith('image/')) return;
  formState.images[i] = file;
  const r = new FileReader(); r.onload = ev => showPreview(i, ev.target.result); r.readAsDataURL(file);
}
function showPreview(i, src) {
  formState.previews[i] = src;
  const area = document.getElementById(`uarea-${i}`); if(!area) return;
  const wrap = document.createElement('div'); wrap.className='img-preview-wrap';
  wrap.innerHTML = `<img class="img-preview" src="${src}" onclick="openLightbox('${src}')" style="cursor:zoom-in"/><button type="button" class="img-remove" onclick="removeImg(${i})">✕</button>`;
  area.replaceWith(wrap);
}
function removeImg(i) {
  formState.images[i]=null; formState.previews[i]=null;
  const wrap = document.querySelector(`#vblock-${i} .img-preview-wrap`); if(!wrap) return;
  const area = document.createElement('div'); area.className='img-upload-area'; area.id=`uarea-${i}`;
  area.setAttribute('ondragover',"event.preventDefault();this.classList.add('drag-over')");
  area.setAttribute('ondragleave',"this.classList.remove('drag-over')");
  area.setAttribute('ondrop',`handleDrop(event,${i})`);
  area.innerHTML=`<span class="upload-icon">📤</span><span class="upload-hint">点击或拖拽上传</span><input type="file" accept="image/*" onchange="handleImgSelect(event,${i})"/>`;
  wrap.replaceWith(area);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('f-submit');
  btn.disabled=true; btn.textContent='提交中…';
  try {
    const projEl = document.getElementById('f-project');
    const projectId = projEl.value;
    const projectName = projEl.options[projEl.selectedIndex]?.dataset.name||'';
    if (!projectId) { toast('请选择项目','error'); btn.disabled=false; btn.textContent=state.editTestId?'💾 保存修改':'🚀 提交记录'; return; }
    const tester = document.getElementById('f-tester').value;
    const startDate = document.getElementById('f-start').value;
    const endDate = document.getElementById('f-end').value;
    const confidence = Number(document.querySelector('input[name="conf"]:checked')?.value||95);
    const testRatio = document.getElementById('f-ratio').value;
    const biVizType = document.getElementById('f-bitype').value;
    const existV = state.editTestId ? (state.tests.find(t=>t.id===state.editTestId)?.variants||[]) : [];

    const variants = [];
    const docId = state.editTestId || `tmp_${Date.now()}`;
    for (let i=0;i<VDEFS.length;i++) {
      const fi=document.getElementById(`v${i}_fi`)?.value;
      const ri=document.getElementById(`v${i}_ri`)?.value;
      const emp=document.getElementById(`v${i}_emp`)?.checked;
      const ciL=emp?null:(document.getElementById(`v${i}_ciL`)?.value??null);
      const ciH=emp?null:(document.getElementById(`v${i}_ciH`)?.value??null);
      const delta=emp?(document.getElementById(`v${i}_delta`)?.value??null):null;
      const applied=i>0?(document.getElementById(`v${i}_applied`)?.checked||false):false;
      const effect=i===0?'control':calculateEffect(ciL!==''&&ciL!=null?parseFloat(ciL):null, ciH!==''&&ciH!=null?parseFloat(ciH):null);
      let imageUrl=existV[i]?.imageUrl||null;
      if (formState.images[i]) {
        const ref = storageRef(storage, `tests/${docId}/${i}_${Date.now()}`);
        await uploadBytes(ref, formState.images[i]);
        imageUrl = await getDownloadURL(ref);
      }
      variants.push({
        firstInstalls: fi!==''&&fi!=null?Number(fi):null,
        retainedInstalls: ri!==''&&ri!=null?Number(ri):null,
        ciLower: ciL!==''&&ciL!=null?parseFloat(ciL):null,
        ciUpper: ciH!==''&&ciH!=null?parseFloat(ciH):null,
        empiricalDelta: delta!==''&&delta!=null?parseFloat(delta):null,
        applied, effect, imageUrl,
      });
    }

    const data = {projectId,projectName,tester,startDate,endDate,confidence,testRatio,biVizType,variants};
    if (state.editTestId) { await updateTest(state.editTestId,data); toast('已保存修改','success'); }
    else { await createTest(data); toast('记录已提交','success'); }
    formState.images=[null,null,null,null]; formState.previews=[null,null,null,null];
    state.editTestId=null;
    navigate('timeline');
  } catch(err) { toast('提交失败：'+err.message,'error'); btn.disabled=false; btn.textContent=state.editTestId?'💾 保存修改':'🚀 提交记录'; }
}
// expose updateEffectBadge alias
function updateEffectBadge(i) { updateBadge(i); }

// ── Admin ─────────────────────────────────────────────────────
async function renderAdmin() {
  if (!state.userData?.isAdmin) { navigate('dashboard'); return; }
  const [settings, users, projects] = await Promise.all([getSettings(), getAllUsers(), getProjects()]);
  const code = settings?.accessCode || '—';
  const testers = settings?.testers || [];

  const usersHTML = users.map(u=>`
    <li>
      <span>${escHtml(u.name||u.email)}<span style="font-size:11px;color:var(--text-muted)"> (${escHtml(u.email)})</span>${u.isAdmin?'<span class="admin-badge">管理员</span>':''}</span>
      <div style="display:flex;gap:6px">
        ${!u.isAdmin?`<button class="btn btn-secondary btn-sm" onclick="makeAdmin('${u.id}')">设为管理员</button>`:''}
        ${u.id!==state.user.uid?`<button class="btn btn-danger btn-sm" onclick="revokeUser('${u.id}','${escHtml(u.email)}')">移除</button>`:''}
      </div>
    </li>`).join('');
  const projHTML = projects.map(p=>`<li><span>${escHtml(p.name)}</span><button class="btn btn-danger btn-sm" onclick="removeProject('${p.id}')">移除</button></li>`).join('');
  const testHTML = testers.map(n=>`<li><span>${escHtml(n)}</span><button class="btn btn-danger btn-sm" onclick="removeTesterItem('${escHtml(n)}')">移除</button></li>`).join('');

  renderShell(`
    <div class="page-header"><div class="page-title">⚙️ 管理面板</div></div>
    <div class="admin-grid">
      <div class="admin-card" style="grid-column:1/-1">
        <h3>🔐 入场码</h3>
        <div class="access-code-display" id="code-display">${escHtml(code)}</div>
        <div class="add-row"><input class="form-control" id="new-code" type="text" placeholder="输入新入场码…"/><button class="btn btn-primary" onclick="changeCode()">修改入场码</button></div>
      </div>
      <div class="admin-card">
        <h3>👥 团队成员</h3>
        <ul class="admin-list">${usersHTML||'<li style="color:var(--text-muted)">暂无</li>'}</ul>
      </div>
      <div class="admin-card">
        <h3>🧑‍💻 测试人员名单</h3>
        <ul class="admin-list">${testHTML||'<li style="color:var(--text-muted)">暂无</li>'}</ul>
        <div class="add-row"><input class="form-control" id="add-tester" type="text" placeholder="添加测试人…"/><button class="btn btn-primary" onclick="addTesterItem()">添加</button></div>
      </div>
      <div class="admin-card" style="grid-column:1/-1">
        <h3>📁 项目管理</h3>
        <ul class="admin-list">${projHTML||'<li style="color:var(--text-muted)">暂无项目</li>'}</ul>
        <div class="add-row"><input class="form-control" id="add-proj" type="text" placeholder="新项目名称…"/><button class="btn btn-primary" onclick="addProjectItem()">添加项目</button></div>
      </div>
    </div>`, 'admin');
}

async function changeCode() {
  const code = document.getElementById('new-code').value.trim();
  if (!code) { toast('请输入新入场码','error'); return; }
  await updateSettings({accessCode:code});
  document.getElementById('code-display').textContent = code;
  document.getElementById('new-code').value = '';
  toast('入场码已更新','success');
}
async function makeAdmin(uid) { await updateUser(uid,{isAdmin:true}); toast('已设为管理员','success'); renderAdmin(); }
async function revokeUser(uid, email) {
  if (!confirm(`确认移除 ${email} 的访问权限？`)) return;
  await updateUser(uid,{approved:false});
  const s = await getSettings();
  await updateSettings({allowlist:(s?.allowlist||[]).filter(e=>e!==email)});
  toast('已移除访问权限','success'); renderAdmin();
}
async function addProjectItem() {
  const n = document.getElementById('add-proj').value.trim(); if(!n) return;
  await addProject(n); document.getElementById('add-proj').value='';
  toast('项目已添加','success'); renderAdmin();
}
async function removeProject(id) {
  if (!confirm('确认删除此项目？')) return;
  await deleteProject(id); toast('已删除项目','success'); renderAdmin();
}
async function addTesterItem() {
  const n = document.getElementById('add-tester').value.trim(); if(!n) return;
  await addTester(n); document.getElementById('add-tester').value='';
  state.settings = await getSettings(); toast('测试人员已添加','success'); renderAdmin();
}
async function removeTesterItem(name) {
  if (!confirm(`确认移除 ${name}？`)) return;
  await removeTester(name); state.settings=await getSettings(); toast('已移除','success'); renderAdmin();
}

// ── Expose globals (needed for inline onclick) ────────────────
Object.assign(window, {
  navigate, filterTimeline, toggleCard, editTest, deleteTestRecord,
  signInWithGoogle, signOutUser, handleAccessCode,
  handleFormSubmit, handleImgSelect, handleDrop, removeImg,
  activatePaste, toggleEmp, updateBadge, updateEffectBadge, openLightbox,
  changeCode, makeAdmin, revokeUser,
  addProjectItem, removeProject, addTesterItem, removeTesterItem,
});
