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

**Windows（任务计划程序）**：操作填 `node`，参数 `D:\路径\feishu-cli\src\index.js --once`，
「起始于」填 `feishu-cli` 目录。触发器按需（如每周一 10:00）。

**Mac/Linux（cron）**：`crontab -e` 加一行（每周一 10:00）：
```cron
0 10 * * 1 cd /路径/feishu-cli && /usr/bin/node src/index.js --once >> push.log 2>&1
```

> 跑定时的机器必须能访问 `DATA_DIR`（群晖盘）且能联网到飞书。
