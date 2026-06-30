# 项目记忆 / 偏好

> 给 Claude 的长期记忆。每次打开此项目会自动读取。

## 用户环境

- **操作系统**：Windows（PowerShell）
- **Node.js**：已安装 ✅ —— 不要再让用户安装 Node，直接进入 `npm install` / `node scrape.js` 等步骤。
- **代理**：用 **Karing**。命令行**必须显式走代理**（系统代理对 Node 无效）。本地代理端口 **3067**（HTTP）。
  - 已验证可用命令：`node scrape.js -p http://127.0.0.1:3067 <包名或链接>`
  - 查端口的办法：`(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings').ProxyServer`（端口可能变，以实际为准）。

## 踩过的坑（别重复）

- 用户不熟命令行，路径含空格要加引号；`cd` 进子目录易出错，优先「地址栏输 powershell」开窗。
- **下载 ZIP 会被浏览器缓存成旧版**。要更新本地代码，直接用 iwr 覆盖文件，别让用户反复下 ZIP：
  ```powershell
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  $b="https://raw.githubusercontent.com/LydiaXuan/AI-project-26/refs/heads/claude/google-play-competitor-scraper-jb0shh/competitor-scraper"
  iwr "$b/scrape.js" -OutFile scrape.js; iwr "$b/package.json" -OutFile package.json
  iwr "$b/lib/proxy.js" -OutFile lib/proxy.js; iwr "$b/lib/download.js" -OutFile lib/download.js
  ```
- 工具目录在本地：`D:\AI project 26\AI-project-26-claude-google-play-competitor-scraper-jb0shh\competitor-scraper`。

## 沟通偏好

- 用中文，步骤要具体、面向非命令行用户（点哪里、敲什么）。

## 项目内工具

- `competitor-scraper/` —— Google Play 竞品商店素材扒取命令行工具（截图/推广图/图标/视频缩略图）。用法见该目录 README.md。
- `public/` —— 图测记录工具（纯前端单文件 HTML，无后端）。
