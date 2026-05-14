# 图测记录工具 — 设计与功能备忘录

> 自动维护，每次大改后更新。最后更新：2026-05-14

---

## 一、项目概述

**用途**：Google Play Console A/B 测试 / 直接更新 记录管理，多人共享，数据存储在群晖网络盘。

**访问方式**：Chrome / Edge 打开 `public/index.html`，首次需选择群晖上的 `data` 文件夹（如 `Z:\图测记录工具\data`）。需要映射盘符，不支持 UNC 路径。

**部署**：所有运行时代码 inline 在 `public/index.html` 单文件，无服务器、无后端、无构建步骤。直接双击打开即可。

---

## 二、文件结构

```
public/
  index.html      ← 构建产物（Tailwind CDN + Tesseract CDN，含全部 HTML/CSS/JS，~1340 行）
  css/styles.css  ← 样式源文件（占位，UI 已迁移至 Tailwind 工具类）
  js/
    app.js        ← 主逻辑（模块化拆分点，导出 db/effects 共享 API）
    effects.js    ← 效果计算 + EFFECT_META + effectBadgeHTML
    db.js         ← IndexedDB + File System Access + 待同步队列 + 回收站
CHAT-LOG.md       ← 会话历史（.gitignore，不入库）
viso test1.md     ← 本文件
```

---

## 三、UI 设计参考

三视图严格对齐用户提供的 3 份 HTML 设计稿（Tailwind + Inter + slate/indigo 体系）：

| 视图 | 入口 | 关键结构 |
|---|---|---|
| 编辑测试记录 | 侧栏「图测记录工具」/「新增记录」 | 240px 侧栏 + 顶部 ID badge + A/B / 直接更新切换；模块 1「基础实验属性」2 列；模块 2「视觉资产对比录入」4 列变体卡（CONTROL + A/B/C）；底部吸底操作栏 |
| 历史时间线 | 侧栏「历史时间线」 | 左侧时间线信息流（圆点 + 竖线），点击挤压到 38% 露出右侧深度面板；卡片含 3 列变体行（缩略图 + 数值 + CI 下限~上限），胜出有竖条 + 🏆 |
| 数据仪表盘 | 侧栏「数据仪表盘」 | 顶栏全局筛选；4 KPI 卡（总测试 / 采纳 / 应用率 / 最优贡献者）；2 排行（项目 / 成员，前 3 + 展开）；明细表（按项目/按人员切换 + 导出 CSV） |

---

## 四、五大功能模块

1. **新增 / 编辑记录** — 项目 / 负责人 / 比例 / 组件 下拉 + 「+」按钮调出 `prompt`，**支持英文逗号批量添加**；19 个流量分配预设；置信度分段按钮（90/95/98/99）；备注三行（改动 / 目的 / 设计思路）；变体数由比例自动决定（1~4）。
2. **OCR 自动提取** — Tesseract.js 本地识别。预处理放大 2.4x + 灰度 + 对比拉伸。安装数行 ±2 行扫描置信区间 / 变体字母；无字母时按上下顺序映射到对照/A/B/C。表格预览可编辑后填入表单。
3. **批量裁剪图标** — 上传 / 粘贴大图，2~4 段竖向分割线可拖拽。裁剪时按亮度阈值（>245）裁掉上下白边，再压缩入对应变体。
4. **回收站** — 删除进入回收站，30 天自动清理；管理面板可还原 / 永久删除。
5. **多人同步** — File System Access API 读写群晖 JSON；离线写入 IndexedDB 待同步队列，左下角 ⚠ pill 显示，30 秒自动重试 + 手动重试。

---

## 五、数据格式（records.json）

```jsonc
{
  "id": "2026-01",              // YYYY-NN 按年递增
  "type": "ab",                  // ab | direct
  "project": "Rebel Queen",
  "owner": "ZX",
  "ratio": "25% / 25% / 25% / 25%",
  "component": "应用图标 (Icon)",
  "startDate": "2026-04-18", "endDate": "",
  "confidence": 95,
  "noteChange": "…", "notePurpose": "…", "noteDesign": "…", "summary": "复盘…",
  "variants": [
    { "name": "原始版本", "tag": "CONTROL",   "role": "control", "installs": 115023, "retained": 70816, "ciLow": "",     "ciHigh": "",     "img": "data:image/jpeg;base64,…", "adopted": false },
    { "name": "方案 A",   "tag": "VARIANT 1", "role": "variant", "installs": 132660, "retained": 81281, "ciLow": "11.5", "ciHigh": "18.4", "img": "…", "adopted": true }
  ],
  "createdAt": 1731600000000, "updatedAt": 1731610000000
}
```

`meta.json` 存 projects / owners / ratios / components / lastId 全局列表，便于多人协作累积。

---

## 六、效果判定规则（effects.js / computeEffect）

| 效果 | 条件 |
|---|---|
| 🏆 superb（很好） | CI 下限 > 0 |
| 👍 good（不错） | CI 跨 0 且 (inst - cInst)/cInst > 5% |
| ➖ neutral_p（持平+） | CI 跨 0 且安装数略高 |
| ➖ neutral_n（持平-） | CI 跨 0 且安装数持平或略低 |
| 📈 exp_p（经验+） | 无 CI、安装数高于对照 |
| 📈 exp_n（经验-） | 无 CI、安装数低于对照 |
| ❌ bad（很差） | CI 上限 < 0 |

---

## 七、上传 / 压缩参数

| 参数 | 值 |
|---|---|
| 上传方式 | 点击 / 拖拽 / Ctrl+V 粘贴（OCR、批量裁剪、变体图三处均支持） |
| 变体图压缩 | max 480px，quality 0.72，JPEG，base64 |
| 头像压缩 | max 256px，quality 0.8 |
| OCR 预处理 | 2.4x 放大 + 灰度 + 阈值 110 上下拉开对比 |
| 灯箱 | 点击变体图打开全屏，再点关闭 |
| 移除 | 图片右上角 ✕ |

---

## 八、流量分配预设（19 条 + 自定义）

```
25% / 25% / 25% / 25%, 50% / 50%, 60% / 40%, 70% / 30%,
70% / 10% / 10% / 10%, 95% / 5%, 90% / 5% / 5%, 70% / 15% / 15%,
85% / 5% / 5% / 5%, 40% / 30% / 30%, 80% / 10% / 10%, 34% / 33% / 33%,
50% / 25% / 25%, 75% / 25%, 55% / 15% / 15% / 15%, 40% / 20% / 20% / 20%,
60% / 20% / 20%, 90% / 10%
```

可在「设置 → 下拉选项管理 → 流量分配比例」批量新增。
