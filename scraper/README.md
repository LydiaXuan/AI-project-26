# Apptweak 应用图 + 历史图测 爬虫

抓取指定 App 的**当前应用图**(icon + 截图)和**历史元数据变更**(icon/截图 的历史版本,即 Apptweak `timeline_tab` 的内容),存到本地并生成 `manifest.json`。

走 **Apptweak 官方 REST API**(用你自己的 API key),不是匿名爬网页 —— 合规、稳定、数据结构干净。

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
