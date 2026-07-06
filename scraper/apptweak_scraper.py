#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Apptweak 应用图 + 历史图测 爬虫（官方 API 版）
================================================

用途：给定一个 App 的包名，通过 Apptweak 官方 REST API 拉取：
  1) 当前应用图（icon + 截图）              —— metadata.json
  2) 历史元数据变更（icon/截图 的历史版本）  —— metadata/changes.json（timeline_tab）
并把所有图片下载到本地、生成 manifest.json。

为什么用官方 API 而不是爬网页：
  - Apptweak 前端是 SPA，HTML 里没数据，真正的数据走后台 API；
  - 用你自己的 API key 走官方接口是完全正当的（不是匿名爬虫）。

认证：HTTP 头 `X-Apptweak-Key: <你的key>`
基址：https://api.apptweak.com
限速：官方 60 请求 / 10 秒（本脚本默认更保守）

只依赖 Python 标准库（urllib），无需 pip install。

用法示例：
  export APPTWEAK_API_KEY="你的key"
  python3 apptweak_scraper.py \
      --package com.oakever.jigsawcard \
      --country us --language us --device android \
      --start 2023-01-01 --end 2026-07-06 \
      --out ./apptweak_out

只要当前图、不要历史：加 --no-history
只要历史、不下载图片（只出 JSON 清单）：加 --no-download
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

API_BASE = "https://api.apptweak.com"

# 识别「像图片 URL」的正则：Google Play CDN / Apptweak CDN / 常见图片后缀
IMG_URL_RE = re.compile(
    r"https?://[^\s\"'<>()]+?"
    r"(?:googleusercontent|play-lh|apptweak|ggpht|gstatic|mzstatic|apple)"
    r"[^\s\"'<>()]*"
    r"|https?://[^\s\"'<>()]+?\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s\"'<>()]*)?",
    re.IGNORECASE,
)

IMG_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
def api_get(path, params, api_key, max_retries=4):
    """GET api.apptweak.com{path}?params，带认证头、指数退避重试。返回解析后的 JSON。"""
    qs = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"{API_BASE}{path}?{qs}"
    headers = {
        "X-Apptweak-Key": api_key,
        "Accept": "application/json",
        "User-Agent": "apptweak-scraper/1.0 (+local)",
    }
    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=40) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw), url
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")[:500]
            except Exception:
                pass
            # 429 限速 / 5xx 可重试；401/403 是凭据问题，直接抛
            if e.code in (401, 403):
                raise SystemExit(
                    f"\n[认证失败 HTTP {e.code}] API key 无效或无该数据权限。\n"
                    f"  URL: {url}\n  返回: {body}\n"
                    f"  → 确认 APPTWEAK_API_KEY 正确、账户有 metadata 接口权限。"
                )
            last_err = f"HTTP {e.code}: {body}"
            if e.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = repr(e)
        wait = 2 ** attempt
        print(f"    ! 请求失败({last_err})，{wait}s 后重试 ({attempt+1}/{max_retries})…")
        time.sleep(wait)
    raise RuntimeError(f"请求最终失败: {url}\n  {last_err}")


def download(url, dest_path, retries=3):
    """下载单张图片到 dest_path。返回 True/False。"""
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
        return True  # 已存在，跳过（可断点续传）
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 apptweak-scraper/1.0"}
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if not data:
                raise ValueError("空响应")
            with open(dest_path, "wb") as f:
                f.write(data)
            return True
        except Exception as e:
            if attempt == retries - 1:
                print(f"    ✗ 下载失败: {url}\n        {e!r}")
                return False
            time.sleep(2 ** attempt)
    return False


# ---------------------------------------------------------------------------
# JSON 解析（防御式：不赌 API 具体结构，递归找图片 URL）
# ---------------------------------------------------------------------------
def walk_find_images(node, path=""):
    """
    递归遍历任意 JSON，产出 (json_path, url) 图片 URL。
    这样即便 Apptweak 的字段结构和预期不同，也能把图片捞出来。
    """
    if isinstance(node, dict):
        for k, v in node.items():
            yield from walk_find_images(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk_find_images(v, f"{path}[{i}]")
    elif isinstance(node, str):
        for m in IMG_URL_RE.findall(node):
            yield path, m
        # 有时整个字符串就是一个 URL 但没匹配上正则的 CDN 名，兜底：
        if node.startswith("http") and node.lower().split("?")[0].endswith(IMG_EXTS):
            yield path, node


def classify(json_path):
    """根据 JSON 路径粗略判断是 icon 还是 screenshot。"""
    p = json_path.lower()
    if "icon" in p:
        return "icon"
    if "screenshot" in p:
        return "screenshot"
    return "image"


def guess_ext(url):
    base = url.lower().split("?")[0]
    for e in IMG_EXTS:
        if base.endswith(e):
            return e
    return ".png"  # 默认


def safe_name(s):
    return re.sub(r"[^0-9A-Za-z._-]+", "_", s)[:120]


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def daterange_chunks(start, end, days=90):
    """把 [start, end] 切成不超过 days 天的窗口，避免单次请求区间过大。"""
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=days - 1), end)
        yield cur, chunk_end
        cur = chunk_end + timedelta(days=1)


def fetch_current(args, api_key, outdir, manifest):
    print("\n[1/2] 拉取当前应用图（metadata.json）…")
    path = f"/android/applications/{args.package}/metadata.json"
    params = {
        "country": args.country,
        "language": args.language,
        "device": args.device,
    }
    data, url = api_get(path, params, api_key)
    # 存原始 JSON
    raw_path = os.path.join(outdir, "raw", "metadata.json")
    os.makedirs(os.path.dirname(raw_path), exist_ok=True)
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"    原始响应已存: {raw_path}")

    images = list(dict.fromkeys(walk_find_images(data)))  # 去重保序
    print(f"    发现 {len(images)} 张图片 URL")

    cur_dir = os.path.join(outdir, "current")
    entries = []
    seen = set()
    idx = {"icon": 0, "screenshot": 0, "image": 0}
    for jpath, url_img in images:
        if url_img in seen:
            continue
        seen.add(url_img)
        kind = classify(jpath)
        idx[kind] += 1
        ext = guess_ext(url_img)
        if kind == "icon":
            fname = f"icon{ext}"
        else:
            fname = f"{kind}_{idx[kind]:02d}{ext}"
        dest = os.path.join(cur_dir, fname)
        ok = True
        if not args.no_download:
            ok = download(url_img, dest)
        entries.append({
            "kind": kind,
            "url": url_img,
            "json_path": jpath,
            "file": os.path.relpath(dest, outdir) if not args.no_download else None,
            "downloaded": ok if not args.no_download else False,
        })
    manifest["current"] = {"source_url": url, "images": entries}
    print(f"    当前图完成：{sum(1 for e in entries if e['downloaded'])}/{len(entries)} 下载成功")


def fetch_history(args, api_key, outdir, manifest):
    print("\n[2/2] 拉取历史元数据变更（metadata/changes.json = timeline_tab）…")
    path = f"/android/applications/{args.package}/metadata/changes.json"
    start = datetime.strptime(args.start, "%Y-%m-%d").date()
    end = datetime.strptime(args.end, "%Y-%m-%d").date()

    all_changes_raw = []
    hist_entries = []
    hist_dir = os.path.join(outdir, "history")

    for cs, ce in daterange_chunks(start, end, days=args.chunk_days):
        print(f"    区间 {cs} ~ {ce} …")
        params = {
            "country": args.country,
            "language": args.language,
            "start_date": cs.isoformat(),
            "end_date": ce.isoformat(),
        }
        data, url = api_get(path, params, api_key)
        all_changes_raw.append({"start": cs.isoformat(), "end": ce.isoformat(), "response": data})

        # 防御式：遍历整个响应，找带日期上下文的图片。
        # metadata/changes 的结构通常是「按 metadata 字段名分组 → 变更列表(含 date + value)」。
        # 我们既做结构化解析尝试，也做兜底全局扫描。
        extracted = extract_history_images(data)
        for item in extracted:
            when = item.get("date") or f"{cs.isoformat()}_{ce.isoformat()}"
            field = item.get("field") or classify(item["json_path"])
            url_img = item["url"]
            kind = "icon" if "icon" in (field or "").lower() else \
                   ("screenshot" if "screenshot" in (field or "").lower() else classify(item["json_path"]))
            sub = os.path.join(hist_dir, safe_name(str(when)))
            ext = guess_ext(url_img)
            fname = f"{kind}_{safe_name(os.path.basename(url_img.split('?')[0]))}"
            if not fname.lower().endswith(IMG_EXTS):
                fname += ext
            dest = os.path.join(sub, fname)
            ok = True
            if not args.no_download:
                ok = download(url_img, dest)
            hist_entries.append({
                "date": str(when),
                "kind": kind,
                "field": field,
                "url": url_img,
                "json_path": item["json_path"],
                "file": os.path.relpath(dest, outdir) if not args.no_download else None,
                "downloaded": ok if not args.no_download else False,
            })
        time.sleep(0.4)  # 限速保守间隔

    # 存历史原始 JSON
    raw_path = os.path.join(outdir, "raw", "metadata_changes.json")
    os.makedirs(os.path.dirname(raw_path), exist_ok=True)
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(all_changes_raw, f, ensure_ascii=False, indent=2)
    print(f"    历史原始响应已存: {raw_path}")

    # 去重（同一 URL 可能在多个区间重复出现）
    uniq = {}
    for e in hist_entries:
        uniq.setdefault(e["url"], e)
    manifest["history"] = {"source_path": path, "images": list(uniq.values())}
    dl = sum(1 for e in uniq.values() if e["downloaded"])
    print(f"    历史图完成：{dl}/{len(uniq)} 下载成功（共 {len(uniq)} 个唯一图片）")


def extract_history_images(data):
    """
    从 metadata/changes 响应里抽取历史图片，尽量带上变更日期与字段名。
    结构未知，所以做两层：
      1) 尝试结构化：找到含 'date'/'change_date' 且其邻域有图片的对象。
      2) 兜底：全局递归扫描所有图片 URL（date 置空）。
    """
    results = []
    seen = set()

    def rec(node, path, ctx_date, ctx_field):
        if isinstance(node, dict):
            # 更新上下文日期/字段
            d = ctx_date
            for dk in ("date", "change_date", "changed_at", "timestamp", "day"):
                if dk in node and isinstance(node[dk], (str, int)):
                    d = normalize_date(node[dk])
                    break
            f = ctx_field
            for fk in ("metadata", "field", "type", "name"):
                if fk in node and isinstance(node[fk], str):
                    f = node[fk]
                    break
            for k, v in node.items():
                nf = k if isinstance(v, (str,)) and ("icon" in k.lower() or "screenshot" in k.lower()) else f
                rec(v, f"{path}.{k}", d, nf)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                rec(v, f"{path}[{i}]", ctx_date, ctx_field)
        elif isinstance(node, str):
            for _, url in [("", u) for u in IMG_URL_RE.findall(node)] or \
                          ([("", node)] if node.startswith("http") and
                           node.lower().split("?")[0].endswith(IMG_EXTS) else []):
                key = (url, ctx_date)
                if key in seen:
                    continue
                seen.add(key)
                results.append({"url": url, "date": ctx_date, "field": ctx_field, "json_path": path})

    rec(data, "", None, None)
    return results


def normalize_date(v):
    s = str(v)
    # 处理常见格式 / 时间戳
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s.split("+")[0].rstrip("Z") if "T" in s else s, fmt.rstrip("Z")).date().isoformat()
        except Exception:
            continue
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    return s


def main():
    ap = argparse.ArgumentParser(description="Apptweak 应用图 + 历史图测 爬虫（官方 API）")
    ap.add_argument("--package", default="com.oakever.jigsawcard", help="Android 包名")
    ap.add_argument("--country", default="us")
    ap.add_argument("--language", default="us")
    ap.add_argument("--device", default="android")
    ap.add_argument("--start", default="2022-01-01", help="历史起始 YYYY-MM-DD")
    ap.add_argument("--end", default=date.today().isoformat(), help="历史结束 YYYY-MM-DD")
    ap.add_argument("--chunk-days", type=int, default=90, help="历史请求分段天数")
    ap.add_argument("--out", default="./apptweak_out", help="输出目录")
    ap.add_argument("--api-key", default=os.environ.get("APPTWEAK_API_KEY"),
                    help="Apptweak API key（也可用环境变量 APPTWEAK_API_KEY）")
    ap.add_argument("--no-history", action="store_true", help="只抓当前图，不抓历史")
    ap.add_argument("--no-download", action="store_true", help="只出 JSON 清单，不下载图片")
    args = ap.parse_args()

    if not args.api_key:
        sys.exit("错误：缺少 API key。请设置环境变量 APPTWEAK_API_KEY 或用 --api-key 传入。\n"
                 "  获取方式：登录 app.apptweak.com → 右上角账户/Settings → API → 复制 key。")

    outdir = os.path.abspath(os.path.join(args.out, safe_name(args.package)))
    os.makedirs(outdir, exist_ok=True)
    print(f"输出目录: {outdir}")
    print(f"目标 App: {args.package}  |  国家/语言: {args.country}/{args.language}  |  设备: {args.device}")

    manifest = {
        "package": args.package,
        "country": args.country,
        "language": args.language,
        "device": args.device,
        "scraped_at": datetime.now().isoformat(timespec="seconds"),
        "current": None,
        "history": None,
    }

    try:
        fetch_current(args, args.api_key, outdir, manifest)
        if not args.no_history:
            fetch_history(args, args.api_key, outdir, manifest)
    finally:
        mpath = os.path.join(outdir, "manifest.json")
        with open(mpath, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        print(f"\n清单已写: {mpath}")

    print("\n✅ 完成。目录结构：")
    print(f"  {outdir}/")
    print("    ├── current/            当前 icon + 截图")
    print("    ├── history/<日期>/     历史各版本图片")
    print("    ├── raw/                API 原始 JSON（结构核对/排错用）")
    print("    └── manifest.json       总清单")


if __name__ == "__main__":
    main()
