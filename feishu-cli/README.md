# feishu-cli — 采用素材推送到飞书群

把图测工具里**采用(adopted)**的变体素材，定时汇总推送到指定飞书群。
纯 Node（≥18），零依赖；密钥放本机 `.env`，不进仓库。

## 一次性准备

1. **飞书后台**（https://open.feishu.cn → 你的自建应用）
   - 「权限管理」开通：`im:message`、`im:message:send_as_bot`、`im:resource`、`im:chat:readonly`
   - 「应用功能 → 机器人」启用机器人
   - 发布版本并通过审核（企业内自建一般自动通过）
2. **把机器人拉进目标群**（群设置 → 群机器人 → 添加）。不拉进群发不进去。
3. **配置**
   ```bash
   cd feishu-cli
   cp .env.example .env
   # 编辑 .env：填 APP_ID / APP_SECRET / DATA_DIR
   ```
4. **拿群 chat_id**
   ```bash
   npm run list-chats        # 或 node src/index.js --list-chats
   ```
   把目标群的 `chat_id` 填回 `.env` 的 `FEISHU_CHAT_ID`。

## 日常用法

```bash
node src/index.js --dry-run   # 预演：看会发哪些，不真发
node src/index.js --once      # 发「自上次以来新采用」的素材（默认）
node src/index.js --all       # 全量补发（忽略历史，慎用，会刷屏）
```

「新采用」靠本机 `.feishu-cli-state.json` 里记的已发 key 去重；删掉该文件 = 下次重新全发。

## 定时跑

目标：**每天 18:00 发一次**。

**Windows（任务计划程序）**：操作填 `node`，参数 `D:\路径\feishu-cli\src\index.js --once`，
「起始于」填 `feishu-cli` 目录。触发器：每天，18:00。

**Mac/Linux（cron）**：`crontab -e` 加一行（每天 18:00）：
```cron
0 18 * * * cd /路径/feishu-cli && /usr/bin/node src/index.js --once >> push.log 2>&1
```

> 跑定时的机器必须能访问 `DATA_DIR`（群晖盘）且能联网到飞书。

## 以后换群 / 加群

**不用改代码**，只动 `.env`：

1. 把机器人拉进新群（群设置 → 群机器人 → 添加）。
2. `npm run list-chats` 拿新群的 `chat_id`。
3. 改 `.env` 的 `FEISHU_CHAT_ID`：
   - 换群：替换成新的 `chat_id`。
   - 加群（同时发多个群）：英文逗号隔开，如 `oc_aaa,oc_bbb`。

机器人的权限、应用本身都不用动。
