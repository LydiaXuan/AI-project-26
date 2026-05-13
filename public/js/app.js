// ================================================================
// app.js  –  图测记录工具
// ================================================================
import { calculateEffect, effectBadgeHTML, EFFECT_OPTIONS, EFFECT } from './effects.js';
import {
  initDB, getSettings, createSettings, updateSettings,
  getProjects, addProject, deleteProject,
  addTester, removeTester,
  getTests, createTest, updateTest, deleteTest,
  isReady, resumeAccess, pickFolder, getFolderName,
  getTrash, restoreFromTrash, purgeTrashItem,
  getRecordHistory, rollbackRecord,
  getDailyBackups, restoreFromBackup,
  getPendingCount, retryPending,
  subscribeTests, subscribeProjects
} from './db.js';

initDB();

// ── 个人信息（仅存本浏览器 localStorage）─────────────────────
function getProfile() { try { return JSON.parse(localStorage.getItem('chart-recorder-profile')||'{}'); } catch { return {}; } }
function saveProfile(p) { localStorage.setItem('chart-recorder-profile', JSON.stringify(p)); }

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
  settings: null, pendingCount: 0,
  view: 'dashboard', tests: [], projects: [],
  filterProject: 'all', filterEffect: 'all', filterBiType: 'all',
  filterExpType: 'all', filterVarCount: 'all', sortOrder: 'desc', searchQuery: '',
  editTestId: null, activeVariant: null, activeImgVariant: null, formType: 'test', selectedTestId: null,
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
      // OCR modal open → paste into active OCR zone
      if (document.getElementById('ocr-wrap')) {
        ocrReceiveFile(file, activeOcrZone);
        toast(`已粘贴到${activeOcrZone==='fi'?'首次安装数':'保留安装数'}截图区`, 'success');
        return;
      }
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

// ── 启动流程：选择数据文件夹 ─────────────────────────────────
(async () => {
  if (!window.showDirectoryPicker) {
    document.getElementById('app').innerHTML = `
      <div class="login-page"><div class="login-card">
        <div class="login-logo">⚠️</div>
        <h1>浏览器不支持</h1>
        <p style="color:var(--text-muted);margin-top:12px">本工具需要 File System Access API 才能直接读写网络盘上的数据。<br/><br/>请使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 浏览器打开。</p>
      </div></div>`;
    return;
  }
  if (await isReady()) { await startMainApp(); return; }
  // getFolderName() 有值说明曾选过文件夹但权限失效，可恢复；否则首次访问
  renderFolderPicker(!!getFolderName());
})();

function renderFolderPicker(canResume = false) {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">📂</div>
        <h1>图测记录工具</h1>
        <p style="color:var(--text-muted);margin:14px 0 22px;line-height:1.6">
          所有数据存储在群晖网络盘上的指定文件夹里，多人共享同一份数据。<br/>
          首次使用请选择 <code style="background:#F3F4F6;padding:2px 6px;border-radius:3px">data</code> 文件夹（不存在会自动创建文件）。
        </p>
        ${canResume ? `<button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick="_resumeFolder()">🔄 恢复访问已选文件夹</button>` : ''}
        <button class="btn ${canResume?'btn-secondary':'btn-primary'}" style="width:100%" onclick="_pickFolder()">📁 选择数据文件夹</button>
        <p style="font-size:12px;color:var(--text-muted);margin-top:18px">提示：选择网络盘上的 <code>data</code> 文件夹，例如 <code>Z:\\图测记录工具\\data</code>（首次使用会自动创建 data 内的 JSON 文件）</p>
      </div>
    </div>`;
}

async function _pickFolder() {
  try {
    await pickFolder();
    await startMainApp();
  } catch (err) {
    if (err.name !== 'AbortError') toast('选择失败：' + err.message, 'error');
  }
}
async function _resumeFolder() {
  try {
    const ok = await resumeAccess();
    if (ok) await startMainApp();
    else toast('权限被拒绝，请选择文件夹', 'error');
  } catch (err) { toast('恢复失败：' + err.message, 'error'); }
}

async function startMainApp() {
  state.settings = await getSettings();
  state.tests = await getTests();
  state.projects = await getProjects();
  // 先尝试同步未保存的数据
  await syncPending(true);
  navigate('dashboard');
}

async function refreshData() {
  state.tests = await getTests();
  state.projects = await getProjects();
  state.settings = await getSettings();
}

async function syncPending(silent = false) {
  state.pendingCount = await getPendingCount();
  if (state.pendingCount === 0) return;
  if (!silent) toast(`正在同步 ${state.pendingCount} 条待保存记录…`, 'info');
  const { success, fail } = await retryPending();
  state.pendingCount = await getPendingCount();
  if (success > 0) await refreshData();
  if (fail > 0 && !silent) toast(`仍有 ${fail} 条同步失败`, 'error');
  else if (success > 0) toast(`已同步 ${success} 条`, 'success');
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
    case 'profile':   renderProfile();   break;
  }
}

// ── Shell ─────────────────────────────────────────────────────
function escHtml(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function sidebarAvatarHTML(prof, cls) {
  if (prof.avatar) return `<img class="${cls}" src="${prof.avatar}" alt="" />`;
  const initial = (prof.name && prof.name.trim()[0]) || '👤';
  return `<span class="${cls} placeholder">${escHtml(initial)}</span>`;
}

function renderShell(content, activeTab) {
  const folderName = getFolderName();
  const prof = getProfile();
  const navItem = (tab, view, icon, label) =>
    `<button class="sidebar-nav-item${activeTab===tab?' active':''}" onclick="navigate('${view}')"><span class="sidebar-nav-icon">${icon}</span><span>${label}</span></button>`;
  const pending = state.pendingCount > 0
    ? `<button class="pending-pill" onclick="_syncPending()" title="点击重试同步">⚠ ${state.pendingCount} 条未同步</button>`
    : '';
  document.getElementById('app').innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand"><span class="sidebar-logo">📊</span><span>图测记录工具</span></div>
      <nav class="sidebar-nav">
        <button class="sidebar-add-item${activeTab==='form'?' active':''}" onclick="navigate('form')"><span>＋</span><span>新增记录</span></button>
        ${navItem('timeline','timeline','📋','时间线')}
        ${navItem('dashboard','dashboard','📊','仪表盘')}
        ${navItem('admin','admin','⚙️','管理')}
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-data">
        <span class="sidebar-folder" title="${escHtml(folderName||'未选择')}">📂 ${escHtml(folderName||'未选择')}</span>
        <button class="sidebar-data-btn" onclick="_refreshFromDisk()">🔄 刷新数据</button>
        ${pending}
      </div>
      <button class="sidebar-profile" onclick="navigate('profile')">
        ${sidebarAvatarHTML(prof, 'sidebar-avatar')}
        <span class="sidebar-profile-name">${escHtml(prof.name || '设置个人信息')}</span>
      </button>
    </aside>
    <main class="page-with-sidebar">${content}</main>`;
}

async function _refreshFromDisk() {
  await refreshData();
  await syncPending(true);
  render();
  toast('已重新加载', 'success');
}
async function _syncPending() { await syncPending(); render(); }

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const tests = state.tests;
  const now = new Date();
  const thisMonth = tests.filter(t => { const d = new Date(t.startDate); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
  let totalV=0, appliedV=0;
  tests.forEach(t => (t.variants||[]).forEach((v,i) => { if(i===0)return; totalV++; if(v.applied)appliedV++; }));
  const rate = totalV>0 ? Math.round(appliedV/totalV*100) : 0;
  const projCount = state.projects.length;
  const testerCount = (state.settings?.testers||[]).length;

  renderShell(`
    <div class="page-header"><div class="page-title">仪表盘</div></div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-icon" style="background:#EEF2FF;color:#4F6CF6">📋</div><span class="stat-label">总测试次数</span></div>
        <div class="stat-value">${tests.length}</div><div class="stat-sub">所有项目累计</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-icon" style="background:#DBEAFE;color:#1D4ED8">📅</div><span class="stat-label">本月测试</span></div>
        <div class="stat-value" style="color:var(--primary)">${thisMonth.length}</div><div class="stat-sub">${now.getMonth()+1} 月</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-icon" style="background:#DCFCE7;color:#15803D">✅</div><span class="stat-label">累计应用</span></div>
        <div class="stat-value" style="color:var(--success-l)">${appliedV}</div><div class="stat-sub">共 ${totalV} 个测试变体</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-icon" style="background:#FEF3C7;color:#B45309">🎯</div><span class="stat-label">应用率</span></div>
        <div class="stat-value" style="color:var(--warning)">${rate}%</div><div class="stat-sub">测试变体应用比例</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-icon" style="background:#F3E8FF;color:#7C3AED">📁</div><span class="stat-label">项目数</span></div>
        <div class="stat-value" style="color:#7C3AED">${projCount}</div><div class="stat-sub">活跃项目</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-icon" style="background:#CCFBF1;color:#0F766E">👤</div><span class="stat-label">测试人员</span></div>
        <div class="stat-value" style="color:#0F766E">${testerCount}</div><div class="stat-sub">团队成员</div>
      </div>
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

function _tlFilterTests() {
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
  return tests;
}

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

  const tests = _tlFilterTests();

  const activeFilters = [
    state.filterProject!=='all', state.filterEffect!=='all',
    state.filterBiType!=='all', state.filterExpType!=='all',
    !!state.searchQuery
  ].filter(Boolean).length;

  // Auto-select first item if none selected or selected not in filtered list
  if (tests.length > 0) {
    const inList = tests.some(t => t.id === state.selectedTestId);
    if (!inList) state.selectedTestId = tests[0].id;
  } else {
    state.selectedTestId = null;
  }

  const selectedTest = state.selectedTestId ? state.tests.find(t => t.id === state.selectedTestId) : null;

  const listHtml = tests.length === 0
    ? `<div class="tl-list-empty"><div style="font-size:32px;margin-bottom:8px">🔍</div><p>暂无匹配记录</p><button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="resetTimelineFilters()">清除筛选</button></div>`
    : tests.map(t => buildTlListItem(t)).join('');

  const detailHtml = selectedTest ? buildTlDetail(selectedTest) : `<div class="tl-detail-empty"><div class="empty-icon">👈</div><p>请选择左侧记录查看详情</p></div>`;

  renderShell(`
    <div class="page-header">
      <div class="page-title">历史时间线</div>
      <span class="tl-result-pill">共 ${tests.length} 条记录${tests.length!==state.tests.length?` / 全部 ${state.tests.length}`:''}</span>
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
    <div class="tl-split">
      <div class="tl-list-pane" id="tl-list-pane">${listHtml}</div>
      <div class="tl-detail-pane" id="tl-detail-pane">${detailHtml}</div>
    </div>
  `, 'timeline');
}

function buildTlListItem(t) {
  const isUpdate = t.type === 'update';
  const vars = t.variants || [];
  const anyApplied = !isUpdate && vars.some((v,i) => i > 0 && v.applied);
  const normEffect = e => e==='great'?'superb':e==='empirical'?'empirical_p':e||'empirical_n';

  const dateLines = isUpdate
    ? `<span>${t.updateDate || ''}</span><span class="tl-date-arrow">更新</span>`
    : `<span>${t.startDate || ''}</span><span class="tl-date-arrow">↓</span><span>${t.endDate || '进行中'}</span>`;

  const thumbsHtml = isUpdate
    ? [t.imageUrl, t.newImageUrl].filter(Boolean).slice(0,4).map(url =>
        `<img class="tl-item-thumb" src="${url}" />`).join('')
    : vars.slice(0,5).map(v => v.imageUrl
        ? `<img class="tl-item-thumb${v.applied?' tl-thumb-applied':''}" src="${v.imageUrl}" />`
        : `<div class="tl-item-thumb-ph">🖼</div>`).join('');

  const dotCls = isUpdate ? 'dot-update' : (anyApplied ? 'dot-applied' : '');
  const isSelected = state.selectedTestId === t.id;
  return `
    <div class="tl-list-item${isSelected ? ' selected' : ''}" data-id="${t.id}" onclick="selectTimelineTest('${t.id}')">
      <div class="tl-item-dates">${dateLines}</div>
      <div class="tl-item-axis"><div class="tl-item-axis-dot ${dotCls}"></div></div>
      <div class="tl-item-content">
        <div class="tl-item-name">${escHtml(t.projectName || '')}${isUpdate ? ' <span style="font-size:11px;color:#F97316">🔄</span>' : ''}</div>
        <div class="tl-item-thumbs">${thumbsHtml || '<div class="tl-item-thumb-ph">🖼</div>'}</div>
      </div>
    </div>`;
}

function buildTlDetail(t) {
  if (!t) return `<div class="tl-detail-empty"><div class="empty-icon">👈</div><p>请选择左侧记录查看详情</p></div>`;
  const isUpdate = t.type === 'update';
  const vars = t.variants || [];
  const biTypes = Array.isArray(t.biVizType) ? t.biVizType : (t.biVizType ? [t.biVizType] : []);
  const normEffect = e => e==='great'?'superb':e==='empirical'?'empirical_p':e||'empirical_n';
  const appliedIdx = vars.findIndex((v,i) => i > 0 && v.applied);
  const appliedVar = appliedIdx >= 0 ? vars[appliedIdx] : null;

  // Images with inline stats below each
  let imagesHtml = '';
  if (isUpdate) {
    const pairs = [{url: t.imageUrl, label:'原始'}, {url: t.newImageUrl, label:'更新后'}].filter(p=>p.url);
    imagesHtml = pairs.map(p=>`
      <div class="tl-detail-img-wrap">
        <img class="tl-detail-img" src="${p.url}" onclick="openLightbox('${p.url}')" />
        <div class="tl-detail-img-label">${p.label}</div>
      </div>`).join('');
  } else {
    imagesHtml = vars.map((v,i)=>{
      if (!v.imageUrl) return '';
      const labelText = i===0 ? '🔵 原始' : `🔴 测试${i}`;
      const ciText = (v.ciLower!=null&&v.ciLower!=='') ? `CI [${v.ciLower}%, ${v.ciUpper}%]` : '';
      const fiText = v.firstInstalls!=null ? `安装 ${v.firstInstalls}` : '';
      const effectHtml = i>0 ? effectBadgeHTML(normEffect(v.effect)) : '';
      const statsHtml = (fiText||ciText||effectHtml) ? `
        <div class="tl-img-stats">
          ${fiText ? `<div class="tl-img-stat">${fiText}</div>` : ''}
          ${ciText ? `<div class="tl-img-stat tl-img-ci">${ciText}</div>` : ''}
          ${effectHtml ? `<div style="margin-top:3px">${effectHtml}</div>` : ''}
        </div>` : '';
      return `
        <div class="tl-detail-img-wrap${v.applied?' is-applied':''}">
          <img class="tl-detail-img" src="${v.imageUrl}" onclick="openLightbox('${v.imageUrl}')" />
          <div class="tl-detail-img-label">${labelText}</div>
          ${v.applied ? '<div class="tl-applied-bar">✓ 已采用</div>' : ''}
          ${statsHtml}
        </div>`;
    }).join('');
  }

  // Header meta
  const metaChips = isUpdate
    ? `<span class="meta-chip">📅 ${t.updateDate||''}</span><span class="badge badge-orange">🔄 直接更新</span>${biTypes.map(b=>`<span class="bi-type-tag">${escHtml(b)}</span>`).join('')}`
    : `<span class="meta-chip">📅 ${t.startDate||''} → ${t.endDate||'进行中'}</span>
       <span class="meta-chip">置信度 ${t.confidence||'-'}%</span>
       ${t.testRatio?`<span class="meta-chip">比例 ${escHtml(t.testRatio)}</span>`:''}
       ${t.experimentType?`<span class="bi-type-tag">${escHtml(t.experimentType)}</span>`:''}
       ${biTypes.map(b=>`<span class="bi-type-tag">${escHtml(b)}</span>`).join('')}
       ${t.tester?`<span class="badge badge-blue">${escHtml(t.tester)}</span>`:''}
       ${appliedVar?`<span class="applied-chip">✓ 测试${appliedIdx} 已采用</span>`:'<span class="not-applied-chip">暂未应用</span>'}`;

  // Progress block
  const progressSection = !isUpdate ? buildProgressBlock(t) : '';

  // Conclusion
  const conclusionSection = !isUpdate ? `
    <div class="tl-detail-section">
      <div class="conc-block conc-manual">
        <div class="conc-title">📝 实验小结</div>
        <textarea class="form-control" id="conc-${t.id}" rows="3" placeholder="填写实验结论、分析和建议…" style="resize:vertical;margin-top:6px;font-size:13px">${escHtml(t.conclusion||'')}</textarea>
        <div style="text-align:right;margin-top:6px"><button class="btn btn-primary btn-sm" onclick="saveConclusion('${t.id}')">💾 保存小结</button></div>
      </div>
    </div>` : '';

  // Notes
  const notesSection = (t.notes?.change||t.notes?.purpose||t.notes?.design) ? `
    <div class="tl-detail-section">
      <div class="card-notes">
        ${t.notes.change?`<div class="note-row"><span class="note-tag">改动</span><span>${escHtml(t.notes.change)}</span></div>`:''}
        ${t.notes.purpose?`<div class="note-row"><span class="note-tag">目的</span><span>${escHtml(t.notes.purpose)}</span></div>`:''}
        ${t.notes.design?`<div class="note-row"><span class="note-tag">思路</span><span>${escHtml(t.notes.design)}</span></div>`:''}
      </div>
    </div>` : '';

  return `<div class="tl-detail-inner">
    <div class="tl-detail-header">
      <div class="tl-detail-title-col">
        <div class="tl-detail-title">${escHtml(t.projectName||'')}</div>
        <div class="tl-detail-meta">${metaChips}</div>
      </div>
      <div class="tl-detail-actions">
        <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">✏️ 编辑</button>
        <button class="btn btn-secondary btn-sm" onclick="showHistory('${t.id}')">🕘 历史</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTestRecord('${t.id}')">🗑 删除</button>
      </div>
    </div>
    ${imagesHtml ? `<div class="tl-detail-images">${imagesHtml}</div>` : ''}
    ${progressSection}
    ${conclusionSection}
    ${notesSection}
  </div>`;
}

function selectTimelineTest(id) {
  state.selectedTestId = id;
  document.querySelectorAll('.tl-list-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });
  const t = state.tests.find(tt => tt.id === id);
  const detailEl = document.getElementById('tl-detail-pane');
  if (detailEl) detailEl.innerHTML = t ? buildTlDetail(t) : `<div class="tl-detail-empty"><div class="empty-icon">👈</div><p>请选择左侧记录查看详情</p></div>`;
}

function onSearchInput(val) {
  state.searchQuery = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { if (state.view === 'timeline') renderTimeline(); }, 350);
}

function applyTimelineFilters() {
  state.sortOrder     = document.getElementById('tl-sort')?.value     || 'desc';
  state.filterProject = document.getElementById('tl-project')?.value  || 'all';
  state.filterExpType = document.getElementById('tl-exptype')?.value  || 'all';
  state.filterEffect  = document.getElementById('tl-effect')?.value   || 'all';
  state.filterBiType  = document.getElementById('tl-bitype')?.value   || 'all';
  renderTimeline();
}
function resetTimelineFilters() {
  state.sortOrder='desc'; state.filterProject='all'; state.filterEffect='all';
  state.filterBiType='all'; state.filterExpType='all'; state.searchQuery='';
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

  const conclusionBlock = `
    <div class="conc-block conc-manual">
      <div class="conc-title">📝 实验小结</div>
      <textarea class="form-control" id="conc-${t.id}" rows="3" placeholder="填写实验结论、分析和建议…" style="resize:vertical;margin-top:6px;font-size:13px">${escHtml(t.conclusion||'')}</textarea>
      <div style="text-align:right;margin-top:6px"><button class="btn btn-primary btn-sm" onclick="saveConclusion('${t.id}')">💾 保存小结</button></div>
    </div>`;

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
            <button class="btn btn-secondary btn-sm" onclick="showHistory('${t.id}')">🕘 历史</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTestRecord('${t.id}')">🗑 删除</button>
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
  const mkThumb = (url, label) => url
    ? `<div class="variant-thumb-wrap"><img class="variant-thumb" src="${url}" onclick="event.stopPropagation();openLightbox('${url}')" style="cursor:zoom-in"/><div class="variant-label">${label}</div></div>`
    : '';
  const mkBig = (url, label) => url
    ? `<div class="variant-thumb-wrap"><img class="variant-thumb-lg" src="${url}" onclick="openLightbox('${url}')" style="cursor:zoom-in"/><div class="variant-label">${label}</div></div>`
    : '';
  const thumbs = mkThumb(t.imageUrl,'原始') + mkThumb(t.newImageUrl,'更新后');
  const bigs   = mkBig(t.imageUrl,'原始')   + mkBig(t.newImageUrl,'更新后');
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
          <div class="test-card-images">${thumbs||'<div class="variant-thumb-placeholder">🖼</div>'}</div>
          <div class="test-card-expand"><span class="expand-icon">▼</span></div>
        </div>
        <div class="test-card-body">
          ${bigs?`<div class="big-thumbs-row">${bigs}</div>`:''}
          ${t.notes?.change?`<div class="card-notes"><div class="note-row"><span class="note-tag">改动</span><span>${escHtml(t.notes.change)}</span></div></div>`:''}
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">✏️ 编辑</button>
            <button class="btn btn-secondary btn-sm" onclick="showHistory('${t.id}')">🕘 历史</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTestRecord('${t.id}')">🗑 删除</button>
          </div>
        </div>
      </div>
    </div>`;
}

function toggleCard(id) { document.getElementById('card-'+id)?.classList.toggle('expanded'); }
function editTest(id) { const t=state.tests.find(tt=>tt.id===id); state.formType=t?.type==='update'?'update':'test'; state.editTestId=id; navigate('form'); }
async function deleteTestRecord(id) {
  if (!confirm('确认删除？删除后会进入回收站，30 天内可恢复。')) return;
  try {
    await deleteTest(id);
    await refreshData();
    toast('已删除（可在管理面板的回收站找回）','success');
    if (state.view === 'form') navigate('timeline');
    else if (state.view === 'timeline') { state.selectedTestId = null; renderTimeline(); }
    else if (state.view === 'dashboard') renderDashboard();
    else render();
  } catch(e) {
    state.pendingCount = await getPendingCount();
    toast('保存到群晖失败，已暂存本地稍后重试','error');
    render();
  }
}
async function saveConclusion(id) {
  const val = document.getElementById(`conc-${id}`)?.value ?? '';
  try {
    await updateTest(id, { conclusion: val.trim() });
    await refreshData();
    toast('实验小结已保存','success');
  } catch(e) {
    state.pendingCount = await getPendingCount();
    toast('保存到群晖失败，已暂存本地稍后重试','error');
    render();
  }
}

// ── 编辑历史 ──────────────────────────────────────────────────
async function showHistory(id) {
  const history = await getRecordHistory(id);
  const test = state.tests.find(t => t.id === id);
  const wrap = document.createElement('div');
  wrap.className = 'history-modal-wrap';
  wrap.id = 'history-wrap';
  const summarize = r => {
    const parts = [];
    if (r.projectName) parts.push(`项目：${r.projectName}`);
    if (r.tester) parts.push(`负责人：${r.tester}`);
    if (r.notes?.change) parts.push(`改动：${r.notes.change}`);
    if (r.conclusion) parts.push(`小结：${r.conclusion.slice(0,40)}${r.conclusion.length>40?'…':''}`);
    return parts.join(' · ');
  };
  const rows = history.length === 0
    ? `<p style="color:var(--text-muted);text-align:center;padding:30px">暂无历史版本（此记录还没被编辑过）</p>`
    : history.map((h,i)=>`
        <div class="history-row">
          <div class="history-row-meta">
            <div class="history-time">${new Date(h.ts).toLocaleString('zh-CN')}</div>
            <div class="history-summary">${escHtml(summarize(h.snapshot))}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="rollbackHistory('${id}', ${i})">回滚到这版</button>
        </div>`).join('');
  wrap.innerHTML = `
    <div class="ocr-modal" style="max-width:700px">
      <h3>🕘 编辑历史 <span style="font-size:13px;font-weight:400;color:var(--text-muted)">最多保留最近 5 次编辑</span></h3>
      <div style="margin-top:14px">${rows}</div>
      <div class="ocr-actions"><button class="btn btn-secondary" onclick="closeHistory()">关闭</button></div>
    </div>`;
  document.body.appendChild(wrap);
}
function closeHistory() { document.getElementById('history-wrap')?.remove(); }
async function rollbackHistory(id, idx) {
  if (!confirm('确认回滚到这个版本？当前版本会被替换（但仍能从更早的历史中找回）。')) return;
  try {
    await rollbackRecord(id, idx);
    await refreshData();
    closeHistory();
    toast('已回滚','success');
    render();
  } catch (e) {
    state.pendingCount = await getPendingCount();
    toast('保存到群晖失败，已暂存本地稍后重试','error');
  }
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
  if (test && ft === 'update') {
    if (test.imageUrl && !formState.previews[0]) formState.previews[0] = test.imageUrl;
    if (test.newImageUrl && !formState.previews[1]) formState.previews[1] = test.newImageUrl;
  }

  const projOpts = state.projects.map(p=>`<option value="${p.id}" data-name="${escHtml(p.name)}" ${test?.projectId===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const testerOpts = (state.settings?.testers||[]).map(n=>`<option value="${n}" ${test?.tester===n?'selected':''}>${escHtml(n)}</option>`).join('');

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
        <div class="form-section-title">🖼️ 截图对比</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div>
            <div class="form-label" style="margin-bottom:4px">原始</div>
            <div class="update-img-zone" onmouseenter="setActiveImgZone(0)" onmouseleave="clearActiveImgZone()" onclick="setActiveImgZone(0)">${buildImgCell(0, {})}</div>
          </div>
          <div>
            <div class="form-label" style="margin-bottom:4px">更新后</div>
            <div class="update-img-zone" onmouseenter="setActiveImgZone(1)" onmouseleave="clearActiveImgZone()" onclick="setActiveImgZone(1)">${buildImgCell(1, {})}</div>
          </div>
        </div>
      </div>`;
  } else {
    const confOpts = [90,95,98,99].map(v=>`<input type="radio" class="radio-option" name="conf" id="conf-${v}" value="${v}" ${(test?.confidence??95)==v?'checked':''}/><label class="radio-label" for="conf-${v}">${v}%</label>`).join('');
    const allExpTypes = state.settings?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;
    const defaultExpType = test?.experimentType ?? '主要商品详情';
    const expTypeOpts = allExpTypes.map(b=>`<option value="${b}" ${defaultExpType===b?'selected':''}>${escHtml(b)}</option>`).join('');
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
          <div class="form-group"><label class="form-label">实验类型</label><select class="form-control" id="f-exptype">${expTypeOpts}</select></div>
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
          <span></span>
          <div class="section-tools">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openCropModal()">✂️ 批量裁剪图标</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="openOCRModal()">📊 上传截图提取数据</button>
          </div>
        </div>
        <div class="variant-columns-wrap">
          <div class="variant-columns">${cols}</div>
        </div>
      </div>
      `;
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
            <div class="modal-footer" style="${isEdit?'justify-content:space-between':''}">
              ${isEdit?`<button type="button" class="btn btn-danger" onclick="deleteTestRecord('${state.editTestId}')">🗑 删除此记录</button>`:''}
              <div style="display:flex;gap:8px;margin-left:auto">
                <button type="button" class="btn btn-secondary" onclick="navigate('timeline')">取消</button>
                <button type="submit" class="btn btn-primary" id="f-submit">${isEdit?'💾 保存修改':'🚀 提交记录'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>`, 'form');
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
      const existRec = state.editTestId ? state.tests.find(t=>t.id===state.editTestId) : null;
      let imageUrl = existRec?.imageUrl || null;
      let newImageUrl = existRec?.newImageUrl || null;
      if (formState.images[0]) imageUrl = await compressImage(formState.images[0]);
      else if (formState.previews[0] && formState.previews[0] !== imageUrl) imageUrl = formState.previews[0];
      if (formState.images[1]) newImageUrl = await compressImage(formState.images[1]);
      else if (formState.previews[1] && formState.previews[1] !== newImageUrl) newImageUrl = formState.previews[1];
      const data = { type:'update', projectId, projectName, tester, updateDate, biVizType, notes, imageUrl, newImageUrl };
      if (state.editTestId) { await updateTest(state.editTestId, data); toast('已保存修改','success'); }
      else { await createTest(data); toast('记录已提交','success'); }
      await refreshData();
    } else {
      const startDate = document.getElementById('f-start').value;
      const endDate = document.getElementById('f-end').value;
      const confidence = Number(document.querySelector('input[name="conf"]:checked')?.value||95);
      const ratioSel = document.getElementById('f-ratio-sel')?.value;
      const testRatio = ratioSel === 'custom' ? (document.getElementById('f-ratio')?.value||'') : (ratioSel||'');
      const experimentType = document.getElementById('f-exptype')?.value || '';
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
      const data={type:'test',projectId,projectName,tester,startDate,endDate,confidence,testRatio,biVizType,experimentType,notes,variants};
      if (state.editTestId) { await updateTest(state.editTestId,data); toast('已保存修改','success'); }
      else { await createTest(data); toast('记录已提交','success'); }
      await refreshData();
    }

    formState.images=[null,null,null,null]; formState.previews=[null,null,null,null];
    state.editTestId=null; navigate('timeline');
  } catch(err) {
    state.pendingCount = await getPendingCount();
    toast('保存到群晖失败，已暂存本地稍后重试','error');
    btn.disabled=false; btn.textContent=state.editTestId?'💾 保存修改':'🚀 提交记录';
  }
}

// ── OCR Modal (Tesseract.js, no API needed) ───────────────────
let ocrFiles = { fi: null, ri: null };
let ocrData  = {};
let activeOcrZone = 'fi';

function setActiveOcrZone(zone) { activeOcrZone = zone; }

function ocrReceiveFile(file, type) {
  if (!file) return;
  ocrFiles[type] = file;
  const thumbEl = document.getElementById(`ocr-${type}-thumb`);
  if (!thumbEl) return;
  const r = new FileReader();
  r.onload = ev => { thumbEl.innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:80px;margin-top:6px;border-radius:4px;border:1px solid var(--border)"/>`; };
  r.readAsDataURL(file);
  const runBtn = document.getElementById('ocr-run-btn');
  if (runBtn && (ocrFiles.fi || ocrFiles.ri)) runBtn.disabled = false;
}

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
          <div class="img-upload-area ocr-drop-zone" id="ocr-fi-area" style="min-height:90px" onmouseenter="setActiveOcrZone('fi')" onclick="setActiveOcrZone('fi')">
            <span class="upload-icon">📤</span><span class="upload-hint">点击上传 / Ctrl+V 粘贴截图</span>
            <input type="file" accept="image/*" onchange="ocrFileSelected(event,'fi')"/>
          </div>
          <div id="ocr-fi-thumb"></div>
        </div>
        <div>
          <div class="ocr-upload-label">保留安装数截图 <span class="ocr-paste-hint">（可 Ctrl+V 粘贴）</span></div>
          <div class="img-upload-area ocr-drop-zone" id="ocr-ri-area" style="min-height:90px" onmouseenter="setActiveOcrZone('ri')" onclick="setActiveOcrZone('ri')">
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

function ocrFileSelected(e, type) { ocrReceiveFile(e.target.files?.[0], type); }

// 把截图放大 + 灰度化，显著提高 Tesseract 识别率
function preprocessForOCR(file, scale = 2.4) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      // 灰度 + 轻度对比增强
      try {
        const data = ctx.getImageData(0, 0, w, h);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          let g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
          g = g < 140 ? g * 0.6 : 255 - (255 - g) * 0.6; // 拉开黑白
          d[i] = d[i+1] = d[i+2] = g;
        }
        ctx.putImageData(data, 0, 0);
      } catch {}
      URL.revokeObjectURL(url);
      canvas.toBlob(b => resolve(b || file), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function runOCR() {
  if (!ocrFiles.fi && !ocrFiles.ri) { toast('请至少上传一张截图','error'); return; }
  document.getElementById('ocr-status').style.display = 'block';
  document.getElementById('ocr-preview-wrap').style.display = 'none';
  document.getElementById('ocr-run-btn').disabled = true;
  document.getElementById('ocr-apply-btn').disabled = true;
  ocrData = {};

  try {
    const setProg = (label, prog) => {
      const p = document.getElementById('ocr-progress');
      if (p) p.textContent = `${label}${prog!=null?` ${Math.round(prog*100)}%`:''}`;
    };
    const logger = m => { if (m.status === 'recognizing text') setProg('识别中', m.progress); };
    const tessOpts = {
      logger,
      tessedit_pageseg_mode: '6',           // 当作整块文本（表格行更稳）
      tessedit_char_whitelist: '0123456789.,%+-±ABCDabcd ',
      preserve_interword_spaces: '1',
    };

    if (ocrFiles.fi) {
      setProg('预处理首次安装截图…');
      const prepped = await preprocessForOCR(ocrFiles.fi);
      const r = await Tesseract.recognize(prepped, 'eng', tessOpts);
      const fiParsed = parseGPlayTable(r.data.text, 'firstInstalls');
      Object.keys(fiParsed).forEach(v => { ocrData[v] = { ...(ocrData[v]||{}), ...fiParsed[v] }; });
    }
    if (ocrFiles.ri) {
      setProg('预处理保留安装截图…');
      const prepped = await preprocessForOCR(ocrFiles.ri);
      const r2 = await Tesseract.recognize(prepped, 'eng', tessOpts);
      const riParsed = parseGPlayTable(r2.data.text, 'retainedInstalls');
      Object.keys(riParsed).forEach(v => { ocrData[v] = { ...(ocrData[v]||{}), ...riParsed[v] }; });
    }

    // 保证四个变体行都出现（即使没识别到也给空行让用户手填）
    ['control','A','B','C'].forEach(k => { if (!ocrData[k]) ocrData[k] = {}; });

    const tbody = document.getElementById('ocr-tbody');
    const variantMap = { control:'原始 (控制组)', A:'测试 1 (A)', B:'测试 2 (B)', C:'测试 3 (C)' };
    const order = ['control','A','B','C'];
    tbody.innerHTML = order.filter(k=>ocrData[k]).map(k=>{
      const d = ocrData[k];
      return `
      <tr data-ocr-key="${k}">
        <td><strong>${variantMap[k]||k}</strong></td>
        <td><input class="form-control ocr-edit" data-field="firstInstalls" type="number" value="${d.firstInstalls??''}" placeholder="—" style="width:100px"/></td>
        <td><input class="form-control ocr-edit" data-field="ciLower" type="number" step="0.1" value="${d.ciLower??''}" placeholder="—" style="width:70px"/></td>
        <td><input class="form-control ocr-edit" data-field="ciUpper" type="number" step="0.1" value="${d.ciUpper??''}" placeholder="—" style="width:70px"/></td>
        <td><input class="form-control ocr-edit" data-field="retainedInstalls" type="number" value="${d.retainedInstalls??''}" placeholder="—" style="width:100px"/></td>
      </tr>`;
    }).join('');
    document.getElementById('ocr-status').style.display = 'none';
    document.getElementById('ocr-preview-wrap').style.display = 'block';
    document.getElementById('ocr-apply-btn').disabled = false;
    const detectedCount = order.filter(k => ocrData[k] && (ocrData[k].firstInstalls!=null || ocrData[k].retainedInstalls!=null)).length;
    toast(detectedCount>1 ? `识别到 ${detectedCount} 个变体，请核对数据后点「填入表单」` : '识别结果可能不准，请手动核对/补充后再填入', detectedCount>1?'success':'info');
  } catch(err) {
    document.getElementById('ocr-status').style.display = 'none';
    toast('识别失败：'+err.message,'error');
    document.getElementById('ocr-run-btn').disabled = false;
  }
}

// ── Google Play 实验表格解析 ─────────────────────────────────
// 表格列：变体 | 受众群体% | 安装人数(当前) | 安装人数(已调整) | 效果(95% CI)
// 我们要的是「已调整」那列（行内较大的安装数），以及 CI 上下限
function _stripNum(s) { return parseInt(String(s).replace(/[.,\s]/g,''), 10); }
function _extractInstalls(str, threshold = 1000) {
  // 匹配带千位分隔（逗号或点）的数，或 4 位以上纯数字
  const out = [];
  const re = /\d{1,3}(?:[.,]\d{3})+|\d{4,}/g;
  let m;
  while ((m = re.exec(str))) { const n = _stripNum(m[0]); if (!isNaN(n) && n >= threshold) out.push({ val:n, idx:m.index, raw:m[0] }); }
  return out;
}
function _extractPercents(str) {
  return [...str.matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g)].map(m => ({ val: parseFloat(m[1]), idx: m.index }));
}

function parseGPlayTable(text, field) {
  const result = {};
  const lines = text.split('\n').map(l => l.replace(/\s+/g,' ').trim()).filter(Boolean);

  // 1) 变体行：行内有独立的 A / B / C / D 字母
  for (const rawLine of lines) {
    const line = rawLine;
    const vm = line.match(/(?:^|[^A-Za-z])([A-Da-d])(?:[^A-Za-z]|$)/);
    if (!vm) continue;
    const variant = vm[1].toUpperCase();
    if (variant === 'D' || result[variant]) continue; // 只支持 A/B/C，首次匹配为准

    const installs = _extractInstalls(line, 1000);
    if (installs.length === 0) continue;
    const sortedByPos = [...installs].sort((a,b)=>a.idx-b.idx);
    // 已调整首次安装 = 前两个安装数中的较大值（前2列=raw+adjusted FI, 后2列=raw+adjusted RI）
    const firstTwo = sortedByPos.slice(0, 2);
    const adjusted = firstTwo.length >= 2 ? Math.max(...firstTwo.map(x=>x.val)) : sortedByPos[0].val;
    // CI 百分比：出现在第一个安装数之后（受众%在第一个安装数之前）
    const firstInstallIdx = sortedByPos[0].idx;
    const pcts = _extractPercents(line).filter(p => p.idx > firstInstallIdx);
    let ciLower = null, ciUpper = null;
    if (pcts.length >= 2) {
      const pair = pcts.slice(0, 2).map(p=>p.val).sort((a,b)=>a-b);
      ciLower = pair[0]; ciUpper = pair[1];
    } else if (pcts.length === 1) {
      if (pcts[0].val < 0) ciLower = pcts[0].val; else ciUpper = pcts[0].val;
    }
    result[variant] = field === 'retainedInstalls'
      ? { retainedInstalls: adjusted }
      : { firstInstalls: adjusted, ciLower, ciUpper };
  }

  // 2) 控制组行：没有 A/B/C 字母、行内有 ≥2 个安装数；取受众%最大的那一行（一般是 70%）
  let bestNums = null, bestLeadPct = -1;
  for (const line of lines) {
    if (/(?:^|[^A-Za-z])[A-Da-d](?:[^A-Za-z]|$)/.test(line)) continue;
    const installs = _extractInstalls(line, 1000);
    if (installs.length < 2) continue;
    const pcts = _extractPercents(line);
    const lead = pcts.length ? Math.abs(pcts[0].val) : 0;
    if (lead >= bestLeadPct) { bestLeadPct = lead; bestNums = [...installs].sort((a,b)=>a.idx-b.idx); }
  }
  if (bestNums) {
    const firstTwo = bestNums.slice(0, 2);
    const controlVal = firstTwo.length >= 2 ? Math.max(...firstTwo.map(x=>x.val)) : bestNums[0].val;
    result['control'] = field === 'retainedInstalls'
      ? { retainedInstalls: controlVal }
      : { firstInstalls: controlVal };
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
let cropDirection = 'horizontal'; // 'horizontal' | 'vertical'
const CROP_COLORS = ['#6B7280','#3B82F6','#8B5CF6','#EC4899'];
const CROP_LABELS = ['原始','测试1','测试2','测试3'];

function openCropModal() {
  cropImg = null; cropDividers = [0.25, 0.5, 0.75]; cropDirection = 'vertical';
  setTimeout(() => { const c = document.getElementById('crop-canvas'); if(c) setupCropDrag(); }, 200);
  const wrap = document.createElement('div');
  wrap.className = 'crop-modal-wrap'; wrap.id = 'crop-wrap';
  wrap.innerHTML = `
    <div class="crop-modal">
      <h3>✂️ 批量裁剪图标</h3>
      <p>上传包含全部变体图标的截图，拖动分割线调整各区域，支持 1~4 个变体</p>
      <div class="form-type-toggle" style="margin-bottom:10px">
        <button type="button" class="type-btn" id="crop-dir-h" onclick="switchCropDirection('horizontal')">↔ 左右裁剪</button>
        <button type="button" class="type-btn active" id="crop-dir-v" onclick="switchCropDirection('vertical')">↕ 上下裁剪</button>
      </div>
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

function switchCropDirection(dir) {
  cropDirection = dir;
  document.getElementById('crop-dir-h')?.classList.toggle('active', dir === 'horizontal');
  document.getElementById('crop-dir-v')?.classList.toggle('active', dir === 'vertical');
  cropDividers = [0.25, 0.5, 0.75];
  if (dir === 'vertical' && cropImg) cropAutoDetect(); else drawCropCanvas();
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
      if (cropDirection === 'vertical') cropAutoDetect(); else drawCropCanvas();
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

function cropAutoDetect() {
  if (!cropImg) return;
  const W = 200, H = Math.round(cropImg.height * 200 / cropImg.width);
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  off.getContext('2d').drawImage(cropImg, 0, 0, W, H);
  const data = off.getContext('2d').getImageData(0, 0, W, H).data;

  // Per row: std-dev of brightness in centre strip
  const cx0 = Math.round(W * 0.2), cx1 = Math.round(W * 0.8), cw = cx1 - cx0;
  const rowScore = new Array(H);
  for (let y = 0; y < H; y++) {
    let sum = 0, sum2 = 0;
    for (let x = cx0; x < cx1; x++) {
      const v = (data[(y*W+x)*4] + data[(y*W+x)*4+1] + data[(y*W+x)*4+2]) / 3;
      sum += v; sum2 += v*v;
    }
    const mean = sum / cw;
    rowScore[y] = Math.sqrt(Math.max(0, sum2/cw - mean*mean));
  }

  // Smooth
  const win = Math.max(2, Math.round(H * 0.015));
  const smooth = rowScore.map((_, y) => {
    let s = 0, c = 0;
    for (let dy = -win; dy <= win; dy++) {
      const yy = y+dy;
      if (yy >= 0 && yy < H) { s += rowScore[yy]; c++; }
    }
    return s/c;
  });

  let maxS = 0;
  smooth.forEach(v => { if (v > maxS) maxS = v; });
  const thresh = Math.max(6, maxS * 0.18);
  const isContent = smooth.map(v => v >= thresh);

  // Find content bands
  const regions = [];
  let inC = false, start = 0;
  for (let y = 0; y <= H; y++) {
    const c = y < H && isContent[y];
    if (c && !inC) { inC = true; start = y; }
    else if (!c && inC) { inC = false; regions.push([start/H, y/H]); }
  }

  if (regions.length >= 2) {
    cropDividers = [];
    for (let i = 0; i < Math.min(regions.length-1, 3); i++) {
      cropDividers.push((regions[i][1] + regions[i+1][0]) / 2);
    }
    drawCropCanvas();
    return;
  }
  cropAutoSplit();
}

function drawCropCanvas() {
  const canvas = document.getElementById('crop-canvas'); if(!canvas||!cropImg) return;
  const MAX_W = Math.min(620, window.innerWidth - 100);
  const MAX_H = Math.min(560, window.innerHeight - 240);
  const scale = Math.min(MAX_W / cropImg.width, MAX_H / cropImg.height, 1);
  canvas.width = Math.round(cropImg.width * scale);
  canvas.height = Math.round(cropImg.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropImg, 0, 0, canvas.width, canvas.height);
  const regions = [0, ...cropDividers, 1];
  if (cropDirection === 'vertical') {
    for (let i=0;i<regions.length-1;i++) {
      const y1 = Math.round(regions[i]*canvas.height);
      const y2 = Math.round(regions[i+1]*canvas.height);
      ctx.fillStyle = CROP_COLORS[i]+'33';
      ctx.fillRect(0, y1, canvas.width, y2-y1);
      ctx.fillStyle = CROP_COLORS[i];
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign='left';
      ctx.fillText(CROP_LABELS[i], 6, y1+16);
    }
    cropDividers.forEach(d => {
      const y = Math.round(d*canvas.height);
      ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
      ctx.strokeStyle='#374151'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#fff'; ctx.strokeStyle='#374151'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(canvas.width/2, y, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#374151'; ctx.font='11px sans-serif'; ctx.textAlign='center';
      ctx.fillText('⇕', canvas.width/2, y+4);
    });
    canvas.style.cursor = 'ns-resize';
  } else {
    for (let i=0;i<regions.length-1;i++) {
      const x1 = Math.round(regions[i]*canvas.width);
      const x2 = Math.round(regions[i+1]*canvas.width);
      ctx.fillStyle = CROP_COLORS[i]+'33';
      ctx.fillRect(x1, 0, x2-x1, canvas.height);
      ctx.fillStyle = CROP_COLORS[i];
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign='left';
      ctx.fillText(CROP_LABELS[i], x1+6, 20);
    }
    cropDividers.forEach(d => {
      const x = Math.round(d*canvas.width);
      ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
      ctx.strokeStyle='#374151'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#fff'; ctx.strokeStyle='#374151'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(x, canvas.height/2, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#374151'; ctx.font='11px sans-serif'; ctx.textAlign='center';
      ctx.fillText('⇔', x, canvas.height/2+4);
    });
    canvas.style.cursor = 'ew-resize';
  }
}

function setupCropDrag() {
  const canvas = document.getElementById('crop-canvas'); if(!canvas) return;
  canvas.onmousedown = e => {
    const rect = canvas.getBoundingClientRect();
    if (cropDirection === 'vertical') {
      const yRatio = (e.clientY - rect.top) / canvas.height;
      draggingDivider = cropDividers.findIndex(d => Math.abs(d - yRatio) < 0.04);
    } else {
      const xRatio = (e.clientX - rect.left) / canvas.width;
      draggingDivider = cropDividers.findIndex(d => Math.abs(d - xRatio) < 0.04);
    }
  };
  canvas.onmousemove = e => {
    if (draggingDivider === null || draggingDivider === -1) return;
    const rect = canvas.getBoundingClientRect();
    if (cropDirection === 'vertical') {
      let r = (e.clientY - rect.top) / canvas.height;
      cropDividers[draggingDivider] = Math.max(0.05, Math.min(0.95, r));
    } else {
      let r = (e.clientX - rect.left) / canvas.width;
      cropDividers[draggingDivider] = Math.max(0.05, Math.min(0.95, r));
    }
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
    if (cropDirection === 'vertical') {
      const y1 = Math.round(regions[i]*cropImg.height);
      const y2 = Math.round(regions[i+1]*cropImg.height);
      const h = y2-y1;
      offscreen.width = cropImg.width; offscreen.height = h;
      ctx.clearRect(0,0,cropImg.width,h);
      ctx.drawImage(cropImg, 0, y1, cropImg.width, h, 0, 0, cropImg.width, h);
    } else {
      const x1 = Math.round(regions[i]*cropImg.width);
      const x2 = Math.round(regions[i+1]*cropImg.width);
      const w = x2-x1;
      offscreen.width = w; offscreen.height = cropImg.height;
      ctx.clearRect(0,0,w,cropImg.height);
      ctx.drawImage(cropImg, x1, 0, w, cropImg.height, 0, 0, w, cropImg.height);
    }
    const dataUrl = offscreen.toDataURL('image/jpeg', 0.85);
    formState.previews[i] = dataUrl;
    formState.images[i] = null;
    showPreview(i, dataUrl);
  }
  closeCropModal();
  toast('图标已裁剪填入，请确认效果','success');
}

function closeCropModal() { document.getElementById('crop-wrap')?.remove(); }
// ── Admin ─────────────────────────────────────────────────────
async function renderAdmin() {
  const [settings, projects, trash, backups] = await Promise.all([
    getSettings(), getProjects(), getTrash(), getDailyBackups()
  ]);
  const testers = settings?.testers || [];
  const ratioPresets = settings?.ratioPresets || RATIO_PRESETS;
  const experimentTypes = settings?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;

  const projHTML = projects.map(p=>`<span class="admin-chip">${escHtml(p.name)}<button onclick="removeProject('${p.id}')">×</button></span>`).join('');
  const testHTML = testers.map(n=>`<span class="admin-chip">${escHtml(n)}<button onclick="removeTesterItem('${escHtml(n)}')">×</button></span>`).join('');
  const ratioHTML = ratioPresets.map(r=>`<span class="admin-chip admin-chip-mono">${escHtml(r)}<button onclick="removeRatioPresetItem('${escHtml(r)}')">×</button></span>`).join('');
  const expTypeHTML = experimentTypes.map(r=>`<span class="admin-chip admin-chip-accent">${escHtml(r)}<button onclick="removeExpTypeItem('${escHtml(r)}')">×</button></span>`).join('');

  const trashHTML = trash.length === 0
    ? '<li style="color:var(--text-muted)">回收站为空</li>'
    : trash.map(t=>{
        const dateInfo = t.type==='update'?(t.updateDate||''):(t.startDate||'');
        return `<li>
          <span>${escHtml(t.projectName||'')} <span style="font-size:11px;color:var(--text-muted)">${escHtml(t.tester||'')} · ${escHtml(dateInfo)} · 删于 ${new Date(t._deleted_at).toLocaleString('zh-CN')}</span></span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="restoreTrashItem('${t.id}')">↩ 还原</button>
            <button class="btn btn-danger btn-sm" onclick="purgeTrashRecord('${t.id}')">永久删除</button>
          </div>
        </li>`;
      }).join('');

  const backupsHTML = backups.length === 0
    ? '<li style="color:var(--text-muted)">还没有备份（每天首次保存时自动创建）</li>'
    : backups.slice(0, 30).map(d => `
        <li>
          <span>📦 ${d}</span>
          <button class="btn btn-secondary btn-sm" onclick="restoreDailyBackup('${d}')">还原到这一天</button>
        </li>`).join('');

  renderShell(`
    <div class="page-header"><div class="page-title">⚙️ 管理面板</div></div>
    <div class="admin-grid-2">
      <div class="admin-card">
        <div class="admin-section-header"><h3>🧑‍💻 测试人员名单</h3><span class="badge-count">${testers.length}</span></div>
        <div class="admin-chips-wrap">${testHTML||'<span style="color:var(--text-muted);font-size:13px">暂无</span>'}</div>
        <div class="add-row"><input class="form-control" id="add-tester" type="text" placeholder="添加测试人…"/><button class="btn btn-primary btn-sm" onclick="addTesterItem()">添加</button></div>
      </div>
      <div class="admin-card">
        <div class="admin-section-header"><h3>🧪 实验类型选项</h3><span class="badge-count">${experimentTypes.length}</span></div>
        <div class="admin-chips-wrap">${expTypeHTML||'<span style="color:var(--text-muted);font-size:13px">暂无</span>'}</div>
        <div class="add-row"><input class="form-control" id="add-exptype" type="text" placeholder="如 本地化 TH 或 主图测试"/><button class="btn btn-primary btn-sm" onclick="addExpTypeItem()">添加</button></div>
      </div>
      <div class="admin-card">
        <div class="admin-section-header"><h3>📐 测试比例选项</h3><span class="badge-count">${ratioPresets.length}</span></div>
        <div class="admin-chips-wrap">${ratioHTML||'<span style="color:var(--text-muted);font-size:13px">暂无</span>'}</div>
        <div class="add-row"><input class="form-control" id="add-ratio" type="text" placeholder="如 40/30/30 或 20/80"/><button class="btn btn-primary btn-sm" onclick="addRatioPresetItem()">添加</button></div>
      </div>
      <div class="admin-card">
        <div class="admin-section-header"><h3>📁 项目管理</h3><span class="badge-count">${projects.length}</span></div>
        <div class="admin-chips-wrap">${projHTML||'<span style="color:var(--text-muted);font-size:13px">暂无项目</span>'}</div>
        <div class="add-row" style="align-items:flex-end"><textarea class="form-control" id="add-proj" rows="2" placeholder="每行一个项目名，或用英文逗号隔开，批量添加" style="resize:vertical;min-height:56px"></textarea><button class="btn btn-primary btn-sm" onclick="addProjectItem()">批量添加</button></div>
      </div>
      <div class="admin-card admin-card-full">
        <div class="admin-section-header"><h3>🗑 回收站</h3><span style="font-size:12px;color:var(--text-muted)">删除的记录保留 30 天，可一键还原</span></div>
        <ul class="admin-list">${trashHTML}</ul>
      </div>
      <div class="admin-card admin-card-full">
        <div class="admin-section-header"><h3>📦 每日整库快照</h3><span style="font-size:12px;color:var(--text-muted)">每天首次保存时自动备份，保留最近 30 天</span></div>
        <ul class="admin-list">${backupsHTML}</ul>
      </div>
    </div>`, 'admin');
}

async function safeAdminAction(fn, successMsg) {
  try {
    await fn();
    await refreshData();
    if (successMsg) toast(successMsg, 'success');
    renderAdmin();
  } catch (e) {
    state.pendingCount = await getPendingCount();
    toast('保存到群晖失败，已暂存本地稍后重试', 'error');
    renderAdmin();
  }
}

async function addProjectItem() {
  const raw = document.getElementById('add-proj').value;
  // Split by newline and comma, trim each, filter empty, deduplicate
  const names = [...new Set(
    raw.split(/[\n,]/).map(s=>s.trim()).filter(s=>s.length>0)
  )];
  if (names.length === 0) return;
  document.getElementById('add-proj').value = '';
  try {
    for (const n of names) { await addProject(n); }
    await refreshData();
    toast(`已添加 ${names.length} 个项目`, 'success');
    renderAdmin();
  } catch (e) {
    state.pendingCount = await getPendingCount();
    toast('保存到群晖失败，已暂存本地稍后重试', 'error');
    renderAdmin();
  }
}
async function removeProject(id) {
  if (!confirm('确认删除此项目？')) return;
  await safeAdminAction(() => deleteProject(id), '已删除项目');
}
async function addTesterItem() {
  const n = document.getElementById('add-tester').value.trim(); if(!n) return;
  document.getElementById('add-tester').value='';
  await safeAdminAction(() => addTester(n), '测试人员已添加');
}
async function removeTesterItem(name) {
  if (!confirm(`确认移除 ${name}？`)) return;
  await safeAdminAction(() => removeTester(name), '已移除');
}
async function addRatioPresetItem() {
  const n = document.getElementById('add-ratio').value.trim(); if(!n) return;
  const s = await getSettings();
  const presets = s?.ratioPresets || RATIO_PRESETS;
  if (presets.includes(n)) { toast('该选项已存在','info'); return; }
  document.getElementById('add-ratio').value = '';
  await safeAdminAction(() => updateSettings({ ratioPresets: [...presets, n] }), '比例选项已添加');
}
async function removeRatioPresetItem(r) {
  if (!confirm(`移除比例选项「${r}」？`)) return;
  const s = await getSettings();
  await safeAdminAction(
    () => updateSettings({ ratioPresets: (s?.ratioPresets || RATIO_PRESETS).filter(p=>p!==r) }),
    '已移除'
  );
}
async function addExpTypeItem() {
  const n = document.getElementById('add-exptype').value.trim(); if(!n) return;
  const s = await getSettings();
  const types = s?.experimentTypes || DEFAULT_EXPERIMENT_TYPES;
  if (types.includes(n)) { toast('该选项已存在','info'); return; }
  document.getElementById('add-exptype').value = '';
  await safeAdminAction(() => updateSettings({ experimentTypes: [...types, n] }), '实验类型已添加');
}
async function removeExpTypeItem(r) {
  if (!confirm(`移除实验类型「${r}」？`)) return;
  const s = await getSettings();
  await safeAdminAction(
    () => updateSettings({ experimentTypes: (s?.experimentTypes || DEFAULT_EXPERIMENT_TYPES).filter(p=>p!==r) }),
    '已移除'
  );
}

async function restoreTrashItem(id) {
  await safeAdminAction(() => restoreFromTrash(id), '已从回收站还原');
}
async function purgeTrashRecord(id) {
  if (!confirm('永久删除这条记录？无法恢复。')) return;
  await safeAdminAction(() => purgeTrashItem(id), '已永久删除');
}
async function restoreDailyBackup(date) {
  if (!confirm(`将 tests.json 还原到 ${date} 的状态？\n\n当前状态会先自动备份一份，可以再还原回来。`)) return;
  await safeAdminAction(() => restoreFromBackup(date), `已还原到 ${date}`);
}


// ── Profile page ──────────────────────────────────────────────
function profileAvatarLgHTML() {
  const prof = getProfile();
  if (prof.avatar) return `<img class="profile-avatar-lg" id="profile-avatar-preview" src="${prof.avatar}" alt="" />`;
  const initial = (prof.name && prof.name.trim()[0]) || '👤';
  return `<span class="profile-avatar-lg placeholder" id="profile-avatar-preview">${escHtml(initial)}</span>`;
}

function renderProfile() {
  const prof = getProfile();
  renderShell(`
    <div class="page-header"><div class="page-title">👤 个人信息</div></div>
    <div class="admin-card" style="max-width:480px">
      <h3>👤 个人信息</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">仅保存在当前浏览器，不会上传到群晖</p>
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px">
        ${profileAvatarLgHTML()}
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">更换头像
            <input type="file" accept="image/*" style="display:none" onchange="profileAvatarSelected(event)"/>
          </label>
          ${prof.avatar ? `<button class="btn btn-danger btn-sm" onclick="removeProfileAvatar()">移除头像</button>` : ''}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">姓名</label>
        <input class="form-control" id="profile-name" type="text" placeholder="你的名字" value="${escHtml(prof.name||'')}"/>
      </div>
      <button class="btn btn-primary" onclick="saveProfileName()">💾 保存</button>
    </div>
  `, 'profile');
}

async function profileAvatarSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const dataUrl = await compressImage(file, 256, 0.8);
    const prof = getProfile();
    saveProfile({ name: prof.name || '', avatar: dataUrl });
    toast('头像已更新', 'success');
    renderProfile();
  } catch (err) { toast('头像处理失败：' + err.message, 'error'); }
}

function removeProfileAvatar() {
  const prof = getProfile();
  saveProfile({ name: prof.name || '', avatar: null });
  renderProfile();
}

function saveProfileName() {
  const name = (document.getElementById('profile-name')?.value || '').trim();
  saveProfile({ name, avatar: getProfile().avatar || null });
  toast('已保存', 'success');
  renderProfile();
}

// ── Expose globals (needed for inline onclick) ────────────────
Object.assign(window, {
  openOCRModal, closeOCRModal, runOCR, applyOCRData, ocrFileSelected, setActiveOcrZone,
  openCropModal, closeCropModal, cropImgSelected, cropAutoSplit, applyCrop, switchCropDirection,
  navigate, filterTimeline, applyTimelineFilters, resetTimelineFilters, onSearchInput, toggleCard, editTest, deleteTestRecord, saveConclusion, selectTimelineTest, handleRatioChange,
  handleFormSubmit, handleImgSelect, handleDrop, removeImg,
  activatePaste, setActiveImgZone, clearActiveImgZone, switchFormType,
  updateEffectSelect, updateEffectBadge, openLightbox,
  addProjectItem, removeProject, addTesterItem, removeTesterItem,
  addRatioPresetItem, removeRatioPresetItem, addExpTypeItem, removeExpTypeItem,
  showHistory, closeHistory, rollbackHistory,
  restoreTrashItem, purgeTrashRecord, restoreDailyBackup,
  _pickFolder, _resumeFolder, _refreshFromDisk, _syncPending,
  profileAvatarSelected, removeProfileAvatar, saveProfileName,
});
