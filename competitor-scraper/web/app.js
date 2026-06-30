// ================================================================
// app.js — 看板前端（无框架）。Hash 路由：#/ 列表，#/app/<appId> 详情
// ================================================================
const $app = document.getElementById('app');
let TYPE_LABEL = { screenshot: '五图', feature: '置顶大图', icon: 'icon', video: '视频', event: '活动图' };
const TYPE_ORDER = ['screenshot', 'feature', 'icon', 'video', 'event'];
const WIDE_TYPES = new Set(['feature', 'event', 'video']); // 横图

// ── 工具 ────────────────────────────────────────────────────────
const api = async (url, opts) => (await fetch(url, opts)).json();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function fmt(iso) {
  if (!iso) return '从未';
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toTimeString().slice(0, 5);
  if (sameDay) return '今天 ' + hm;
  if (diff < 86400 * 2) return '昨天 ' + hm;
  if (diff < 86400 * 8) return Math.floor(diff / 86400) + ' 天前';
  return iso.slice(0, 10);
}
function colorFor(s) {
  let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg,hsl(${h},65%,60%),hsl(${(h + 40) % 360},65%,48%))`;
}
function iconHtml(c) {
  const icon = c.iconSrc || c.icon;
  if (icon) return `<img class="icon" src="${esc(icon)}" alt="">`;
  const letter = (c.name || c.appId || '?').trim().charAt(0).toUpperCase();
  return `<div class="icon" style="background:${colorFor(c.appId || c.name)}">${esc(letter)}</div>`;
}

// ── 列表页 ──────────────────────────────────────────────────────
let listFilter = 'all';
async function renderList() {
  const data = await api('/api/competitors');
  const updates = data.filter((c) => c.hasUpdate).length;
  const total = data.reduce((s, c) => s + c.total, 0);
  const lastScrape = data.map((c) => c.lastScrapeAt).filter(Boolean).sort().pop();
  const shown = listFilter === 'update' ? data.filter((c) => c.hasUpdate) : data;

  $app.innerHTML = `
  <div class="wrap">
    <div class="top">
      <h1><span class="dot"></span>竞品素材监控看板</h1>
      <div class="actions">
        <button class="btn primary" id="scrapeAll">⟳ 抓取全部</button>
      </div>
    </div>
    <div class="addbar">
      <input id="addInput" placeholder="粘贴 Google Play 链接或包名，多个用空格隔开，回车添加">
      <button class="btn" id="addBtn">+ 添加竞品</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="n">${data.length}</div><div class="l">监控竞品</div></div>
      <div class="stat"><div class="n ${updates ? 'up' : ''}">${updates}</div><div class="l">有更新</div></div>
      <div class="stat"><div class="n">${total}</div><div class="l">素材总数</div></div>
      <div class="stat"><div class="n" style="font-size:18px">${fmt(lastScrape)}</div><div class="l">最近抓取</div></div>
    </div>
    <div class="filters">
      <span class="chip ${listFilter === 'all' ? 'on' : ''}" data-f="all">全部 ${data.length}</span>
      <span class="chip ${listFilter === 'update' ? 'on' : ''}" data-f="update">有更新 ${updates}</span>
    </div>
    ${shown.length ? `<div class="grid">${shown.map(cardHtml).join('')}</div>`
      : `<div class="empty">${data.length ? '没有符合条件的竞品' : '还没有竞品。上面粘贴 Google Play 链接添加，然后点「抓取全部」。'}</div>`}
  </div>`;

  document.getElementById('addBtn').onclick = addFromInput;
  document.getElementById('addInput').onkeydown = (e) => { if (e.key === 'Enter') addFromInput(); };
  document.getElementById('scrapeAll').onclick = scrapeAll;
  $app.querySelectorAll('.chip').forEach((ch) => ch.onclick = () => { listFilter = ch.dataset.f; renderList(); });
  $app.querySelectorAll('.comp').forEach((el) => {
    el.querySelector('.del').onclick = (e) => { e.stopPropagation(); delCompetitor(el.dataset.id, el.dataset.name); };
    el.querySelector('.scrapeOne').onclick = (e) => { e.stopPropagation(); scrapeOne(el.dataset.id); };
    el.onclick = () => { location.hash = '#/app/' + encodeURIComponent(el.dataset.id); };
  });
}

function cardHtml(c) {
  const badge = !c.scraped ? `<span class="badge no">未抓取</span>`
    : c.hasUpdate ? `<span class="badge up">● 有更新</span>` : `<span class="badge ok">✓ 已最新</span>`;
  const mats = previewMats(c);
  const counts = TYPE_ORDER.filter((t) => c.counts[t]).map((t) => `<span>${TYPE_LABEL[t]} <b>${c.counts[t]}</b></span>`).join('');
  return `
  <div class="comp" data-id="${esc(c.appId)}" data-name="${esc(c.name)}">
    ${badge}
    <div class="hd">${iconHtml(c)}<div><div class="name">${esc(c.name)}</div><div class="dev">${esc(c.developer || c.appId)}</div></div></div>
    <div class="time">最近抓取：${fmt(c.lastScrapeAt)}${c.lastChangeAt ? ` · 最近变更：${fmt(c.lastChangeAt)}` : ''}</div>
    <div class="mats">${mats || '<span class="muted" style="align-self:center">尚无素材，点「抓取」</span>'}</div>
    <div class="counts">${counts || ''}</div>
    <div class="ft">
      <button class="btn sm scrapeOne">⟳ 抓取</button>
      <button class="btn sm del">删除</button>
    </div>
  </div>`;
}
// 列表卡片不预存图片地址（摘要接口没给逐图），用占位；详情页才拉全部图
function previewMats() { return ''; }

async function addFromInput() {
  const inp = document.getElementById('addInput');
  const v = inp.value.trim(); if (!v) return;
  const links = v.split(/\s+/);
  const r = await api('/api/competitors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ links }) });
  const ok = r.results.filter((x) => x.appId && !x.error).length;
  const dup = r.results.filter((x) => x.already).length;
  const bad = r.results.filter((x) => x.error);
  inp.value = '';
  toast(`添加 ${ok - dup} 个${dup ? `，已存在 ${dup}` : ''}${bad.length ? `，无法识别 ${bad.length}` : ''}`);
  renderList();
}
async function delCompetitor(appId, name) {
  if (!confirm(`删除竞品「${name}」？（已抓的图保留在本地，不删）`)) return;
  await api('/api/competitor/' + encodeURIComponent(appId), { method: 'DELETE' });
  toast('已删除'); renderList();
}
async function scrapeOne(appId) {
  toast('开始抓取…'); setBusy(true);
  const r = await api('/api/scrape', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appId }) });
  reportScrape(r.results); setBusy(false); renderList();
}
async function scrapeAll() {
  toast('开始抓取全部…可能要等一会'); setBusy(true);
  const r = await api('/api/scrape', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  reportScrape(r.results); setBusy(false); renderList();
}
function reportScrape(results) {
  const fail = results.filter((x) => x.error);
  const changed = results.filter((x) => x.changed).length;
  const ok = results.filter((x) => !x.error).length;
  if (fail.length) toast(`完成 ${ok}，失败 ${fail.length}（多半是代理/网络）：${fail[0].error?.slice(0, 40) || ''}`);
  else toast(`抓取完成 ${ok} 个${changed ? `，其中 ${changed} 个有更新` : '，无变化'}`);
}
function setBusy(b) {
  document.querySelectorAll('button').forEach((x) => x.disabled = b);
}

// ── 详情页 ──────────────────────────────────────────────────────
let detailTab = 'all';
async function renderDetail(appId) {
  const d = await api('/api/competitor/' + encodeURIComponent(appId));
  const tabs = [['all', '全部'], ...TYPE_ORDER.map((t) => [t, TYPE_LABEL[t]]), ['changes', '🕒 变更记录']];
  const tabBtn = ([key, label]) => {
    const n = key === 'all' ? d.counts ? Object.values(d.counts).reduce((a, b) => a + b, 0) : 0
      : key === 'changes' ? d.changes.length : (d.counts[key] || 0);
    return `<span class="tab ${detailTab === key ? 'on' : ''}" data-t="${key}">${label}${n ? `<span class="b">${n}</span>` : ''}</span>`;
  };

  $app.innerHTML = `
  <div class="wrap">
    <a class="back" href="#/">← 返回看板</a>
    <div class="dhd">
      ${iconHtml({ iconSrc: d.iconSrc, appId: d.appId, name: d.title })}
      <div><div class="name">${esc(d.title)}</div><div class="dev">${esc(d.developer || '')} · ${esc(d.appId)}</div>
        <a href="${esc(d.url)}" target="_blank" style="font-size:12px">Google Play ↗</a></div>
      <div class="meta">
        ${d.lastChangeAt && isRecent(d.lastChangeAt, d.lastScrapeAt) ? '<span class="badge up" style="position:static">● 有更新</span><br>' : ''}
        最近抓取：${fmt(d.lastScrapeAt)}<br>
        ${d.firstScrapeAt ? `监控自 ${d.firstScrapeAt.slice(0, 10)}（${d.snapshotCount} 次快照）` : '尚未抓取'}
      </div>
    </div>
    <div class="tabs">${tabs.map(tabBtn).join('')}</div>
    <div id="dbody"></div>
  </div>`;

  $app.querySelectorAll('.tab').forEach((t) => t.onclick = () => { detailTab = t.dataset.t; renderDetailBody(d); });
  renderDetailBody(d);
}
function isRecent(changeAt, scrapeAt) { return changeAt && scrapeAt && changeAt === scrapeAt; }

function galleryHtml(items) {
  if (!items.length) return '';
  const wide = WIDE_TYPES.has(items[0].type);
  return `<div class="gal ${wide ? 'wide' : ''}">` +
    items.map((i) => i.src ? `<a href="${esc(i.src)}" target="_blank"><img src="${esc(i.src)}" loading="lazy"></a>` : '').join('') +
    `</div>`;
}
function renderDetailBody(d) {
  const body = document.getElementById('dbody');
  if (detailTab === 'changes') {
    if (!d.changes.length) { body.innerHTML = `<div class="empty">还没有变更记录。多抓几次后，对方一换图这里就会出现「旧→新」对比。<br>（历史从开始监控当天累积）</div>`; return; }
    body.innerHTML = `<div class="tl">` + d.changes.map((c, idx) => `
      <div class="ev ${idx === d.changes.length - 1 ? '' : ''}">
        <div class="when">${fmt(c.at)}</div>
        <div class="what">${c.added.length ? `新增 <b>${c.added.length}</b> 张` : ''}${c.added.length && c.removed.length ? '，' : ''}${c.removed.length ? `移除/替换 <b>${c.removed.length}</b> 张` : ''}</div>
        <div class="thumbs">
          ${c.added.map((i) => i.src ? `<img class="add" src="${esc(i.src)}" title="新增 ${TYPE_LABEL[i.type] || ''}">` : '').join('')}
          ${c.removed.map((i) => i.src ? `<img class="rem" src="${esc(i.src)}" title="移除 ${TYPE_LABEL[i.type] || ''}">` : '').join('')}
        </div>
      </div>`).join('') + `</div>`;
    return;
  }
  const types = detailTab === 'all' ? TYPE_ORDER : [detailTab];
  let html = '';
  for (const t of types) {
    const items = d.current[t] || [];
    if (!items.length) { if (detailTab !== 'all') html += `<div class="empty">暂无「${TYPE_LABEL[t]}」</div>`; continue; }
    html += `<div class="sec-title">${TYPE_LABEL[t]} · ${items.length} 张</div>` + galleryHtml(items);
  }
  body.innerHTML = html || `<div class="empty">还没抓到素材，回看板点「抓取」。</div>`;
}

// ── 路由 ────────────────────────────────────────────────────────
async function route() {
  const h = location.hash || '#/';
  $app.innerHTML = '<div class="loading">加载中…</div>';
  try {
    const m = h.match(/^#\/app\/(.+)$/);
    if (m) { detailTab = 'all'; await renderDetail(decodeURIComponent(m[1])); }
    else { await renderList(); }
  } catch (e) {
    $app.innerHTML = `<div class="wrap"><div class="empty">出错了：${esc(e.message)}<br>看服务器窗口的报错。</div></div>`;
  }
}
window.addEventListener('hashchange', route);
(async () => {
  try { const meta = await api('/api/meta'); if (meta.typeLabel) TYPE_LABEL = meta.typeLabel; } catch {}
  route();
})();
