# Apptweak 应用图 + 历史图测 爬虫

抓取指定 App 的**当前应用图**(icon + 截图)和**历史元数据变更**(icon/截图 的历史版本,即 Apptweak `timeline_tab` 的内容),存到本地并生成 `manifest.json`。

两条路线,按你有没有 **API 席位**选:

| 路线 | 脚本 | 适用 | 依赖 |
|---|---|---|---|
| **A. 官方 API** | `apptweak_scraper.py` | 你有 API key/席位 | 纯标准库,零依赖 |
| **B. 浏览器会话** ⭐ | `apptweak_browser_scraper.py` | **没有 API 席位**,但能登录网页 | 需装 Playwright |

> 你的情况是**没有 API 席位** → 用 **路线 B**(下方「路线 B」章节)。路线 A 留作以后拿到 key 时用。

---

# 路线 B:浏览器会话版(无需 API 席位)⭐

用 Playwright 驱动一个真实浏览器,**复用你手动登录的会话**,打开目标页面,把页面加载时请求到的 JSON 数据和图片全部抓下来。相当于「你自己的浏览器在帮你另存图片」。

## B-1. 准备(在你自己电脑上,只做一次)

```bash
pip install playwright
playwright install chromium
```

## B-2. 登录(存会话,只需做一次;过期后重做)

```bash
cd scraper
python3 apptweak_browser_scraper.py login
```

浏览器窗口会弹出 → 你在里面正常登录 Apptweak → 登录到能看见数据后,**回到终端按 Enter**。会话存进 `state.json`。

## B-3. 抓取(可反复跑)

```bash
python3 apptweak_browser_scraper.py scrape \
  --url "https://app.apptweak.com/aso-intelligence/applications/android/com.oakever.jigsawcard/metadata?scope=country&country=us&language=us&device=android&view=timeline_tab&workspace=189777" \
  --out ./apptweak_out
```

- 想抓多个页面/多个 App:重复 `--url "..."` 传多次。
- 历史很多、图没加载全:调大 `--scroll-rounds 40`。
- 不想看到浏览器窗口:加 `--headless`(首次建议**别加**,好观察有没有真登录上)。

## B-4. 输出

```
apptweak_out/
├── images/                所有抓到的图(icon_/screenshot_ 前缀 + 编号)
├── raw/responses.json     页面请求到的所有 JSON(含历史时间线原始数据,可据此提取每张图的日期)
└── manifest.json          清单:每张图的 url / 类型 / 来源 / 本地路径
```

> **历史图的日期**藏在 `raw/responses.json` 里。抓完把这个文件发我,我可以再写一小段把「日期 ↔ 图片」对应关系整理成你「图测记录工具」能导入的格式。

## B-5. 排错

- **一张都没下下来** → 多半是会话没登上或已过期:重跑 `login`,确认浏览器里真能看到数据再按 Enter。
- **图不全** → 加大 `--scroll-rounds`(时间线是懒加载,滚到底才继续加载)。
- **合规**:这是用你自己的付费账户看你有权访问的数据,只自动化了「另存」。请遵守 Apptweak 服务条款,别高频批量拉别的 App。

---

# 路线 A:官方 API 版(需要 API key)

走 **Apptweak 官方 REST API**,合规、稳定、数据结构干净。**没有 API 席位就跳过本节。**

---

## 为什么要在你本地电脑跑,而不是云端

- Apptweak 前端是单页应用(SPA),HTML 里没有数据,真正的数据走后台 API;
- Claude 的云执行环境出口 IP 被网络策略限制,连不到 `api.apptweak.com`;
- 用官方 API 需要**你的账户 key** + 正常网络 —— 在你自己电脑上跑最合适。

脚本**只依赖 Python 标准库**,不用 `pip install` 任何东西。

---

## 1. 拿到你的 API key

1. 登录 <https://app.apptweak.com>
2. 右上角账户 → **Settings / API**(或联系你们账户的管理员)
3. 复制 API key

> 你的 workspace 是 `189777`,是付费账户,通常自带 API 额度。如果后台没看到 API 入口,让管理员在计划里开启 API 权限,或找 Apptweak 客服。

---

## 2. 运行

```bash
# 进入脚本目录
cd scraper

# 设置 key(推荐用环境变量,别写进命令历史)
export APPTWEAK_API_KEY="你的key"

# 抓取本例这个 App(默认参数就是链接里的 com.oakever.jigsawcard / US)
python3 apptweak_scraper.py \
    --package com.oakever.jigsawcard \
    --country us --language us --device android \
    --start 2022-01-01 --end 2026-07-06 \
    --out ./apptweak_out
```

Windows(PowerShell):

```powershell
cd scraper
$env:APPTWEAK_API_KEY="你的key"
python apptweak_scraper.py --package com.oakever.jigsawcard --country us --language us --start 2022-01-01 --end 2026-07-06
```

### 常用参数

| 参数 | 说明 | 默认 |
|---|---|---|
| `--package` | Android 包名 | `com.oakever.jigsawcard` |
| `--country` / `--language` | 市场 / 语言 | `us` / `us` |
| `--device` | 设备 | `android` |
| `--start` / `--end` | 历史时间范围 `YYYY-MM-DD` | `2022-01-01` / 今天 |
| `--chunk-days` | 历史请求分段天数(避免区间过大) | `90` |
| `--out` | 输出目录 | `./apptweak_out` |
| `--no-history` | 只抓当前图,不抓历史 | 关 |
| `--no-download` | 只出 JSON 清单,不下载图片 | 关 |

---

## 3. 输出结构

```
apptweak_out/com.oakever.jigsawcard/
├── current/               当前 icon + 截图
│   ├── icon.png
│   ├── screenshot_01.png
│   └── ...
├── history/               历史各版本(按变更日期分文件夹)
│   ├── 2024-03-01/
│   │   └── screenshot_xxx.jpg
│   └── 2024-06-15/
│       └── icon_xxx.png
├── raw/                   API 原始 JSON(核对结构 / 排错用)
│   ├── metadata.json
│   └── metadata_changes.json
└── manifest.json          总清单(每张图的 URL / 类型 / 日期 / 本地路径)
```

`manifest.json` 里每条记录都带 `url`、`kind`(icon/screenshot)、`date`、本地 `file` 路径,方便后续导入你的「图测记录工具」。

---

## 4. 技术说明(供排错)

- **认证**:HTTP 头 `X-Apptweak-Key: <key>`,基址 `https://api.apptweak.com`。
- **端点**:
  - 当前:`GET /android/applications/{包名}/metadata.json`
  - 历史:`GET /android/applications/{包名}/metadata/changes.json?start_date=…&end_date=…`
- **限速**:官方 60 请求 / 10 秒。脚本分段之间有保守间隔 + 遇 429/5xx 自动指数退避重试。
- **防御式解析**:脚本不假设 API 返回的确切字段结构 —— 它会**递归扫描整个 JSON**,把所有像图片 URL 的字符串都捞出来,再按 JSON 路径判断是 icon 还是 screenshot。所以即便 Apptweak 改了字段名,图片依然抓得到;`raw/` 里存着原始响应可随时核对。
- **断点续传**:已下载的图片会跳过,可反复运行。

> ⚠️ 历史图片指向 Google Play / Apptweak 的 CDN。很老的历史图 CDN 可能已失效,那种会在日志里标 `✗ 下载失败`,但 URL 仍会记进 `manifest.json`。

---

## 5. 如果认证失败(HTTP 401/403)

- key 复制错了 / 带了空格;
- 账户没开 metadata 接口权限 → 找管理员或 Apptweak 客服;
- 免费试用 key 可能只能访问部分 App / 端点。
