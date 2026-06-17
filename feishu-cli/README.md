# feishu-cli — 采用素材推送到飞书群

把图测工具里**采用(adopted)**的变体素材，每天定时推送到飞书群。
一条采用记录会拆成**两张卡**发给两个群（同步买量 / 测试复盘总结，见下）。
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
   把目标群的 `chat_id` 填回 `.env`：
   - `FEISHU_CHAT_ID_BUYING` — **同步买量**群（发「同步买量」文案 + 素材）
   - `FEISHU_CHAT_ID_REVIEW` — **测试复盘总结**群（发「本轮复盘总结」文案 + 素材）
   - 现在只有一个群？两个填同一个 `chat_id`，该群会收到两条消息。
   - 各自都支持逗号隔开多群；没配这俩会降级用旧的 `FEISHU_CHAT_ID`。

## 推送内容（两张卡，分发两个群）

每条**采用的变体**会生成两张交互卡片，分别发给对应的群：

| | 同步买量卡（青色头） | 测试复盘总结卡（蓝色头） |
|---|---|---|
| 发往 | `FEISHU_CHAT_ID_BUYING` | `FEISHU_CHAT_ID_REVIEW` |
| 标题 | 项目名 | 项目名 |
| 正文 | 「同步买量」文案（记录里的 `buyingNote`） | 「本轮复盘总结」文案（`summary`） |
| 素材 | 采用变体的图 / 视频 | 同左 |
| 灰底框 | `新应用了{属性}，测试人：{姓名} · {效果}` | 同左 |

> 文案来自图测工具「详情页」里的「同步买量」「本轮复盘总结」两个输入框。
> 两个群可以填同一个 `chat_id`（现阶段只有一个群时），该群会收到两条卡。

## 日常用法

```bash
node src/index.js --dry-run   # 预演：看会发哪些，不真发
node src/index.js --once      # 发「自上次以来新增的采用素材」（默认）
node src/index.js --seed      # 把当下所有 adopted 标为已发，从下次起只推新增
node src/index.js --all       # 全量补发（忽略历史，极慎用，会刷屏）
```

## 推送时机与去重逻辑

工具不是「按时间窗口」筛，而是**按「这条发没发过」**筛。状态存在本机
`.feishu-cli-state.json`（gitignore），记着每条 `素材×模块` 是否已发。

- **首次跑 `--once`**：把当前已有的 adopted 素材**全部标为「已发」但不发任何消息**
  （自动 seed），避免一上线就把历史全刷一遍。
- **之后每天 18:00 跑 `--once`**：发「所有还没发过的采用变体」。日常运行下即：
  - 18:00 **前**采用的 → **当天** 18:00 推；
  - 18:00 **后**采用的 → 今天那趟已跑完，**第二天** 18:00 推。
- **漏跑会补、不会丢**：某天机器关机/断网没跑成，下次跑会把这期间所有没发过的
  **一次性补发**（因为判断依据是「发没发过」，不是「是不是今天采用的」）。
- **两张卡各自独立记账**（`key#buying` / `key#review`）：某张发失败不影响另一张，
  失败的那张下次单独补发。
- 删掉 `.feishu-cli-state.json` = 重新走「首次」流程（清空已发记录）。

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
3. 改 `.env` 的 `FEISHU_CHAT_ID_BUYING` / `FEISHU_CHAT_ID_REVIEW`：
   - 换群：替换成新的 `chat_id`。
   - 加群（同时发多个群）：英文逗号隔开，如 `oc_aaa,oc_bbb`。
   - 买量群和复盘群分开后，把两个变量填成不同的 `chat_id` 即可分流。

机器人的权限、应用本身都不用动。
