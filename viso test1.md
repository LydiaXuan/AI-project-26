# 图测记录工具 — 设计与开发备忘录

> 自动维护文件，每次大改后同步更新。最后更新：2026-05-14

---

## 一、项目概述

**用途**：Google Play Console A/B 测试记录管理工具（多人共享，存储于群晖网络盘）

**访问方式**：Chrome / Edge 打开 `index.html`，首次需选择群晖网络盘上的 `data` 文件夹（如 `Z:\图测记录工具\data`）。File System Access API 要求映射盘符，不支持 UNC 路径。

**部署**：所有代码打包进 `public/index.html` 单文件（~189KB），无服务器。

---

## 二、文件结构

```
public/
  index.html      ← 构建产物，CSS + JS 全部 inline
  css/styles.css  ← 源样式
  js/
    app.js        ← 主逻辑（~2100 行）
    effects.js    ← 效果计算 / badge HTML
    db.js         ← IndexedDB + 文件夹读写
CHAT-LOG.md       ← 会话历史（.gitignore，不入库）
viso test1.md     ← 本文件
```

### 构建命令（在 /tmp/ 下有脚本）

```bash
# strip_imports.py: 去掉 import/export 行
# rebuild_html.py:  把 CSS + bundle.js inline 进 index.html
python3 /tmp/strip_imports.py  # 生成 /tmp/bundle.js
python3 /tmp/rebuild_html.py   # 更新 public/index.html
```

---

## 三、设计系统

### 颜色

| 用途 | 值 |
|---|---|
| 主色（Indigo） | `#4F46E5` / `#6366F1` |
| 主色悬停 | `#4338CA` |
| 主色浅背景 | `#EEF2FF` |
| 文字主色 | `#1E293B` |
| 文字次要 | `#64748B` |
| 边框 | `#E2E8F0` |
| 分割线 | `#F1F5F9` |
| 卡片背景 | `#fff` |
| 页面背景 | `#F0F2F7` |
| 变体色彩条 | 灰 `#9CA3AF` / 绿 `#10B981` / 紫 `#6366F1` / 玫 `#F43F5E` |

### 字体

```css
font-family: 'SF Pro Display','SF Pro Text',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
```

### 核心圆角

- 卡片：`border-radius: 12px`
- 按钮/输入：`8px`
- 徽章：`6px`

---

## 四、布局系统

### 侧边栏（可收起）

```
宽度：248px，固定定位，白色背景
收起：translateX(-248px)，过渡 .26s cubic-bezier(.4,0,.2,1)
展开按钮：position:fixed; top:14px; left:14px，收起时淡入
```

- 收起状态类：`.sidebar--collapsed`（同时加在 `<aside>` 和 `<main>`）
- 主内容区收起时：`margin-left:0; padding-left:68px; width:100vw`
- 图表自适应：`setTimeout(() => window.dispatchEvent(new Event('resize')), 290)`

### 侧边栏导航项

- 时间线（📋）、仪表盘（📊）——无管理界面入口
- 管理界面仍可通过个人信息页的「打开管理面板」访问

---

## 五、表单页（新增/编辑记录）

### 结构层次

```
.fp-wrap
  .fp-header-bar        ← 标题 + RecordID badge + 类型切换
  .fp-card              ← 基础实验属性（2列网格）
  .fp-card.fp-card-compact ← 测试属性（pills）
  section               ← 变体方案（4卡片横排）
  .fp-action-bar        ← 粘性底部操作栏
```

### fp-header-bar

```html
<header class="fp-header-bar">
  左：标题 + <span class="fp-header-id">ID: 2026-01</span>
  右：<div class="fp-type-toggle"> A/B测试 | 直接更新 </div>
</header>
```

### 基础实验属性 card

- 2列网格 `.fp-grid-2`，每列多个 `.fp-row`
- 每行：`justify-between` → 左侧标签 `.fp-row-label` + 右侧控件
- 控件类型：
  - 下拉：`.fp-inv-select`（invisible select，右对齐，hover 变 indigo）
  - 输入：`.fp-inv-input`（invisible input）
  - 日期：`.fp-inv-input.fp-inv-date`
  - 置信度：`.fp-seg-group` 里的 `.fp-seg-btn`（hidden radio + adjacent div）

### 分段按钮（置信度 90 / 95 / 98 / 99%）

```html
<label class="fp-seg-btn">
  <input type="radio" name="conf" value="95" checked/>
  <div>95%</div>
</label>
```

选中时：`background:#EEF2FF; color:#4F46E5; border-color:#C7D2FE`

### 备注区（3行 textarea）

```css
.fp-notes-input {
  background: #F8FAFC; border:none; border-radius:8px; padding:10px 16px;
}
/* 聚焦 */ background:#fff; box-shadow:0 0 0 1px rgba(99,102,241,.5);
```

字段：改动内容、测试目的、设计思路

### 测试属性 pills

```css
.fp-pill input:checked + span { background:#EEF2FF; color:#4338CA; border-color:#C7D2FE; }
```

选项：`BI_TYPES = ['icon','五图','置顶','视频']`

### 变体方案卡片

- 4 个 `.fp-vcard` 横排（`grid-template-columns: repeat(4,1fr)`）
- 顶部 4px 色彩条区分（灰/绿/紫/玫）
- 图片区：`aspect-ratio: 9/16`，虚线边框
- 数据区（slate-50 半透明背景）：首次安装、置信区间（[下限] ~ [上限]）、保留安装、效果判断
- 底部：「标记为采用」按钮，点击后变绿（`.fp-applied-yes`）

**变体定义**：
```js
const VDEFS = [
  {key:'control', label:'原始',  badge:'CONTROL',   cls:'ctrl'},
  {key:'test1',   label:'方案A', badge:'VARIANT 1', cls:'t1'},
  {key:'test2',   label:'方案B', badge:'VARIANT 2', cls:'t2'},
  {key:'test3',   label:'方案C', badge:'VARIANT 3', cls:'t3'},
];
```

### 粘性操作栏

```css
position:sticky; bottom:0; margin:0 -32px; padding:12px 32px;
background:rgba(255,255,255,.88);
backdrop-filter:saturate(1.4) blur(12px);
border-top:1px solid #E2E8F0;
```

按钮：「放弃修改」（次要）+ 「保存并同步配置」（主要 indigo）

---

## 六、Record ID

格式：`YYYY-NN`（年份 + 零补齐序号，如 `2026-01`）

生成：创建时自动计算当年已有记录数 + 1

---

## 七、流量分配预设（19 个，写死在代码里）

```js
const RATIO_PRESETS = [
  '25/25/25/25','50/50','60/40','70/30','75/25','90/10','95/5',
  '34/33/33','40/30/30','50/25/25','60/20/20','80/10/10','70/15/15',
  '55/15/15/15','40/20/20/20','85/5/5/5','90/5/5','70/10/10/10','20/20/20/20/20'
];
```

---

## 八、数据存储

- **格式**：IndexedDB 缓存 + 群晖网络盘 JSON 文件
- **多人协作**：Re-read-merge 写入策略（先读最新，再合并，再写）
- **图片**：base64 压缩存储（max 480px, quality 0.72）
- **回收站**：删除记录保留 30 天
- **每日备份**：每天首次保存自动创建快照，保留 30 天
- **待同步队列**：离线时写入 pending，下次联网自动重试

---

## 九、OCR 功能

- 上传 Google Play Console 截图 → Tesseract.js 识别
- 解析规则：扫描文本行，匹配首次安装数、保留安装数、置信区间（±数值%）
- 解析后展示预览表格，可手动调整，确认后填入表单

---

## 十、效果类型

```js
// effects.js
const EFFECT_OPTIONS = [
  {val:'superb',      label:'🏆 很好'},
  {val:'good',        label:'👍 不错'},
  {val:'neutral_p',   label:'➖ 持平(+)'},
  {val:'neutral_n',   label:'➖ 持平(-)'},
  {val:'empirical_p', label:'📈 经验决策(+)'},
  {val:'empirical_n', label:'📈 经验决策(-)'},
  {val:'bad',         label:'❌ 很差'},
];
```

---

## 十一、响应式断点

| 断点 | 变化 |
|---|---|
| ≤960px | 基础属性改 1 列，变体卡片 2 列 |
| ≤768px | 时间线上下分栏 |
| ≤600px | 变体卡片 1 列 |
| ≤480px | padding-left:60px（留浮动按钮位置） |

---

## 十二、已知架构约束

- 不能用 ES 模块（`file://` 协议阻止，需 build 打包）
- 不能用 CDN 外的第三方库（只允许 Chart.js + Tesseract.js）
- 所有全局函数需手动 `window.xxx = xxx` 暴露给 HTML inline 事件

---

## 十三、全局暴露函数（HTML onclick 使用）

`toggleSidebar`, `navigate`, `toggleApplied`, `removeImg`, `openLightbox`, `editTest`, `deleteTestRecord`, `saveConclusion`, `toggleCard`, `showHistory`, `rollbackHistory`, `closeHistory`, `applyTimelineFilters`, `resetTimelineFilters`, `selectTimelineTest`, `handleFormSubmit`, `openOCRModal`, `closeOCRModal`, `applyOCRData`, `openCropModal`, `closeCropModal`, `applyCrop`, `cropAutoSplit`, `switchCropDirection`, `_pickFolder`, `_resumeFolder`, `_refreshFromDisk`, `_syncPending`
