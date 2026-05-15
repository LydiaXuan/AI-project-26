# 工作约定（必读）

## 1. 会话开始：先读 `CHAT-LOG.md`

新会话第一件事 **只读** `CHAT-LOG.md`，不要通读 `public/index.html`、`viso test1.md`、`public/js/*.js`、`public/css/*.css` 等源码。
`CHAT-LOG.md` 里记的是「当前进度 / 未完成项 / 下一步」，足够续接上次的工作。
只有当 `CHAT-LOG.md` 里说不清某个细节、或你确实需要改具体文件时，再针对性 `Read` 那个文件的相关行段。

## 2. 项目速览（必要时再展开看 `viso test1.md`）

- 单文件 SPA：`public/index.html`（Tailwind CDN + Tesseract + 全部 JS/CSS inline）
- 数据通过 File System Access 写群晖 `data/` 文件夹的 JSON：`records.json` / `meta.json` / `recycle.json`
- 三视图：表单（编辑测试记录）/ 时间线 / 仪表盘 + 设置（含回收站、个人信息、下拉项管理）
- 源码拆分点：`public/js/{app,effects,db}.js` 是开发参考，**不是运行时**
- 提交分支：默认 `claude/test-record-tool-Mg8J7`，每次同步推一份到 `VisoTest1`

## 3. 会话结束：更新 `CHAT-LOG.md`

在 stop 前，**追加** 一段到 `CHAT-LOG.md`：
- 日期 / 提交 hash
- 这次改了什么（1~3 行）
- 用户当前关注 / 待办 / 下次该做什么

不需要长篇大论，每节 3~6 行就够了。Stop 钩子会检查文件是否在最近 30 分钟内被改过，没更新会提醒。

## 4. Git 规范

- 推送：`git push origin claude/test-record-tool-Mg8J7 && git push origin claude/test-record-tool-Mg8J7:VisoTest1`（两个分支都要同步）
- 不创建 PR，除非用户要求
- 提交信息用 HEREDOC，结尾带 `https://claude.ai/code/session_...`
