# 在群晖 NAS 上跑 feishu-cli（每天 18:00 自动发）

群晖 24h 开机、数据就在本地，是跑这个最稳的地方。全程在 DSM 网页后台点，基本不用命令行。

---

## 第 0 步 · 先记下你的 data 真实路径

File Station → 进到 `data` 文件夹 → 右键 → 属性，记下「位置」，形如：
`/volume1/图测记录工具/data`
下文凡是 `<DATA_DIR>` 都替换成它。

---

## 第 1 步 · 装 Node.js

控制面板 → 套件中心 → 搜索 **Node.js** → 安装 **Node.js v20**（或更高）。

> 装完不用管路径，`run.sh` 会自己找到 node。

---

## 第 2 步 · 把 feishu-cli 放到群晖

把仓库 `VisoTest1-image` 分支里的 `feishu-cli` 整个文件夹，传到群晖任意共享文件夹，例如：
`/volume1/图测记录工具/feishu-cli`
（用 File Station 直接拖上传即可；下文这个路径记作 `<CLI_DIR>`。）

---

## 第 3 步 · 飞书后台准备

1. https://open.feishu.cn → 你的应用 → 权限管理，开通：
   `im:message`、`im:message:send_as_bot`、`im:resource`、`im:chat:readonly`
2. 应用功能 → 机器人 → 启用
3. 创建并发布版本（企业自建一般自动通过）
4. **把机器人拉进要发的群**（群设置 → 群机器人 → 添加）

---

## 第 4 步 · 填配置 .env

把 `<CLI_DIR>/.env.example` 复制一份改名为 `.env`，用文本编辑器填：

```
FEISHU_APP_ID=cli_aaa1d3d916b99bec
FEISHU_APP_SECRET=你的Secret
FEISHU_CHAT_ID=先留空，下一步拿
DATA_DIR=<DATA_DIR>
```

---

## 第 5 步 · 拿群 chat_id（需开一次 SSH，或用「任务计划」跑一次）

**方式 A（推荐，不用 SSH）**：控制面板 → 任务计划 → 新增 → 计划的任务 → 用户定义的脚本，
运行命令填 `bash <CLI_DIR>/run-list-chats.sh`，手动「运行」一次，
然后看 `<CLI_DIR>/push.log` 里打印的群名和 `chat_id`，填回 `.env` 的 `FEISHU_CHAT_ID`。

**方式 B（开了 SSH）**：`ssh` 进群晖 → `cd <CLI_DIR>` → `node src/index.js --list-chats`。

> 多个群：`FEISHU_CHAT_ID=oc_aaa,oc_bbb` 逗号隔开。

---

## 第 6 步 · 设每天 18:00 自动跑

控制面板 → 任务计划 → 新增 → **计划的任务 → 用户定义的脚本**：

- 常规：任务名随意，用户选 `root`
- 计划：每天，时间 **18:00**
- 任务设置 → 运行命令：
  ```
  bash <CLI_DIR>/run.sh
  ```

保存。先手动「运行」一次测试：

- **第一次**会把现有已采用的素材全部标为「已发」但**不发消息**（避免历史刷屏）。
- 之后每天 18:00 只发**当天新采用**的素材到群。
- 运行日志都在 `<CLI_DIR>/push.log`，有问题看它。

---

## 排错速查

| 现象 | 看这里 |
|---|---|
| push.log 写「找不到 node」 | 第 1 步 Node.js 没装好 |
| push.log 写「缺少必填配置」 | `.env` 没填全（APP_ID/SECRET/CHAT_ID/DATA_DIR） |
| 「发消息失败 code=...」 | 多半是权限没开全、或机器人没拉进群 |
| 群里没收到但日志成功 | 确认 chat_id 是目标群、机器人还在群里 |
