# Google Play 竞品商店素材扒取工具

贴 Google Play 链接或包名，自动下载竞品商店页的**全部图片素材**，按应用归档到本地文件夹。

抓取的素材：

| 素材 | 说明 |
|---|---|
| 手机/平板截图 | 商店列表里的所有 screenshots |
| 特色大图 / 推广图 | feature graphic（商店顶部横幅推广图） |
| 应用图标 | app icon |
| 视频缩略图 | 宣传视频的封面图 |

所有图片都会自动改写成**最高可得分辨率**（`=s0` 原图），并附 `metadata.json` 记录原始 URL、地区、抓取时间等。

---

## 环境要求

- Node.js ≥ 18（推荐 20/22，需自带 `fetch`）
- **能访问 `play.google.com` 的网络**（国内需自备代理 / VPN，否则拉不到数据）

## 安装

```bash
cd competitor-scraper
npm install
```

## 用法

```bash
# 单个：包名
node scrape.js com.spotify.music

# 单个：直接贴浏览器链接
node scrape.js "https://play.google.com/store/apps/details?id=com.spotify.music"

# 多个：空格分隔
node scrape.js com.spotify.music com.zhiliaoapp.musically

# 指定地区/语言（看哪个市场的素材就用哪个地区）
node scrape.js -c tw -l zh-TW com.spotify.music

# 从文件批量读取（每行一个，# 注释）
node scrape.js --file apps.example.txt --out ./竞品图
```

### 选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `-c, --country <码>` | `us` | 商店地区，如 `tw` `hk` `jp` `kr` `cn` |
| `-l, --lang <码>` | `en` | 语言，如 `zh-TW` `zh-CN` `ja` |
| `-o, --out <目录>` | `./output` | 输出目录 |
| `-f, --file <文件>` | — | 从文本文件批量读取链接/包名 |
| `-p, --proxy <地址>` | — | 走代理抓取，如 `http://127.0.0.1:7890` |
| `--concurrency <n>` | `5` | 单个应用内图片并发下载数 |
| `--no-screenshots` | | 不抓截图 |
| `--no-feature` | | 不抓特色大图/推广图 |
| `--no-icon` | | 不抓图标 |
| `--no-video` | | 不抓视频缩略图 |

### 走代理（命令行连不上谷歌时）

浏览器能上谷歌，不代表命令行也能——很多代理只接管浏览器。若出现
`ETIMEDOUT` / `连接超时`，就用代理跑：

```bash
# 把端口换成你代理软件的本地 HTTP 端口（Clash 常见 7890，V2rayN 常见 10809）
node scrape.js -p http://127.0.0.1:7890 wool.match.color.sort.jam.puzzle
```

也可以设环境变量，之后所有命令自动走代理（PowerShell 当前窗口有效）：

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
node scrape.js wool.match.color.sort.jam.puzzle
```

> 代理同时作用于「拉取商店信息」和「下载图片」两步。

## 输出结构

```
output/
  Spotify- Music and Podcasts__com.spotify.music/
    icon.png
    feature.jpg              ← 特色大图 / 推广图
    video-thumb.jpg          ← 视频缩略图（若有）
    screenshots/
      01.jpg
      02.jpg
      ...
    metadata.json            ← 标题、开发者、原始 URL、抓取时间、失败清单
```

## 工作原理 & 注意事项

- 数据来自 `google-play-scraper`，解析的是 Google Play 商店页公开返回的数据，不做登录或绕过。
- 图片 URL 末尾的尺寸参数（如 `=w526-h296`）被统一改写为 `=s0` 取原图。
- 应用之间**串行**请求、单应用内图片并发，并带 2/4/8s 退避重试，尽量降低被限流概率；批量很大时建议适当放慢或分批。
- 仅供竞品调研 / 设计参考。下载的素材版权归原应用所有，请勿直接商用或二次发布。
