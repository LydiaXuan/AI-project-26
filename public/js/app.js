// ================================================================
// app.js  –  图测记录工具
// ================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { FIREBASE_CONFIG, SUPER_ADMIN_EMAIL } from './config.js';
import { calculateEffect, effectBadgeHTML, EFFECT_OPTIONS, EFFECT } from './effects.js';
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
initDB(firebaseApp);

// 客户端图片压缩（存 base64，无需 Storage）
function compressImage(file, maxPx = 480, quality = 0.72) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });
}

// ── State ─────────────────────────────────────────────────────
const state = {
  user: null, userData: null, settings: null,
  view: 'dashboard', tests: [], projects: [],
  filterProject: 'all', filterEffect: 'all', filterBiType: 'all',
  filterExpType: 'all', filterVarCount: 'all', sortOrder: 'desc', searchQuery: '',
  editTestId: null, activeVariant: null, activeImgVariant: null, formType: 'test',
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
let _searchTimer = null;

document.addEventListener('paste', e => {
  const clipData = e.clipboardData || window.clipboardData;

  // Image paste
  const imgItem = [...(clipData?.items || [])].find(it => it.type.startsWith('image/'));
  if (imgItem) {
    const isTextField = ['INPUT','TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable;
    if (!isTextField) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (!file) return;
      // Crop modal open → paste into crop area
      if (document.getElementById('crop-wrap')) {
        cropFromFile(file);
        toast('图片已粘贴到裁剪区', 'success');
        return;
      }
      // Form open + zone hovered/clicked → paste to that specific zone
      if (state.view === 'form' && state.activeImgVariant !== null) {
        const vi = state.activeImgVariant;
        formState.images[vi] = file;
        const r = new FileReader();
        r.onload = ev => showPreview(vi, ev.target.result);
        r.readAsDataURL(file);
        state.activeImgVariant = null;
        toast(`图片已粘贴到${vi === 0 ? '原始' : `测试${vi}`}`, 'success');
        return;
      }
      // No target — do nothing
    }
  }

  // GPLAY| text paste
  const text = clipData?.getData('text') || '';
  if (!text.startsWith('GPLAY|')) return;
  e.preventDefault();
  const data = parsePaste(text);
  if (!data) return;
  if (state.activeVariant === null) { toast('请先点击某个变体的「粘贴 Play 数据」按钮', 'info'); return; }
  const i = state.activeVariant;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) { el.value = val; el.dispatchEvent(new Event('input')); } };
  setVal(`v${i}_fi`, data.fi); setVal(`v${i}_ciL`, data.ciL); setVal(`v${i}_ciH`, data.ciH); setVal(`v${i}_ri`, data.ri);
  if (data.ciL !== undefined && data.ciH !== undefined) updateEffectSelect(i);
  state.activeVariant = null;
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
  if (view !== 'form') { state.editTestId = null; state.formType = 'test'; formState.images = [null,null,null,null]; formState.previews = [null,null,null,null]; }
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
  const adminBtn = `<button class="nav-tab${activeTab==='admin'?' active':''}" onclick="navigate('admin')">⚙️ 管理</button>`;
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
  const EC={}, EL={superb:'🏆 很好',good:'👍 不错',bad:'❌ 很差',neutral_p:'➖ 持平(+)',neutral_n:'➖ 持平(-)',empirical_p:'📈 经验(+)',empirical_n:'📈 经验(-)',great:'🏆 很好',empirical:'📈 经验'};
  const EBG={superb:'#DCFCE7',good:'#D1FAE5',neutral_p:'#FEF3C7',neutral_n:'#F3F4F6',bad:'#FEE2E2',empirical_p:'#DBEAFE',empirical_n:'#EEF2FF',great:'#DCFCE7',empirical:'#DBEAFE'};
  const EB={superb:'#14532D',good:'#065F46',neutral_p:'#92400E',neutral_n:'#374151',bad:'#7F1D1D',empirical_p:'#1E3A8A',empirical_n:'#3730A3',great:'#14532D',empirical:'#1E3A8A'};
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
const BI_TYPE_OPTS = ['icon','五图','置顶','视频'];

function renderTimeline() {
  const projOpts = state.projects.map(p=>`<option value="${p.id}" ${state.filterProject===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const expTypes = state.settings?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;

  const TL_EFFECT_OPTS = [
    {val:'all',       label:'全部表现'},
    {val:'superb',    label:'🏆 很好'},
    {val:'good',      label:'👍 不错'},
    {val:'bad',       label:'❌ 很差'},
    {val:'neutral_p', label:'➖ 持平(+)'},
    {val:'neutral_n', label:'➖ 持平(-)'},
    {val:'empirical_p',label:'📈 经验决策(+)'},
    {val:'empirical_n',label:'📈 经验决策(-)'},
  ];
  const effectOpts = TL_EFFECT_OPTS.map(o=>`<option value="${o.val}" ${state.filterEffect===o.val?'selected':''}>${o.label}</option>`).join('');
  const biTypeOpts = [`<option value="all" ${state.filterBiType==='all'?'selected':''}>全部截图类型</option>`,
    ...BI_TYPE_OPTS.map(b=>`<option value="${b}" ${state.filterBiType===b?'selected':''}>${b}</option>`)
  ].join('');
  const expTypeOpts = [`<option value="all" ${state.filterExpType==='all'?'selected':''}>全部实验类型</option>`,
    ...expTypes.map(b=>`<option value="${b}" ${state.filterExpType===b?'selected':''}>${escHtml(b)}</option>`)
  ].join('');

  // Apply filters
  let tests = [...state.tests];
  if (state.filterProject !== 'all') tests = tests.filter(t=>t.projectId===state.filterProject);
  if (state.filterEffect !== 'all') tests = tests.filter(t=>t.type!=='update'&&(t.variants||[]).some((v,i)=>i>0&&(v.effect===state.filterEffect||(state.filterEffect==='superb'&&v.effect==='great'))));
  if (state.filterBiType !== 'all') tests = tests.filter(t=>{ const bt=Array.isArray(t.biVizType)?t.biVizType:(t.biVizType?[t.biVizType]:[]); return bt.includes(state.filterBiType); });
  if (state.filterExpType !== 'all') tests = tests.filter(t=>t.experimentType===state.filterExpType);
  if (state.filterVarCount !== 'all') {
    const need = parseInt(state.filterVarCount);
    tests = tests.filter(t=>{
      if (t.type === 'update') return false;
      const active = (t.variants||[]).filter((v,i)=>i===0||(v.imageUrl||v.firstInstalls!=null)).length;
      return active === need;
    });
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tests = tests.filter(t=>
      t.projectName?.toLowerCase().includes(q)||
      t.tester?.toLowerCase().includes(q)||
      t.notes?.change?.toLowerCase().includes(q)||
      t.notes?.purpose?.toLowerCase().includes(q)||
      t.notes?.design?.toLowerCase().includes(q)||
      t.conclusion?.toLowerCase().includes(q)
    );
  }
  const dateOf = t => t.type==='update' ? (t.updateDate||'') : (t.startDate||'');
  tests.sort((a,b)=>state.sortOrder==='desc'
    ? new Date(dateOf(b))-new Date(dateOf(a))
    : new Date(dateOf(a))-new Date(dateOf(b))
  );

  const activeFilters = [
    state.filterProject!=='all', state.filterEffect!=='all',
    state.filterBiType!=='all', state.filterExpType!=='all',
    state.filterVarCount!=='all', !!state.searchQuery
  ].filter(Boolean).length;

  const body = tests.length===0
    ? `<div class="empty-state"><div class="empty-icon">🔍</div><p>暂无匹配记录</p><button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="resetTimelineFilters()">清除筛选</button></div>`
    : `<div class="timeline">${tests.map(t=>t.type==='update'?buildUpdateCard(t):buildTestCard(t)).join('')}</div>`;

  renderShell(`
    <div class="page-header">
      <div class="page-title">历史时间线</div>
      <span class="tl-count-badge">${tests.length} / ${state.tests.length} 条记录</span>
    </div>
    <div class="tl-filter-bar">
      <div class="tl-filter-row">
        <select class="form-control tl-select" id="tl-sort" onchange="applyTimelineFilters()">
          <option value="desc" ${state.sortOrder==='desc'?'selected':''}>⬇ 最新优先</option>
          <option value="asc" ${state.sortOrder==='asc'?'selected':''}>⬆ 最早优先</option>
        </select>
        <select class="form-control tl-select" id="tl-project" onchange="applyTimelineFilters()">
          <option value="all" ${state.filterProject==='all'?'selected':''}>全部项目</option>${projOpts}
        </select>
        <select class="form-control tl-select" id="tl-varcount" onchange="applyTimelineFilters()">
          <option value="all" ${state.filterVarCount==='all'?'selected':''}>全部测试组数</option>
          <option value="2" ${state.filterVarCount==='2'?'selected':''}>A/B 两组</option>
          <option value="3" ${state.filterVarCount==='3'?'selected':''}>A/B/C 三组</option>
          <option value="4" ${state.filterVarCount==='4'?'selected':''}>四组测试</option>
        </select>
        <select class="form-control tl-select" id="tl-exptype" onchange="applyTimelineFilters()">
          ${expTypeOpts}
        </select>
        <select class="form-control tl-select" id="tl-effect" onchange="applyTimelineFilters()">
          ${effectOpts}
        </select>
        <select class="form-control tl-select" id="tl-bitype" onchange="applyTimelineFilters()">
          ${biTypeOpts}
        </select>
        <input class="form-control tl-search" id="tl-search" type="search" placeholder="🔍 搜索项目、备注、测试人…" value="${escHtml(state.searchQuery)}" oninput="onSearchInput(this.value)"/>
        ${activeFilters>0?`<button class="btn btn-secondary btn-sm tl-reset" onclick="resetTimelineFilters()">重置 (${activeFilters})</button>`:''}
      </div>
    </div>
    ${body}
  `, 'timeline');
}

function onSearchInput(val) {
  state.searchQuery = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { if (state.view === 'timeline') renderTimeline(); }, 350);
}

function applyTimelineFilters() {
  state.sortOrder     = document.getElementById('tl-sort')?.value     || 'desc';
  state.filterProject = document.getElementById('tl-project')?.value  || 'all';
  state.filterVarCount= document.getElementById('tl-varcount')?.value || 'all';
  state.filterExpType = document.getElementById('tl-exptype')?.value  || 'all';
  state.filterEffect  = document.getElementById('tl-effect')?.value   || 'all';
  state.filterBiType  = document.getElementById('tl-bitype')?.value   || 'all';
  renderTimeline();
}
function resetTimelineFilters() {
  state.sortOrder='desc'; state.filterProject='all'; state.filterEffect='all';
  state.filterBiType='all'; state.filterExpType='all'; state.filterVarCount='all'; state.searchQuery='';
  renderTimeline();
}
function filterTimeline(val) { state.filterProject=val; renderTimeline(); }

function buildTestCard(t) {
  const vars = t.variants||[];
  const biTypes = Array.isArray(t.biVizType) ? t.biVizType : (t.biVizType ? [t.biVizType] : []);
  const effectScore = {superb:7,good:6,neutral_p:5,neutral_n:4,empirical_p:3,empirical_n:2,bad:1,control:0,great:7,empirical:3};
  const testVars = vars.filter((_,i)=>i>0);
  const bestFI = testVars.length ? Math.max(...testVars.map(v=>v.firstInstalls||0)) : 0;
  const bestRI = testVars.length ? Math.max(...testVars.map(v=>v.retainedInstalls||0)) : 0;
  const normEffect = e => e==='great'?'superb':e==='empirical'?'empirical_p':e||'empirical_n';
  const bestEffectScore = testVars.reduce((m,v)=>Math.max(m, effectScore[normEffect(v.effect)]||0), 0);

  const appliedIdx = vars.findIndex((v,i)=>i>0&&v.applied);
  const appliedVar = appliedIdx>=0 ? vars[appliedIdx] : null;
  const anyApplied = appliedVar !== null;

  const appliedChip = anyApplied
    ? `<span class="applied-chip">✓ 测试${appliedIdx} 已采用</span>`
    : `<span class="not-applied-chip">暂未应用</span>`;

  const thumbs = vars.map((v,i)=>`
    <div class="variant-thumb-wrap">
      ${v.imageUrl ? `<img class="variant-thumb${v.applied?' applied-thumb':''}" src="${v.imageUrl}" onclick="event.stopPropagation();openLightbox('${v.imageUrl}')" style="cursor:zoom-in"/>` : `<div class="variant-thumb-placeholder">🖼</div>`}
      ${v.applied ? '<div class="thumb-applied-label">✓ 采用</div>' : ''}
      <div class="variant-label">${i===0?'原始':`测试${i}`}</div>
    </div>`).join('');

  const bigThumbs = vars.filter(v=>v.imageUrl).map((v,i)=>`
    <div class="variant-thumb-wrap">
      <img class="variant-thumb-lg${v.applied?' applied-thumb':''}" src="${v.imageUrl}" onclick="event.stopPropagation();openLightbox('${v.imageUrl}')" style="cursor:zoom-in"/>
      ${v.applied ? '<div class="thumb-applied-label">✓ 采用</div>' : ''}
      <div class="variant-label">${vars.indexOf(v)===0?'原始':`测试${vars.indexOf(v)}`}</div>
    </div>`).join('');

  const badges = vars.map((v,i)=>i===0?'':effectBadgeHTML(normEffect(v.effect))).join(' ');

  const rows = vars.map((v,i)=>{
    const isBestFI = i>0 && bestFI>0 && v.firstInstalls===bestFI;
    const isBestRI = i>0 && bestRI>0 && v.retainedInstalls===bestRI;
    const isBestEffect = i>0 && bestEffectScore>0 && (effectScore[normEffect(v.effect)]||0)===bestEffectScore;
    return `
    <tr${v.applied&&i>0?' class="applied-row"':''}>
      <td><div class="variant-img-cell">${v.imageUrl?`<img src="${v.imageUrl}" onclick="openLightbox('${v.imageUrl}')" style="cursor:zoom-in"/>`:'<span style="font-size:18px">🖼</span>'}<span>${i===0?'🔵 原始':`🔴 测试${i}`}${v.applied?' 🏳️':''}</span></div></td>
      <td>${v.firstInstalls??'-'}${isBestFI?'<span class="best-tag">🥇</span>':''}</td>
      <td>${(v.ciLower!==null&&v.ciLower!==''&&v.ciLower!==undefined)?`[${v.ciLower}%, ${v.ciUpper}%]`:'-'}</td>
      <td>${v.retainedInstalls??'-'}${isBestRI?'<span class="best-tag">🥇</span>':''}</td>
      <td>${i===0?'<span style="color:var(--text-muted)">基准</span>':effectBadgeHTML(normEffect(v.effect))}${isBestEffect&&i>0?'<span class="best-tag">⭐</span>':''}</td>
      <td>${i===0?'-':v.applied?'<span class="applied-yes">✓ 已应用</span>':'<span class="applied-no">未应用</span>'}</td>
    </tr>`;
  }).join('');

  const adoptedSection = appliedVar ? `
    <div class="adopted-section">
      <div class="adopted-header">当前最终采用版本</div>
      <div class="adopted-body">
        ${appliedVar.imageUrl ? `<img class="adopted-img" src="${appliedVar.imageUrl}" onclick="openLightbox('${appliedVar.imageUrl}')" style="cursor:zoom-in"/>` : '<div class="adopted-img-ph">🖼</div>'}
        <div class="adopted-meta">
          <div class="adopted-name">测试 ${appliedIdx} ${effectBadgeHTML(normEffect(appliedVar.effect))}</div>
          <div class="adopted-stats">
            ${appliedVar.firstInstalls!=null?`<span class="a-stat">首次安装 <strong>${appliedVar.firstInstalls}</strong></span>`:''}
            ${appliedVar.retainedInstalls!=null?`<span class="a-stat">保留安装 <strong>${appliedVar.retainedInstalls}</strong></span>`:''}
            ${appliedVar.ciLower!=null?`<span class="a-stat">CI <strong>[${appliedVar.ciLower}%, ${appliedVar.ciUpper}%]</strong></span>`:''}
          </div>
        </div>
      </div>
    </div>` : '';

  const conclusionBlock = t.conclusion ? `
    <div class="conc-block conc-manual">
      <div class="conc-title">📝 实验小结</div>
      <div class="conc-body">${escHtml(t.conclusion)}</div>
    </div>` : '';

  return `
    <div class="timeline-item">
      <div class="timeline-dot${anyApplied?' dot-applied':''}"></div>
      <div class="test-card${anyApplied?' has-applied':''}" id="card-${t.id}">
        <div class="test-card-header" onclick="toggleCard('${t.id}')">
          <div class="test-card-meta">
            <div class="card-title-row">
              <h3>${escHtml(t.projectName||'')} <span class="badge badge-blue">${escHtml(t.tester||'')}</span></h3>
              ${appliedChip}
            </div>
            <div class="meta-row">
              <span class="meta-chip">📅 ${t.startDate||''} → ${t.endDate||''}</span>
              <span class="meta-chip">置信度 ${t.confidence}%</span>
              ${t.testRatio?`<span class="meta-chip">比例 ${escHtml(t.testRatio)}</span>`:''}
              ${t.experimentType?`<span class="bi-type-tag">${escHtml(t.experimentType)}</span>`:''}
              ${biTypes.map(b=>`<span class="bi-type-tag">${escHtml(b)}</span>`).join('')}
            </div>
            <div class="meta-row" style="margin-top:6px">${badges}</div>
            ${t.notes?.change?`<div class="card-note-preview">💬 ${escHtml(t.notes.change)}</div>`:''}
          </div>
          <div class="test-card-images">${thumbs}</div>
          <div class="test-card-expand"><span class="expand-icon">▼</span></div>
        </div>
        <div class="test-card-body">
          ${adoptedSection}
          ${buildProgressBlock(t)}
          ${bigThumbs ? `<div class="big-thumbs-row">${bigThumbs}</div>` : ''}
          <div class="data-cmp-title">📊 实验数据对比</div>
          <table class="variants-table">
            <thead><tr><th>变体</th><th>首次安装数</th><th>置信区间</th><th>保留安装数</th><th>测试效果</th><th>是否应用</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${conclusionBlock}
          ${t.notes?.change||t.notes?.purpose||t.notes?.design?`
          <div class="card-notes">
            ${t.notes.change?`<div class="note-row"><span class="note-tag">改动</span><span>${escHtml(t.notes.change)}</span></div>`:''}
            ${t.notes.purpose?`<div class="note-row"><span class="note-tag">目的</span><span>${escHtml(t.notes.purpose)}</span></div>`:''}
            ${t.notes.design?`<div class="note-row"><span class="note-tag">思路</span><span>${escHtml(t.notes.design)}</span></div>`:''}
          </div>`:''}
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">✏️ 编辑</button>
            ${state.userData?.isAdmin?`<button class="btn btn-danger btn-sm" onclick="deleteTestRecord('${t.id}')">🗑 删除</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

function buildProgressBlock(t) {
  if (!t.startDate) return '';
  const start = new Date(t.startDate);
  const end = t.endDate ? new Date(t.endDate) : new Date();
  const days = Math.max(0, Math.round((end - start) / 86400000));
  let statusLabel, progressCls, rec;
  if (days < 7) { statusLabel='⚡ 早期阶段'; progressCls='prog-early'; rec='数据量可能不足，建议继续观察至少 7 天'; }
  else if (days < 14) { statusLabel='🔄 进行中'; progressCls='prog-mid'; rec='数据趋于稳定，可结合效果指标判断'; }
  else { statusLabel='✅ 数据成熟'; progressCls='prog-done'; rec='运行时间充足，结论可靠性高'; }
  const pct = Math.min(100, Math.round(days / 21 * 100));
  return `<div class="prog-block">
    <div class="prog-header"><span class="${progressCls}">${statusLabel}</span><span class="prog-days">运行 ${days} 天${t.endDate?'（已结束）':'（进行中）'}</span></div>
    <div class="prog-bar-track"><div class="prog-bar-fill ${progressCls}" style="width:${pct}%"></div></div>
    <div class="prog-rec">${rec}</div>
  </div>`;
}


function buildUpdateCard(t) {
  const biTypes = Array.isArray(t.biVizType) ? t.biVizType : (t.biVizType ? [t.biVizType] : []);
  const imgHtml = t.imageUrl
    ? `<img class="variant-thumb" src="${t.imageUrl}" onclick="event.stopPropagation();openLightbox('${t.imageUrl}')" style="cursor:zoom-in"/>`
    : `<div class="variant-thumb-placeholder">🖼</div>`;
  return `
    <div class="timeline-item">
      <div class="timeline-dot dot-update"></div>
      <div class="test-card is-update" id="card-${t.id}">
        <div class="test-card-header" onclick="toggleCard('${t.id}')">
          <div class="test-card-meta">
            <div class="card-title-row">
              <h3>${escHtml(t.projectName||'')} <span class="badge badge-orange">🔄 直接更新</span> <span class="badge badge-blue">${escHtml(t.tester||'')}</span></h3>
            </div>
            <div class="meta-row">
              <span class="meta-chip">📅 ${t.updateDate||''}</span>
              ${biTypes.map(b=>`<span class="bi-type-tag">${escHtml(b)}</span>`).join('')}
            </div>
            ${t.notes?.change?`<div class="card-note-preview">💬 ${escHtml(t.notes.change)}</div>`:''}
          </div>
          <div class="test-card-images"><div class="variant-thumb-wrap">${imgHtml}</div></div>
          <div class="test-card-expand"><span class="expand-icon">▼</span></div>
        </div>
        <div class="test-card-body">
          ${t.imageUrl?`<div class="big-thumbs-row"><div class="variant-thumb-wrap"><img class="variant-thumb-lg" src="${t.imageUrl}" onclick="openLightbox('${t.imageUrl}')" style="cursor:zoom-in"/></div></div>`:''}
          ${t.notes?.change?`<div class="card-notes"><div class="note-row"><span class="note-tag">改动</span><span>${escHtml(t.notes.change)}</span></div></div>`:''}
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">✏️ 编辑</button>
            ${state.userData?.isAdmin?`<button class="btn btn-danger btn-sm" onclick="deleteTestRecord('${t.id}')">🗑 删除</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

function toggleCard(id) { document.getElementById('card-'+id)?.classList.toggle('expanded'); }
function editTest(id) { const t=state.tests.find(tt=>tt.id===id); state.formType=t?.type==='update'?'update':'test'; state.editTestId=id; navigate('form'); }
async function deleteTestRecord(id) {
  if (!confirm('确认删除？此操作不可撤销。')) return;
  try { await deleteTest(id); toast('已删除','success'); } catch(e) { toast('删除失败：'+e.message,'error'); }
}

// ── Form ──────────────────────────────────────────────────────
const VDEFS = [
  {key:'control',label:'🔵 原始',cls:'ctrl'},
  {key:'test1',  label:'🔴 测试1',cls:'t1'},
  {key:'test2',  label:'🟣 测试2',cls:'t2'},
  {key:'test3',  label:'🩷 测试3',cls:'t3'},
];
const BI_TYPES = ['icon','五图','置顶','视频'];
const RATIO_PRESETS = ['50/50','33/33/33','25/25/25/25','20/20/20/20/20','25/75','10/90'];
const DEFAULT_EXPERIMENT_TYPES = ['自定义商品详情','主要商品详情','本地化 VN','本地化 ID','本地化 US','本地化 JP','本地化 KR','本地化 BR','本地化 IN'];
function handleRatioChange(val) {
  const inp = document.getElementById('f-ratio');
  if (!inp) return;
  inp.style.display = val === 'custom' ? 'block' : 'none';
}

const VC_STYLES = [
  {bg:'#F3F4F6',border:'#9CA3AF',color:'#374151'},
  {bg:'#EFF6FF',border:'#3B82F6',color:'#1D4ED8'},
  {bg:'#F5F3FF',border:'#8B5CF6',color:'#6D28D9'},
  {bg:'#FDF2F8',border:'#EC4899',color:'#BE185D'},
];

function buildVariantCol(i, test) {
  const v = test?.variants?.[i] || {};
  const st = VC_STYLES[i];
  const label = VDEFS[i].label;

  const hasImg = !!(v.imageUrl || formState.previews[i]);
  let statusLabel, statusCls;
  if (i > 0 && v.applied)   { statusLabel='当前应用中'; statusCls='vs-applied'; }
  else if (!hasImg)          { statusLabel='未上传';    statusCls='vs-empty'; }
  else if (v.firstInstalls != null && (i===0 || v.ciLower != null))
                             { statusLabel='数据已填写'; statusCls='vs-complete'; }
  else                       { statusLabel='已上传';    statusCls='vs-uploaded'; }

  const ciBlock = i === 0 ? '' : `
    <div class="vc-field-group">
      <div class="vc-field-label">置信区间下限 / 上限 %</div>
      <div class="ci-pair">
        <input class="form-control" id="v${i}_ciL" type="number" step="0.1" placeholder="下限%" value="${v.ciLower??''}" oninput="updateEffectSelect(${i})"/>
        <input class="form-control" id="v${i}_ciH" type="number" step="0.1" placeholder="上限%" value="${v.ciUpper??''}" oninput="updateEffectSelect(${i})"/>
      </div>
    </div>`;

  const appliedBlock = i === 0 ? '' : `
    <div class="vc-field-group vc-applied-field">
      <div class="vc-field-label">是否应用</div>
      <label class="toggle"><input type="checkbox" id="v${i}_applied" ${v.applied?'checked':''}/><span class="toggle-slider"></span></label>
    </div>`;

  const savedEffect = v.effect && v.effect !== 'control' ? v.effect : '';
  const effectSelectOpts = EFFECT_OPTIONS.map(o=>`<option value="${o.val}" ${savedEffect===o.val?'selected':''}>${o.label}</option>`).join('');
  const effectBlock = i === 0 ? '' : `
    <div class="vc-field-group">
      <div class="vc-field-label">测试效果</div>
      <select class="form-control" id="eselect-${i}" style="font-size:12px">${effectSelectOpts}</select>
    </div>`;

  return `
    <div class="variant-col" data-vi="${i}">
      <div class="vc-header" style="background:${st.bg};border-bottom:2px solid ${st.border};color:${st.color}">
        <span class="vc-label">${label}</span>
        <span class="variant-status ${statusCls}">${statusLabel}</span>
      </div>
      <div class="vc-img-zone" onmouseenter="setActiveImgZone(${i})" onmouseleave="clearActiveImgZone()" onclick="setActiveImgZone(${i})">
        ${buildImgCell(i, v)}
      </div>
      <div class="vc-data">
        <div class="vc-field-group">
          <div class="vc-field-label">首次安装数（调整）</div>
          <input class="form-control" id="v${i}_fi" type="number" placeholder="—" value="${v.firstInstalls??''}" oninput="updateEffectSelect(${i})"/>
        </div>
        ${ciBlock}
        <div class="vc-field-group">
          <div class="vc-field-label">保留安装数（调整）</div>
          <input class="form-control" id="v${i}_ri" type="number" placeholder="—" value="${v.retainedInstalls??''}"/>
        </div>
        ${appliedBlock}
        ${effectBlock}
      </div>
    </div>`;
}

function renderFormView() {
  const isEdit = !!state.editTestId;
  const test = isEdit ? state.tests.find(t=>t.id===state.editTestId) : null;
  const ft = state.formType || 'test';

  if (test && ft === 'test') test.variants?.forEach((v,i)=>{ if(v.imageUrl&&!formState.previews[i]) formState.previews[i]=v.imageUrl; });
  if (test && ft === 'update' && test.imageUrl && !formState.previews[0]) formState.previews[0] = test.imageUrl;

  const projOpts = state.projects.map(p=>`<option value="${p.id}" data-name="${escHtml(p.name)}" ${test?.projectId===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const testerOpts = (state.settings?.testers||[]).map(n=>`<option value="${n}" ${(test?.tester===n||(!test&&n===state.userData?.name))?'selected':''}>${escHtml(n)}</option>`).join('');

  const currentBiTypes = Array.isArray(test?.biVizType) ? test.biVizType : (test?.biVizType ? [test.biVizType] : []);
  const biCheckboxes = BI_TYPES.map(b=>`<label class="checkbox-label"><input type="checkbox" id="f-bitype-${b}" value="${b}" ${currentBiTypes.includes(b)?'checked':''}/><span>${b}</span></label>`).join('');

  const typeToggle = `
    <div class="form-type-toggle">
      <button type="button" class="type-btn${ft==='test'?' active':''}" onclick="switchFormType('test')">A/B 测试</button>
      <button type="button" class="type-btn${ft==='update'?' active':''}" onclick="switchFormType('update')">直接更新</button>
    </div>`;

  let formBody;
  if (ft === 'update') {
    formBody = `
      <div class="form-section">
        <div class="form-section-title">📋 基本信息</div>
        <div class="form-row-4">
          <div class="form-group"><label class="form-label">项目</label><select class="form-control" id="f-project" required><option value="">选择项目…</option>${projOpts}</select></div>
          <div class="form-group"><label class="form-label">负责人</label><select class="form-control" id="f-tester" required>${testerOpts}</select></div>
          <div class="form-group"><label class="form-label">更新日期</label><input class="form-control" id="f-update-date" type="date" required value="${test?.updateDate||''}"/></div>
        </div>
        <div class="form-group"><label class="form-label">截图类型（可多选）</label><div class="checkbox-group">${biCheckboxes}</div></div>
        <div class="form-group"><label class="form-label">改动内容</label>
          <input class="form-control" id="f-note-change" type="text" placeholder="做了什么改动" value="${escHtml(test?.notes?.change||'')}"/>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">🖼️ 更新截图</div>
        <div class="update-img-zone">${buildImgCell(0, {})}</div>
      </div>`;
  } else {
    const confOpts = [90,95,98,99].map(v=>`<input type="radio" class="radio-option" name="conf" id="conf-${v}" value="${v}" ${(test?.confidence??95)==v?'checked':''}/><label class="radio-label" for="conf-${v}">${v}%</label>`).join('');
    const allExpTypes = state.settings?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;
    const expTypeOpts = allExpTypes.map(b=>`<option value="${b}" ${test?.experimentType===b?'selected':''}>${escHtml(b)}</option>`).join('');
    const allRatioPresets = state.settings?.ratioPresets || RATIO_PRESETS;
    const isCustomRatio = !!(test?.testRatio && !allRatioPresets.includes(test.testRatio));
    const ratioPresetOpts = allRatioPresets.map(r=>`<option value="${r}" ${test?.testRatio===r?'selected':''}>${r}</option>`).join('');
    const cols = [0,1,2,3].map(i=>buildVariantCol(i, test)).join('');

    formBody = `
      <div class="form-section">
        <div class="form-section-title">📋 基本信息</div>
        <div class="form-row-4">
          <div class="form-group"><label class="form-label">项目</label><select class="form-control" id="f-project" required><option value="">选择项目…</option>${projOpts}</select></div>
          <div class="form-group"><label class="form-label">测试人</label><select class="form-control" id="f-tester" required>${testerOpts}</select></div>
          <div class="form-group"><label class="form-label">开始日期</label><input class="form-control" id="f-start" type="date" required value="${test?.startDate||''}"/></div>
          <div class="form-group"><label class="form-label">结束日期</label><input class="form-control" id="f-end" type="date" value="${test?.endDate||''}"/></div>
        </div>
        <div class="form-row-4">
          <div class="form-group" style="grid-column:span 1"><label class="form-label">置信度</label><div class="radio-group">${confOpts}</div></div>
          <div class="form-group"><label class="form-label">测试比例</label>
            <select class="form-control" id="f-ratio-sel" onchange="handleRatioChange(this.value)">
              ${ratioPresetOpts}
              <option value="custom" ${isCustomRatio?'selected':''}>自定义…</option>
            </select>
            <input class="form-control" id="f-ratio" type="text" placeholder="输入自定义比例" style="margin-top:4px;${isCustomRatio?'':'display:none'}" value="${isCustomRatio?escHtml(test.testRatio):''}"/>
          </div>
          <div class="form-group"><label class="form-label">截图类型（可多选）</label><div class="checkbox-group">${biCheckboxes}</div></div>
          <div class="form-group"><label class="form-label">实验类型</label><select class="form-control" id="f-exptype"><option value="">不指定</option>${expTypeOpts}</select></div>
        </div>
        <div class="form-group"><label class="form-label">备注说明</label>
          <div class="notes-grid">
            <input class="form-control" id="f-note-change" type="text" placeholder="改动内容（做了什么改动）" value="${escHtml(test?.notes?.change||'')}"/>
            <input class="form-control" id="f-note-purpose" type="text" placeholder="测试目的（想验证什么）" value="${escHtml(test?.notes?.purpose||'')}"/>
            <input class="form-control" id="f-note-design" type="text" placeholder="设计思路（为什么这样设计）" value="${escHtml(test?.notes?.design||'')}"/>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title section-title-flex">
          <span>🖼️ 变体横向对比</span>
          <div class="section-tools">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openCropModal()">✂️ 批量裁剪图标</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="openOCRModal()">📊 上传截图提取数据</button>
          </div>
        </div>
        <div class="variant-columns-wrap">
          <div class="variant-columns">${cols}</div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">📝 实验小结</div>
        <div class="form-group">
          <textarea class="form-control" id="f-conclusion" rows="3" placeholder="填写实验结论、分析和建议…" style="resize:vertical">${escHtml(test?.conclusion||'')}</textarea>
        </div>
      </div>`;
  }

  renderShell(`
    <div class="modal-overlay" onclick="void(0)">
      <div class="modal form-modal-wide">
        <div class="modal-header">
          <h2>${isEdit?'✏️ 编辑记录':'＋ 新增记录'}</h2>
          <button class="modal-close" onclick="navigate('timeline')">✕</button>
        </div>
        <div class="modal-body">
          ${typeToggle}
          <form id="test-form" onsubmit="handleFormSubmit(event)">
            ${formBody}
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="navigate('timeline')">取消</button>
              <button type="submit" class="btn btn-primary" id="f-submit">${isEdit?'💾 保存修改':'🚀 提交记录'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>`, 'timeline');
}

function switchFormType(type) {
  state.formType = type;
  formState.images = [null,null,null,null];
  formState.previews = [null,null,null,null];
  renderFormView();
}

function buildImgCell(i, v={}) {
  const src = formState.previews[i];
  if (src) return `<div class="img-cell-wrap"><img class="img-preview-sm" src="${src}" onclick="openLightbox('${src}')"/><button type="button" class="img-remove" onclick="removeImg(${i})">✕</button></div>`;
  return `<div class="img-upload-sm" id="uarea-${i}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event,${i})"><span class="upload-icon">📤</span><span>点击 / 拖拽 / Ctrl+V</span><input type="file" accept="image/*" onchange="handleImgSelect(event,${i})"/></div>`;
}

function activatePaste(i) {
  state.activeVariant = i;
  toast('请复制 GPLAY| 数据，然后 Ctrl+V 粘贴', 'info');
}
function setActiveImgZone(i) { state.activeImgVariant = i; }
function clearActiveImgZone() { state.activeImgVariant = null; }

function updateEffectSelect(i) {
  const sel = document.getElementById(`eselect-${i}`);
  if (!sel || i === 0) return;
  const controlFI = parseFloat(document.getElementById('v0_fi')?.value) || null;
  const testFI    = parseFloat(document.getElementById(`v${i}_fi`)?.value) || null;
  const lo = document.getElementById(`v${i}_ciL`)?.value;
  const hi = document.getElementById(`v${i}_ciH`)?.value;
  const ciL = lo !== '' && lo != null ? parseFloat(lo) : null;
  const ciH = hi !== '' && hi != null ? parseFloat(hi) : null;
  sel.value = calculateEffect(ciL, ciH, testFI, controlFI);
}
function updateEffectBadge(i) { updateEffectSelect(i); }

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
  const wrap = document.createElement('div'); wrap.className='img-cell-wrap';
  wrap.innerHTML = `<img class="img-preview-sm" src="${src}" onclick="openLightbox('${src}')"/><button type="button" class="img-remove" onclick="removeImg(${i})">✕</button>`;
  area.replaceWith(wrap);
}
function removeImg(i) {
  formState.images[i] = null;
  formState.previews[i] = null;
  const zone = document.querySelector(`.variant-col[data-vi="${i}"] .vc-img-zone`);
  if (!zone) return;
  const existing = zone.querySelector('.img-cell-wrap') || zone.querySelector('.img-upload-sm');
  if (existing) {
    const tmp = document.createElement('div');
    tmp.innerHTML = buildImgCell(i, {});
    existing.replaceWith(tmp.firstChild);
  }
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
    const biVizType = BI_TYPES.filter(b => document.getElementById(`f-bitype-${b}`)?.checked);
    const ft = state.formType || 'test';

    if (ft === 'update') {
      const updateDate = document.getElementById('f-update-date').value;
      const notes = { change: document.getElementById('f-note-change')?.value?.trim() || '' };
      const existImg = state.editTestId ? (state.tests.find(t=>t.id===state.editTestId)?.imageUrl||null) : null;
      let imageUrl = existImg;
      if (formState.images[0]) imageUrl = await compressImage(formState.images[0]);
      else if (formState.previews[0] && formState.previews[0] !== imageUrl) imageUrl = formState.previews[0];
      const data = { type:'update', projectId, projectName, tester, updateDate, biVizType, notes, imageUrl };
      if (state.editTestId) { await updateTest(state.editTestId, data); toast('已保存修改','success'); }
      else { await createTest(data); toast('记录已提交','success'); }
    } else {
      const startDate = document.getElementById('f-start').value;
      const endDate = document.getElementById('f-end').value;
      const confidence = Number(document.querySelector('input[name="conf"]:checked')?.value||95);
      const ratioSel = document.getElementById('f-ratio-sel')?.value;
      const testRatio = ratioSel === 'custom' ? (document.getElementById('f-ratio')?.value||'') : (ratioSel||'');
      const experimentType = document.getElementById('f-exptype')?.value || '';
      const conclusion = document.getElementById('f-conclusion')?.value?.trim() || '';
      const notes = {
        change: document.getElementById('f-note-change')?.value?.trim() || '',
        purpose: document.getElementById('f-note-purpose')?.value?.trim() || '',
        design: document.getElementById('f-note-design')?.value?.trim() || '',
      };
      const existV = state.editTestId ? (state.tests.find(t=>t.id===state.editTestId)?.variants||[]) : [];
      const variants = [];
      for (let i=0;i<VDEFS.length;i++) {
        const fi=document.getElementById(`v${i}_fi`)?.value;
        const ri=document.getElementById(`v${i}_ri`)?.value;
        const ciL=document.getElementById(`v${i}_ciL`)?.value??null;
        const ciH=document.getElementById(`v${i}_ciH`)?.value??null;
        const applied=i>0?(document.getElementById(`v${i}_applied`)?.checked||false):false;
        const effect=i===0?'control':(document.getElementById(`eselect-${i}`)?.value||'empirical_n');
        let imageUrl=existV[i]?.imageUrl||null;
        if (formState.images[i]) imageUrl = await compressImage(formState.images[i]);
        else if (formState.previews[i] && formState.previews[i] !== imageUrl) imageUrl = formState.previews[i];
        variants.push({ firstInstalls:fi!==''&&fi!=null?Number(fi):null, retainedInstalls:ri!==''&&ri!=null?Number(ri):null, ciLower:ciL!==''&&ciL!=null?parseFloat(ciL):null, ciUpper:ciH!==''&&ciH!=null?parseFloat(ciH):null, applied, effect, imageUrl });
      }
      const data={type:'test',projectId,projectName,tester,startDate,endDate,confidence,testRatio,biVizType,experimentType,conclusion,notes,variants};
      if (state.editTestId) { await updateTest(state.editTestId,data); toast('已保存修改','success'); }
      else { await createTest(data); toast('记录已提交','success'); }
    }

    formState.images=[null,null,null,null]; formState.previews=[null,null,null,null];
    state.editTestId=null; navigate('timeline');
  } catch(err) { toast('提交失败：'+err.message,'error'); btn.disabled=false; btn.textContent=state.editTestId?'💾 保存修改':'🚀 提交记录'; }
}

// ── OCR Modal (Tesseract.js, no API needed) ───────────────────
let ocrFiles = { fi: null, ri: null };
let ocrData  = {};

function openOCRModal() {
  ocrFiles = { fi: null, ri: null }; ocrData = {};
  const wrap = document.createElement('div');
  wrap.className = 'ocr-modal-wrap'; wrap.id = 'ocr-wrap';
  wrap.innerHTML = `
    <div class="ocr-modal">
      <h3>📊 上传截图自动提取数据</h3>
      <p>上传 Google Play Console 实验截图，自动识别各变体的安装数和置信区间（本地运行，无需 API）</p>
      <div class="ocr-uploads">
        <div>
          <div class="ocr-upload-label">首次安装数截图 <span class="ocr-paste-hint">（可 Ctrl+V 粘贴）</span></div>
          <div class="img-upload-area ocr-drop-zone" id="ocr-fi-area" style="min-height:90px">
            <span class="upload-icon">📤</span><span class="upload-hint">点击上传 / Ctrl+V 粘贴截图</span>
            <input type="file" accept="image/*" onchange="ocrFileSelected(event,'fi')"/>
          </div>
          <div id="ocr-fi-thumb"></div>
        </div>
        <div>
          <div class="ocr-upload-label">保留安装数截图 <span class="ocr-paste-hint">（可 Ctrl+V 粘贴）</span></div>
          <div class="img-upload-area ocr-drop-zone" id="ocr-ri-area" style="min-height:90px">
            <span class="upload-icon">📤</span><span class="upload-hint">点击上传 / Ctrl+V 粘贴截图</span>
            <input type="file" accept="image/*" onchange="ocrFileSelected(event,'ri')"/>
          </div>
          <div id="ocr-ri-thumb"></div>
        </div>
      </div>
      <div class="ocr-status" id="ocr-status">
        <div class="spinner"></div>
        <p>正在识别文字，请稍候（约 10~20 秒）…</p>
        <div class="ocr-progress" id="ocr-progress"></div>
      </div>
      <div id="ocr-preview-wrap" style="display:none">
        <table class="ocr-preview-table">
          <thead><tr><th>变体</th><th>首次安装（调整）</th><th>CI 下限 %</th><th>CI 上限 %</th><th>保留安装（调整）</th></tr></thead>
          <tbody id="ocr-tbody"></tbody>
        </table>
      </div>
      <div class="ocr-actions">
        <button class="btn btn-secondary" onclick="closeOCRModal()">取消</button>
        <button class="btn btn-secondary" id="ocr-run-btn" onclick="runOCR()" disabled>🔍 开始识别</button>
        <button class="btn btn-primary" id="ocr-apply-btn" onclick="applyOCRData()" disabled>✅ 填入表单</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function ocrFileSelected(e, type) {
  const file = e.target.files?.[0]; if(!file) return;
  ocrFiles[type] = file;
  const thumbEl = document.getElementById(`ocr-${type}-thumb`);
  const r = new FileReader(); r.onload = ev => { thumbEl.innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:80px;margin-top:6px;border-radius:4px;border:1px solid var(--border)"/>`; };
  r.readAsDataURL(file);
  if (ocrFiles.fi || ocrFiles.ri) document.getElementById('ocr-run-btn').disabled = false;
}

async function runOCR() {
  if (!ocrFiles.fi && !ocrFiles.ri) { toast('请至少上传一张截图','error'); return; }
  document.getElementById('ocr-status').style.display = 'block';
  document.getElementById('ocr-preview-wrap').style.display = 'none';
  document.getElementById('ocr-run-btn').disabled = true;
  document.getElementById('ocr-apply-btn').disabled = true;
  ocrData = {};

  try {
    const logger = m => {
      if (m.status === 'recognizing text') {
        const p = document.getElementById('ocr-progress');
        if (p) p.textContent = `进度 ${Math.round(m.progress*100)}%`;
      }
    };

    if (ocrFiles.fi) {
      const r = await Tesseract.recognize(ocrFiles.fi, 'eng', { logger });
      const fiParsed = parseFirstInstallOCR(r.data.text);
      Object.keys(fiParsed).forEach(v => { ocrData[v] = { ...(ocrData[v]||{}), ...fiParsed[v] }; });
    }
    if (ocrFiles.ri) {
      const r2 = await Tesseract.recognize(ocrFiles.ri, 'eng', { logger });
      const riParsed = parseRetainedOCR(r2.data.text);
      Object.keys(riParsed).forEach(v => { ocrData[v] = { ...(ocrData[v]||{}), ...riParsed[v] }; });
    }

    // Show editable preview table
    const tbody = document.getElementById('ocr-tbody');
    const variantMap = { control:'原始(控制)', A:'测试1', B:'测试2', C:'测试3' };
    tbody.innerHTML = Object.entries(ocrData).map(([k,d])=>`
      <tr data-ocr-key="${k}">
        <td>${variantMap[k]||k}</td>
        <td><input class="form-control ocr-edit" data-field="firstInstalls" type="number" value="${d.firstInstalls??''}" placeholder="—" style="width:90px"/></td>
        <td><input class="form-control ocr-edit" data-field="ciLower" type="number" step="0.1" value="${d.ciLower??''}" placeholder="—" style="width:70px"/></td>
        <td><input class="form-control ocr-edit" data-field="ciUpper" type="number" step="0.1" value="${d.ciUpper??''}" placeholder="—" style="width:70px"/></td>
        <td><input class="form-control ocr-edit" data-field="retainedInstalls" type="number" value="${d.retainedInstalls??''}" placeholder="—" style="width:90px"/></td>
      </tr>`).join('');
    document.getElementById('ocr-status').style.display = 'none';
    document.getElementById('ocr-preview-wrap').style.display = 'block';
    document.getElementById('ocr-apply-btn').disabled = false;
    toast('识别完成，可直接修改数据后点击「填入表单」','success');
  } catch(err) {
    document.getElementById('ocr-status').style.display = 'none';
    toast('识别失败：'+err.message,'error');
    document.getElementById('ocr-run-btn').disabled = false;
  }
}

function parseFirstInstallOCR(text) {
  const result = {};
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l);
  for (const line of lines) {
    // Match lines starting with single letter A/B/C (variant)
    const vm = line.match(/^([A-C])\s/);
    if (!vm) continue;
    const variant = vm[1];
    // Extract all numbers (strip commas)
    const nums = [...line.matchAll(/[\d,]+/g)].map(m=>parseInt(m[0].replace(/,/g,''))).filter(n=>n>100);
    // Adjusted installs = largest number
    const firstInstalls = nums.length ? Math.max(...nums) : null;
    // CI: look for signed percentages
    const pcts = [...line.matchAll(/([+-]?\d+\.?\d*)\s*%/g)].map(m=>parseFloat(m[1]));
    const ciLower = pcts.find(p=>p<0) ?? null;
    const ciUpper = pcts.find(p=>p>0) ?? null;
    result[variant] = { firstInstalls, ciLower, ciUpper };
  }
  // Also try to find control row (line with 70% or highest audience %)
  for (const line of lines) {
    if (line.match(/^[A-C]\s/)) continue; // skip variant rows
    const nums = [...line.matchAll(/[\d,]+/g)].map(m=>parseInt(m[0].replace(/,/g,''))).filter(n=>n>1000);
    if (nums.length >= 2) {
      result['control'] = { firstInstalls: Math.max(...nums) };
      break;
    }
  }
  return result;
}

function parseRetainedOCR(text) {
  const result = {};
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l);
  for (const line of lines) {
    const vm = line.match(/^([A-C])\s/);
    if (!vm) continue;
    const variant = vm[1];
    const nums = [...line.matchAll(/[\d,]+/g)].map(m=>parseInt(m[0].replace(/,/g,''))).filter(n=>n>100);
    result[variant] = { retainedInstalls: nums.length ? Math.max(...nums) : null };
  }
  for (const line of lines) {
    if (line.match(/^[A-C]\s/)) continue;
    const nums = [...line.matchAll(/[\d,]+/g)].map(m=>parseInt(m[0].replace(/,/g,''))).filter(n=>n>1000);
    if (nums.length >= 2) {
      result['control'] = { retainedInstalls: Math.max(...nums) };
      break;
    }
  }
  return result;
}

function applyOCRData() {
  const varMap = { control:0, A:1, B:2, C:3 };
  // Read from editable inputs in the preview table
  document.querySelectorAll('#ocr-tbody tr[data-ocr-key]').forEach(row => {
    const key = row.dataset.ocrKey;
    const i = varMap[key];
    if (i === undefined) return;
    const getVal = field => { const el = row.querySelector(`[data-field="${field}"]`); return el?.value?.trim()||null; };
    const set = (id, val) => { const el=document.getElementById(id); if(el&&val!=null&&val!=='') el.value=val; };
    set(`v${i}_fi`, getVal('firstInstalls'));
    set(`v${i}_ri`, getVal('retainedInstalls'));
    if (i > 0) {
      set(`v${i}_ciL`, getVal('ciLower'));
      set(`v${i}_ciH`, getVal('ciUpper'));
      updateEffectSelect(i);
    }
  });
  closeOCRModal();
  toast('数据已填入，请检查并调整','success');
}

function closeOCRModal() { document.getElementById('ocr-wrap')?.remove(); }

// ── Icon Crop Modal (Canvas, no API) ─────────────────────────
let cropImg = null;
let cropDividers = [0.25, 0.5, 0.75]; // 3 dividers for 4 regions
let draggingDivider = null;
const CROP_COLORS = ['#6B7280','#3B82F6','#8B5CF6','#EC4899'];
const CROP_LABELS = ['原始','测试1','测试2','测试3'];

function openCropModal() {
  cropImg = null; cropDividers = [0.25, 0.5, 0.75];
  setTimeout(() => { const c = document.getElementById('crop-canvas'); if(c) setupCropDrag(); }, 200);
  const wrap = document.createElement('div');
  wrap.className = 'crop-modal-wrap'; wrap.id = 'crop-wrap';
  wrap.innerHTML = `
    <div class="crop-modal">
      <h3>✂️ 批量裁剪图标</h3>
      <p>上传包含全部变体图标的截图，拖动分割线调整各区域，支持 1~4 个变体</p>
      <div class="img-upload-area" id="crop-upload" style="min-height:80px">
        <span class="upload-icon">📤</span><span class="upload-hint">点击上传 / Ctrl+V 粘贴</span>
        <input type="file" accept="image/*" onchange="cropImgSelected(event)"/>
      </div>
      <div id="crop-canvas-wrap" style="display:none;margin-top:12px">
        <div class="crop-legend" id="crop-legend"></div>
        <canvas id="crop-canvas"></canvas>
        <div class="crop-actions">
          <button class="btn btn-secondary btn-sm" onclick="cropAutoSplit()">均等分割</button>
          <button class="btn btn-primary btn-sm" onclick="applyCrop()">✅ 裁剪并填入</button>
        </div>
      </div>
      <div style="margin-top:12px;text-align:right"><button class="btn btn-secondary btn-sm" onclick="closeCropModal()">关闭</button></div>
    </div>`;
  document.body.appendChild(wrap);
}

function cropFromFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = ev => {
    const img = new Image();
    img.onload = () => {
      cropImg = img;
      const uploadEl = document.getElementById('crop-upload');
      const canvasWrap = document.getElementById('crop-canvas-wrap');
      if (uploadEl) uploadEl.style.display = 'none';
      if (canvasWrap) canvasWrap.style.display = 'block';
      const legendEl = document.getElementById('crop-legend');
      if (legendEl) legendEl.innerHTML = CROP_COLORS.map((c,i)=>`<div class="crop-legend-item"><div class="crop-legend-dot" style="background:${c}"></div><span>${CROP_LABELS[i]}</span></div>`).join('');
      drawCropCanvas();
      setTimeout(() => setupCropDrag(), 50);
    };
    img.src = ev.target.result;
  };
  r.readAsDataURL(file);
}

function cropImgSelected(e) {
  const file = e.target.files?.[0];
  if (file) cropFromFile(file);
}

function drawCropCanvas() {
  const canvas = document.getElementById('crop-canvas'); if(!canvas||!cropImg) return;
  const MAX_W = Math.min(620, window.innerWidth - 100);
  const scale = MAX_W / cropImg.width;
  canvas.width = Math.round(cropImg.width * scale);
  canvas.height = Math.round(cropImg.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropImg, 0, 0, canvas.width, canvas.height);
  // Draw region overlays
  const regions = [0, ...cropDividers, 1];
  for (let i=0;i<regions.length-1;i++) {
    const x1 = Math.round(regions[i]*canvas.width);
    const x2 = Math.round(regions[i+1]*canvas.width);
    ctx.fillStyle = CROP_COLORS[i]+'33';
    ctx.fillRect(x1, 0, x2-x1, canvas.height);
    ctx.fillStyle = CROP_COLORS[i];
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(CROP_LABELS[i], x1+6, 20);
  }
  // Draw divider lines
  cropDividers.forEach((d,i) => {
    const x = Math.round(d*canvas.width);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    ctx.setLineDash([]);
    // Handle
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, canvas.height/2, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('⇔', x, canvas.height/2+4);
  });
}

function setupCropDrag() {
  const canvas = document.getElementById('crop-canvas'); if(!canvas) return;
  canvas.onmousedown = e => {
    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / canvas.width;
    draggingDivider = cropDividers.findIndex(d => Math.abs(d - xRatio) < 0.04);
  };
  canvas.onmousemove = e => {
    if (draggingDivider === null || draggingDivider === -1) return;
    const rect = canvas.getBoundingClientRect();
    let xRatio = (e.clientX - rect.left) / canvas.width;
    xRatio = Math.max(0.05, Math.min(0.95, xRatio));
    cropDividers[draggingDivider] = xRatio;
    cropDividers.sort((a,b)=>a-b);
    drawCropCanvas();
  };
  canvas.onmouseup = () => { draggingDivider = null; };
  canvas.onmouseleave = () => { draggingDivider = null; };
}

function cropAutoSplit() {
  cropDividers = [0.25, 0.5, 0.75];
  drawCropCanvas();
}

function applyCrop() {
  if (!cropImg) return;
  const regions = [0, ...cropDividers, 1];
  const offscreen = document.createElement('canvas');
  const ctx = offscreen.getContext('2d');
  for (let i=0;i<regions.length-1;i++) {
    const x1 = Math.round(regions[i]*cropImg.width);
    const x2 = Math.round(regions[i+1]*cropImg.width);
    const w = x2-x1;
    offscreen.width = w; offscreen.height = cropImg.height;
    ctx.clearRect(0,0,w,cropImg.height);
    ctx.drawImage(cropImg, x1, 0, w, cropImg.height, 0, 0, w, cropImg.height);
    const dataUrl = offscreen.toDataURL('image/jpeg', 0.85);
    formState.previews[i] = dataUrl;
    formState.images[i] = null; // mark as base64, not File
    showPreview(i, dataUrl);
  }
  closeCropModal();
  toast('图标已裁剪填入，请确认效果','success');
}

function closeCropModal() { document.getElementById('crop-wrap')?.remove(); }
// ── Admin ─────────────────────────────────────────────────────
async function renderAdmin() {
  const isAdmin = !!state.userData?.isAdmin;
  const [settings, users, projects] = await Promise.all([getSettings(), getAllUsers(), getProjects()]);
  const code = settings?.accessCode || '—';
  const testers = settings?.testers || [];
  const ratioPresets = settings?.ratioPresets || RATIO_PRESETS;
  const experimentTypes = settings?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;

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
  const ratioHTML = ratioPresets.map(r=>`<li><span class="ratio-preset-tag">${escHtml(r)}</span><button class="btn btn-danger btn-sm" onclick="removeRatioPresetItem('${escHtml(r)}')">移除</button></li>`).join('');
  const expTypeHTML = experimentTypes.map(r=>`<li><span class="ratio-preset-tag">${escHtml(r)}</span><button class="btn btn-danger btn-sm" onclick="removeExpTypeItem('${escHtml(r)}')">移除</button></li>`).join('');

  renderShell(`
    <div class="page-header"><div class="page-title">⚙️ 管理面板</div></div>
    <div class="admin-grid">
      ${isAdmin ? `
      <div class="admin-card" style="grid-column:1/-1">
        <h3>🔐 入场码 <span style="font-size:11px;font-weight:400;color:var(--text-muted)">仅管理员可见</span></h3>
        <div class="access-code-display" id="code-display">${escHtml(code)}</div>
        <div class="add-row"><input class="form-control" id="new-code" type="text" placeholder="输入新入场码…"/><button class="btn btn-primary" onclick="changeCode()">修改入场码</button></div>
      </div>
      <div class="admin-card">
        <h3>👥 团队成员 <span style="font-size:11px;font-weight:400;color:var(--text-muted)">仅管理员可见</span></h3>
        <ul class="admin-list">${usersHTML||'<li style="color:var(--text-muted)">暂无</li>'}</ul>
      </div>` : ''}
      <div class="admin-card">
        <h3>🧑‍💻 测试人员名单</h3>
        <ul class="admin-list">${testHTML||'<li style="color:var(--text-muted)">暂无</li>'}</ul>
        <div class="add-row"><input class="form-control" id="add-tester" type="text" placeholder="添加测试人…"/><button class="btn btn-primary" onclick="addTesterItem()">添加</button></div>
      </div>
      <div class="admin-card">
        <h3>📐 测试比例选项</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">在新增记录表单的「测试比例」下拉框中显示</p>
        <ul class="admin-list">${ratioHTML||'<li style="color:var(--text-muted)">暂无</li>'}</ul>
        <div class="add-row"><input class="form-control" id="add-ratio" type="text" placeholder="如 40/30/30 或 20/80"/><button class="btn btn-primary" onclick="addRatioPresetItem()">添加</button></div>
      </div>
      <div class="admin-card">
        <h3>🧪 实验类型选项</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">在新增记录表单的「实验类型」下拉框中显示</p>
        <ul class="admin-list">${expTypeHTML||'<li style="color:var(--text-muted)">暂无</li>'}</ul>
        <div class="add-row"><input class="form-control" id="add-exptype" type="text" placeholder="如 本地化 TH 或 主图测试"/><button class="btn btn-primary" onclick="addExpTypeItem()">添加</button></div>
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
async function addRatioPresetItem() {
  const n = document.getElementById('add-ratio').value.trim(); if(!n) return;
  const s = await getSettings();
  const presets = s?.ratioPresets || RATIO_PRESETS;
  if (presets.includes(n)) { toast('该选项已存在','info'); return; }
  await updateSettings({ ratioPresets: [...presets, n] });
  state.settings = await getSettings();
  document.getElementById('add-ratio').value = '';
  toast('比例选项已添加','success'); renderAdmin();
}
async function removeRatioPresetItem(r) {
  if (!confirm(`移除比例选项「${r}」？`)) return;
  const s = await getSettings();
  await updateSettings({ ratioPresets: (s?.ratioPresets || RATIO_PRESETS).filter(p=>p!==r) });
  state.settings = await getSettings();
  toast('已移除','success'); renderAdmin();
}
async function addExpTypeItem() {
  const n = document.getElementById('add-exptype').value.trim(); if(!n) return;
  const s = await getSettings();
  const types = s?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;
  if (types.includes(n)) { toast('该选项已存在','info'); return; }
  await updateSettings({ experimentTypes: [...types, n] });
  state.settings = await getSettings();
  document.getElementById('add-exptype').value = '';
  toast('实验类型已添加','success'); renderAdmin();
}
async function removeExpTypeItem(r) {
  if (!confirm(`移除实验类型「${r}」？`)) return;
  const s = await getSettings();
  await updateSettings({ experimentTypes: (s?.experimentTypes || DEFAULT_EXPERIMENT_TYPES).filter(p=>p!==r) });
  state.settings = await getSettings();
  toast('已移除','success'); renderAdmin();
}

// ── Expose globals (needed for inline onclick) ────────────────
Object.assign(window, {
  openOCRModal, closeOCRModal, runOCR, applyOCRData, ocrFileSelected,
  openCropModal, closeCropModal, cropImgSelected, cropAutoSplit, applyCrop,
  navigate, filterTimeline, applyTimelineFilters, resetTimelineFilters, onSearchInput, toggleCard, editTest, deleteTestRecord, handleRatioChange,
  signInWithGoogle, signOutUser, handleAccessCode,
  handleFormSubmit, handleImgSelect, handleDrop, removeImg,
  activatePaste, setActiveImgZone, clearActiveImgZone, switchFormType,
  updateEffectSelect, updateEffectBadge, openLightbox,
  changeCode, makeAdmin, revokeUser,
  addProjectItem, removeProject, addTesterItem, removeTesterItem,
  addRatioPresetItem, removeRatioPresetItem, addExpTypeItem, removeExpTypeItem,
});
