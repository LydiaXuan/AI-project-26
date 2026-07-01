"use strict";

/* ---------------- constants ---------------- */
const STORE_KEY = "aiOpsWorkflowV1";
const STATUS_LIST = ["已实现", "进行中", "未开始", "实现不了", "已归档"];
const COLS = ["采集", "分析生成", "人工确认", "回写·推送"];
const PIPE_ORDER = ["done", "wip", "gap", "na"];
const PIPE_LABEL = { done: "已通", wip: "进行中", gap: "断点", na: "—" };
const PIPE_CLASS = { done: "sig", wip: "wip", gap: "brk", na: "na" };
const STATUS_COLOR = {
  "已实现": "#1C8F63", "进行中": "#C4841A", "未开始": "#818B9C",
  "实现不了": "#B8412A", "已归档": "#B7B2A2"
};

/* ---------------- state ---------------- */
let state = loadState();
let editMode = true;
let flt = "全部";
let searchQuery = "";
let dragSrc = null;
let donutChart = null, stackChart = null;
let saveTimer = null;

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.stages)) return parsed;
    }
  } catch (e) { /* fall through to default */ }
  return deepClone(DEFAULT_DATA);
}

function saveStateNow() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  flashSaved();
}

function saveStateDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStateNow, 400);
}

function flashSaved() {
  const el = document.getElementById("saveHint");
  if (!el) return;
  el.textContent = "已保存 · " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
  el.classList.add("show");
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => el.classList.remove("show"), 1800);
}

function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ---------------- derived data ---------------- */
function allTools() { return state.stages.flatMap((s) => s.tools); }
function pipeStages() { return state.stages.filter((s) => !s.foundation); }
function foundationStage() { return state.stages.find((s) => s.foundation); }
function stageStats(stage) {
  const n = stage.tools.length;
  const done = stage.tools.filter((t) => t.s === "已实现").length;
  return { n, done, pct: n ? Math.round((done / n) * 100) : 0 };
}

/* ==================================================================
   RENDER: hero
   ================================================================== */
function renderHero() {
  const all = allTools();
  const total = all.length;
  const done = all.filter((t) => t.s === "已实现").length;
  const wip = all.filter((t) => t.s === "进行中").length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statTotalLab").textContent = `工具总数 · ${state.stages.length} 环节`;
  document.getElementById("statDone").textContent = done;
  document.getElementById("statDoneLab").textContent = `已落地 · ${total ? Math.round((done / total) * 100) : 0}%`;
  document.getElementById("statWip").textContent = wip;
  document.getElementById("statGap").textContent = state.gaps.length;
}

/* ==================================================================
   RENDER: flow overview (advanced svg visualization)
   ================================================================== */
function renderFlow() {
  const holder = document.getElementById("flowSvgHolder");
  const stages = pipeStages();
  const found = foundationStage();
  const pos = [
    { x: 100, y: 66 }, { x: 335, y: 66 }, { x: 570, y: 66 }, { x: 805, y: 66 },
    { x: 805, y: 224 }, { x: 570, y: 224 }, { x: 335, y: 224 }, { x: 100, y: 224 }
  ];
  const W = 900, H = 340;
  let paths = "";
  // top row S1-S4
  for (let i = 0; i < 3; i++) paths += flowSeg(stages[i], stages[i + 1], pos[i], pos[i + 1]);
  // drop S4->S5
  paths += flowSeg(stages[3], stages[4], pos[3], pos[4]);
  // bottom row S5-S8
  for (let i = 4; i < 7; i++) paths += flowSeg(stages[i], stages[i + 1], pos[i], pos[i + 1]);

  let drops = "";
  pos.forEach((p) => { drops += `<line class="flow-drop" x1="${p.x}" y1="${p.y + 34}" x2="${p.x}" y2="300"/>`; });

  let nodes = "";
  stages.forEach((s, i) => {
    const { n, done, pct } = stageStats(s);
    const r = clamp(24 + n * 0.7, 24, 44);
    const ring = s.pipeline.includes("gap") ? "ring-gap" : s.pipeline.includes("wip") ? "ring-wip" : "ring-sig";
    const p = pos[i];
    nodes += `<g class="fnode ${ring}" data-stage="${s.id}">
      <circle class="ring" cx="${p.x}" cy="${p.y}" r="${r}"></circle>
      <text class="fid" x="${p.x}" y="${p.y - r - 10}" text-anchor="middle">${s.id}</text>
      <text class="fpct" x="${p.x}" y="${p.y + 5}" text-anchor="middle">${pct}%</text>
      <text class="fname" x="${p.x}" y="${p.y + r + 16}" text-anchor="middle">${esc(shorten(s.name, 8))}</text>
    </g>`;
  });

  const fstats = found ? stageStats(found) : { n: 0, done: 0, pct: 0 };
  const foundRing = found && found.tools.some((t) => t.s === "进行中") ? "var(--wip)" : "var(--sig)";
  const foundation = `
    <rect class="found-bar-bg" x="70" y="300" width="765" height="30" rx="4" style="stroke:${foundRing}"></rect>
    <text class="found-label" x="86" y="319">${found ? found.id : "S9"} · ${found ? esc(found.name) : ""} · ${fstats.pct}% 落地（${fstats.done}/${fstats.n}）</text>
  `;

  holder.innerHTML = `<svg class="flowsvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${drops}
    ${paths}
    ${nodes}
    ${foundation}
  </svg>`;

  holder.querySelectorAll(".fnode").forEach((g) => {
    g.addEventListener("click", () => jumpToStage(g.dataset.stage));
  });
}

function flowSeg(sA, sB, pA, pB) {
  const on = sA && sB && !sA.pipeline.includes("gap") && !sB.pipeline.includes("gap");
  return `<path class="flow-path ${on ? "on" : ""}" d="M${pA.x} ${pA.y} L${pB.x} ${pB.y}"></path>`;
}

function shorten(str, n) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function jumpToStage(id) {
  const el = document.getElementById("stage-" + id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1300);
}

/* ==================================================================
   RENDER: board matrix
   ================================================================== */
function renderBoard() {
  const rowsEl = document.getElementById("boardRows");
  const stages = pipeStages();
  let html = "";
  stages.forEach((s) => {
    const closed = s.pipeline.every((x) => x === "done" || x === "na");
    const { n, done } = stageStats(s);
    let cells = `<div class="track-name" data-stage="${s.id}">
      <b ${editMode ? 'contenteditable="true"' : ""} data-role="stagename" data-stage="${s.id}">${esc(s.name)}</b>
      <span class="meta">${closed ? "● 闭环" : "○ 待通"} · 已落地 ${done}/${n}</span>
    </div>`;
    s.pipeline.forEach((st, i) => {
      let wire = "";
      if (i < 3) {
        const a = s.pipeline[i], c = s.pipeline[i + 1];
        if (a === "na" || c === "na") wire = "wire mute";
        else if (a === "done" && c === "done") wire = "wire";
        else wire = "wire dead";
      }
      const chip = st === "na" ? `<span class="chip na">—</span>` : `<span class="chip ${PIPE_CLASS[st]}">${PIPE_LABEL[st]}</span>`;
      cells += `<div class="node ${wire} ${editMode ? "editable" : ""}" data-stage="${s.id}" data-col="${i}">${chip}</div>`;
    });
    html += `<div class="track" id="tr-${s.id}">${cells}</div>`;
  });
  rowsEl.innerHTML = html;
}

/* ==================================================================
   RENDER: foundation summary pills
   ================================================================== */
function renderFoundation() {
  const found = foundationStage();
  const el = document.getElementById("foundationItems");
  if (!found) { el.innerHTML = ""; return; }
  el.innerHTML = found.tools.map((t) =>
    `<span class="fpill ${t.s === "进行中" ? "wip" : ""}">${esc(shorten(t.n, 20))}</span>`
  ).join("");
  document.getElementById("foundationTxt").textContent =
    `${found.name} · 横向支撑上面所有链路，决定散工具能否被编排成系统。`;
}

/* ==================================================================
   RENDER: gap cards
   ================================================================== */
function renderGaps() {
  const el = document.getElementById("gapsList");
  el.innerHTML = state.gaps.map((g, idx) => `
    <div class="gap" data-n="${idx + 1}">
      <div class="where">
        <span ${editMode ? 'contenteditable="true"' : ""} data-role="gap" data-field="tag" data-idx="${idx}">${esc(g.tag)}</span>
        ${editMode ? `<button class="gap-del" data-idx="${idx}">删除此断点</button>` : ""}
      </div>
      <h3 ${editMode ? 'contenteditable="true"' : ""} data-role="gap" data-field="title" data-idx="${idx}">${esc(g.title)}</h3>
      <p ${editMode ? 'contenteditable="true"' : ""} data-role="gap" data-field="desc" data-idx="${idx}">${esc(g.desc)}</p>
      <div class="fix">
        <span class="k" ${editMode ? 'contenteditable="true"' : ""} data-role="gap" data-field="fixLabel" data-idx="${idx}">${esc(g.fixLabel)}</span>
        <span class="v" ${editMode ? 'contenteditable="true"' : ""} data-role="gap" data-field="fixText" data-idx="${idx}">${esc(g.fixText)}</span>
      </div>
    </div>
  `).join("") + (editMode ? `<button class="gap-add" id="gapAddBtn">+ 添加断点卡片</button>` : "");
}

/* ==================================================================
   RENDER: charts
   ================================================================== */
function renderCharts() {
  if (typeof Chart === "undefined") return;
  const all = allTools();
  const counts = STATUS_LIST.map((s) => all.filter((t) => t.s === s).length);

  const donutEl = document.getElementById("donutChart");
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(donutEl, {
    type: "doughnut",
    data: {
      labels: STATUS_LIST,
      datasets: [{ data: counts, backgroundColor: STATUS_LIST.map((s) => STATUS_COLOR[s]), borderWidth: 2, borderColor: "#F7F5EE" }]
    },
    options: {
      plugins: { legend: { position: "bottom", labels: { font: { family: "Noto Sans SC", size: 11.5 }, color: "#4B5568", boxWidth: 11, padding: 12 } } },
      cutout: "62%"
    }
  });

  const stages = state.stages;
  const stackEl = document.getElementById("stackChart");
  if (stackChart) stackChart.destroy();
  stackChart = new Chart(stackEl, {
    type: "bar",
    data: {
      labels: stages.map((s) => s.id),
      datasets: STATUS_LIST.map((st) => ({
        label: st,
        data: stages.map((s) => s.tools.filter((t) => t.s === st).length),
        backgroundColor: STATUS_COLOR[st],
        stack: "x"
      }))
    },
    options: {
      indexAxis: "y",
      responsive: true,
      scales: {
        x: { stacked: true, ticks: { font: { family: "Space Mono", size: 10.5 } }, grid: { color: "#DAD7CB" } },
        y: { stacked: true, ticks: { font: { family: "Space Mono", size: 11.5 }, color: "#2C5B87" }, grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ==================================================================
   RENDER: filters + inventory
   ================================================================== */
function renderFilters() {
  const all = allTools();
  const fEl = document.getElementById("filters");
  const FILTERS = ["全部", ...STATUS_LIST];
  fEl.innerHTML = FILTERS.map((f) => {
    const c = f === "全部" ? all.length : all.filter((x) => x.s === f).length;
    return `<button class="fbtn ${flt === f ? "on" : ""}" data-filter="${esc(f)}">${esc(f)} ${c}</button>`;
  }).join("");

  const jEl = document.getElementById("jumprow");
  jEl.innerHTML = state.stages.map((s) => `<button class="jumpchip" data-jump="${s.id}">${s.id}</button>`).join("");
}

function renderInventory() {
  const iEl = document.getElementById("inventory");
  const q = searchQuery.trim().toLowerCase();
  iEl.innerHTML = state.stages.map((stage) => {
    const { n, done, pct } = stageStats(stage);
    let shown = stage.tools.map((t, idx) => ({ ...t, idx }));
    if (flt !== "全部") shown = shown.filter((t) => t.s === flt);
    if (q) shown = shown.filter((t) => t.n.toLowerCase().includes(q));

    const rows = shown.map((it) => `
      <div class="tool" ${editMode ? 'draggable="true"' : ""} data-stage="${stage.id}" data-idx="${it.idx}">
        ${editMode ? '<span class="drag-handle">⋮⋮</span>' : ""}
        <span class="tdot ${it.s}"></span>
        <span class="tname" ${editMode ? 'contenteditable="true"' : ""} data-role="toolname" data-stage="${stage.id}" data-idx="${it.idx}">${esc(it.n)}</span>
        <span class="tags">
          ${it.shared || editMode ? `<button class="share ${editMode ? "editable" : ""} ${it.shared ? "" : "off"}" data-role="share" data-stage="${stage.id}" data-idx="${it.idx}" ${editMode ? "" : "disabled"}>共享</button>` : ""}
          ${editMode
            ? `<select class="tstat ${it.s}" data-role="status" data-stage="${stage.id}" data-idx="${it.idx}">${STATUS_LIST.map((s) => `<option value="${esc(s)}" ${s === it.s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`
            : `<span class="tstat ${it.s}">${esc(it.s)}</span>`}
        </span>
        ${editMode ? `<button class="tool-del" data-role="tooldel" data-stage="${stage.id}" data-idx="${it.idx}" title="删除">×</button>` : ""}
      </div>
    `).join("");

    const body = shown.length ? rows : (stage.tools.length ? `<div class="empty">该状态 / 搜索下无工具</div>` : `<div class="empty">暂无工具</div>`);
    const addBtn = editMode ? `<button class="tool-add" data-role="tooladd" data-stage="${stage.id}">+ 添加工具</button>` : "";

    return `<div class="stage" id="stage-${stage.id}">
      <div class="stage-h">
        <div class="nm"><span class="sidx">${stage.id}</span><span ${editMode ? 'contenteditable="true"' : ""} data-role="stagename" data-stage="${stage.id}">${esc(stage.name)}</span></div>
        <div class="progress"><div class="pbar"><div style="width:${pct}%"></div></div><span class="pnum">已落地 ${done}/${n}</span></div>
      </div>
      <div class="tools">${body}${addBtn}</div>
    </div>`;
  }).join("");
}

/* ==================================================================
   full / partial render orchestration
   ================================================================== */
function renderAll() {
  renderHero();
  renderFlow();
  renderBoard();
  renderFoundation();
  renderGaps();
  renderCharts();
  renderFilters();
  renderInventory();
  syncEditToggleUI();
}

function commitAndRerender() {
  saveStateNow();
  renderAll();
}

/* ==================================================================
   mutation helpers
   ================================================================== */
function findStage(id) { return state.stages.find((s) => s.id === id); }

function cyclePipeline(stageId, col) {
  const stage = findStage(stageId);
  if (!stage || !stage.pipeline) return;
  const cur = stage.pipeline[col];
  const next = PIPE_ORDER[(PIPE_ORDER.indexOf(cur) + 1) % PIPE_ORDER.length];
  stage.pipeline[col] = next;
  commitAndRerender();
}

function addTool(stageId) {
  const stage = findStage(stageId);
  if (!stage) return;
  stage.tools.push({ n: "新工具", s: "未开始", shared: false });
  commitAndRerender();
  const rows = document.querySelectorAll(`.tname[data-stage="${stageId}"]`);
  const last = rows[rows.length - 1];
  if (last) { last.focus(); document.execCommand && selectAllText(last); }
}

function selectAllText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function deleteTool(stageId, idx) {
  const stage = findStage(stageId);
  if (!stage) return;
  stage.tools.splice(idx, 1);
  commitAndRerender();
}

function toggleShare(stageId, idx) {
  const stage = findStage(stageId);
  if (!stage) return;
  stage.tools[idx].shared = !stage.tools[idx].shared;
  commitAndRerender();
}

function setStatus(stageId, idx, val) {
  const stage = findStage(stageId);
  if (!stage) return;
  stage.tools[idx].s = val;
  commitAndRerender();
}

function reorderTool(fromStageId, fromIdx, toStageId, toIdx) {
  const fromStage = findStage(fromStageId);
  const toStage = findStage(toStageId);
  if (!fromStage || !toStage) return;
  const [item] = fromStage.tools.splice(fromIdx, 1);
  let insertAt = toIdx;
  if (fromStageId === toStageId && fromIdx < toIdx) insertAt -= 1;
  toStage.tools.splice(insertAt, 0, item);
  commitAndRerender();
}

function addGap() {
  state.gaps.push({ tag: "新断点", title: "点击编辑标题", desc: "点击编辑描述内容…", fixLabel: "补齐方向", fixText: "点击编辑补齐方向…" });
  commitAndRerender();
}

function deleteGap(idx) {
  state.gaps.splice(idx, 1);
  commitAndRerender();
}

/* ==================================================================
   event wiring
   ================================================================== */
function syncEditToggleUI() {
  const btn = document.getElementById("editToggle");
  btn.classList.toggle("active", editMode);
  btn.textContent = editMode ? "✎ 编辑模式：开" : "◎ 编辑模式：关";
}

function wireEvents() {
  document.getElementById("editToggle").addEventListener("click", () => {
    editMode = !editMode;
    renderAll();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-ops-workflow-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.stages)) throw new Error("格式不正确");
        state = parsed;
        commitAndRerender();
      } catch (err) {
        alert("导入失败：" + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("确定要恢复为默认数据吗？当前所有编辑内容将丢失（建议先导出备份）。")) {
      state = deepClone(DEFAULT_DATA);
      commitAndRerender();
    }
  });

  // board pipeline clicks + stage-name jump
  document.getElementById("board").addEventListener("click", (e) => {
    const node = e.target.closest(".node.editable");
    if (node) { cyclePipeline(node.dataset.stage, Number(node.dataset.col)); return; }
    const nameBlock = e.target.closest(".track-name");
    if (nameBlock && !editMode) jumpToStage(nameBlock.dataset.stage);
  });

  // flow svg handled per-render (listeners attached in renderFlow)

  // gaps
  document.getElementById("gapsList").addEventListener("click", (e) => {
    const delBtn = e.target.closest(".gap-del");
    if (delBtn) { deleteGap(Number(delBtn.dataset.idx)); return; }
    const addBtn = e.target.closest("#gapAddBtn");
    if (addBtn) addGap();
  });
  document.getElementById("gapsList").addEventListener("blur", (e) => {
    const el = e.target.closest('[data-role="gap"]');
    if (!el) return;
    const idx = Number(el.dataset.idx), field = el.dataset.field;
    if (state.gaps[idx]) { state.gaps[idx][field] = el.textContent.trim(); saveStateDebounced(); }
  }, true);

  // filters + search + jump chips
  document.getElementById("filters").addEventListener("click", (e) => {
    const b = e.target.closest(".fbtn");
    if (!b) return;
    flt = b.dataset.filter;
    renderFilters();
    renderInventory();
  });
  document.getElementById("jumprow").addEventListener("click", (e) => {
    const b = e.target.closest(".jumpchip");
    if (b) jumpToStage(b.dataset.jump);
  });
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderInventory();
  });

  // inventory: delegated click / change / input / drag
  const invEl = document.getElementById("inventory");

  invEl.addEventListener("click", (e) => {
    const del = e.target.closest('[data-role="tooldel"]');
    if (del) { deleteTool(del.dataset.stage, Number(del.dataset.idx)); return; }
    const share = e.target.closest('[data-role="share"]');
    if (share && editMode) { toggleShare(share.dataset.stage, Number(share.dataset.idx)); return; }
    const add = e.target.closest('[data-role="tooladd"]');
    if (add) { addTool(add.dataset.stage); return; }
  });

  invEl.addEventListener("change", (e) => {
    const sel = e.target.closest('[data-role="status"]');
    if (sel) setStatus(sel.dataset.stage, Number(sel.dataset.idx), sel.value);
  });

  invEl.addEventListener("blur", (e) => {
    const nameEl = e.target.closest('[data-role="toolname"]');
    if (nameEl) {
      const stage = findStage(nameEl.dataset.stage);
      const idx = Number(nameEl.dataset.idx);
      if (stage && stage.tools[idx]) {
        stage.tools[idx].n = nameEl.textContent.trim() || "未命名工具";
        saveStateDebounced();
      }
      return;
    }
    const stageNameEl = e.target.closest('[data-role="stagename"]');
    if (stageNameEl) {
      const stage = findStage(stageNameEl.dataset.stage);
      if (stage) {
        stage.name = stageNameEl.textContent.trim() || stage.name;
        saveStateNow();
        renderAll();
      }
    }
  }, true);

  // board's own stage-name contenteditable (separate element instance from inventory's)
  document.getElementById("board").addEventListener("blur", (e) => {
    const stageNameEl = e.target.closest('[data-role="stagename"]');
    if (!stageNameEl) return;
    const stage = findStage(stageNameEl.dataset.stage);
    if (stage) {
      stage.name = stageNameEl.textContent.trim() || stage.name;
      saveStateNow();
      renderAll();
    }
  }, true);

  // drag reorder
  invEl.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".tool");
    if (!row) return;
    dragSrc = { stage: row.dataset.stage, idx: Number(row.dataset.idx) };
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  invEl.addEventListener("dragend", (e) => {
    const row = e.target.closest(".tool");
    if (row) row.classList.remove("dragging");
    invEl.querySelectorAll(".draghover").forEach((el) => el.classList.remove("draghover"));
  });
  invEl.addEventListener("dragover", (e) => {
    const row = e.target.closest(".tool");
    if (!row || !dragSrc) return;
    e.preventDefault();
    invEl.querySelectorAll(".draghover").forEach((el) => el.classList.remove("draghover"));
    row.classList.add("draghover");
  });
  invEl.addEventListener("drop", (e) => {
    const row = e.target.closest(".tool");
    if (!row || !dragSrc) return;
    e.preventDefault();
    const toStage = row.dataset.stage, toIdx = Number(row.dataset.idx);
    reorderTool(dragSrc.stage, dragSrc.idx, toStage, toIdx);
    dragSrc = null;
  });
}

/* ==================================================================
   boot
   ================================================================== */
wireEvents();
renderAll();
