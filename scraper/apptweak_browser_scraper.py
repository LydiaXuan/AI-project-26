#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Apptweak 应用图 + 历史图测 爬虫（浏览器会话版 / 无需 API 席位）
================================================================

适用场景：你能登录 app.apptweak.com 网页，但**没有 API 席位**（拿不到 API key）。
本脚本用 Playwright 驱动一个真实浏览器，**复用你手动登录的会话**，打开目标页面，
把页面加载过程中请求到的 JSON 数据和图片全部抓下来。相当于「你自己的浏览器在帮你另存」。

原理：
  - 你先跑一次 `login` 模式，浏览器弹出，你在里面正常登录 Apptweak；
    脚本把登录态（cookies + localStorage）存到 state.json。
  - 然后跑 `scrape` 模式，脚本用这个会话打开页面，监听所有网络响应，
    自动滚动加载懒加载内容，抓 JSON + 下载图片。

两步用法：
  # 第一步：登录（只需做一次，session 过期后重做）
  python3 apptweak_browser_scraper.py login

  # 第二步：抓取（可反复跑）
  python3 apptweak_browser_scraper.py scrape \
      --url "https://app.apptweak.com/aso-intelligence/applications/android/com.oakever.jigsawcard/metadata?scope=country&country=us&language=us&device=android&view=timeline_tab&workspace=189777" \
      --out ./apptweak_out

环境准备（在你自己电脑上）：
  pip install playwright
  playwright install chromium

⚠️ 合规提醒：这是用**你自己的付费账户**在浏览器里查看你有权访问的数据，只是自动化了
   「另存图片」这一步。请遵守 Apptweak 的服务条款，只抓你自己账户可见的内容，别高频批量。
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime

APPTWEAK_HOME = "https://app.apptweak.com"
STATE_FILE_DEFAULT = "state.json"

# 识别「值得抓」的图片 URL：Play / Apptweak / Apple CDN，或常见图片后缀。
IMG_URL_RE = re.compile(
    r"https?://[^\s\"'<>()\\]+?"
    r"(?:googleusercontent|play-lh|ggpht|apptweak|mzstatic|is[1-9]-ssl\.mzstatic)"
    r"[^\s\"'<>()\\]*"
    r"|https?://[^\s\"'<>()\\]+?\.(?:png|jpg|jpeg|webp)(?:\?[^\s\"'<>()\\]*)?",
    re.IGNORECASE,
)
IMG_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def find_chromium():
    """定位 Chromium 可执行文件。优先环境变量，其次本机常见路径，最后交给 Playwright 默认。"""
    env = os.environ.get("PLAYWRIGHT_EXECUTABLE")
    if env and os.path.exists(env):
        return env
    # Claude 云环境预装路径
    for base in ("/opt/pw-browsers",):
        if os.path.isdir(base):
            for name in sorted(os.listdir(base), reverse=True):
                if name.startswith("chromium-"):
                    cand = os.path.join(base, name, "chrome-linux", "chrome")
                    if os.path.exists(cand):
                        return cand
    return None  # 用户机器上 `playwright install chromium` 后走默认即可


def classify_url(url):
    u = url.lower()
    if "icon" in u:
        return "icon"
    if "screenshot" in u or "/ss/" in u:
        return "screenshot"
    return "image"


def guess_ext(url):
    base = url.lower().split("?")[0]
    for e in IMG_EXTS:
        if base.endswith(e):
            return e
    return ".png"


def safe_name(s):
    return re.sub(r"[^0-9A-Za-z._-]+", "_", s)[:120]


def walk_find_images(node):
    """递归遍历任意 JSON，产出图片 URL（去重在调用处做）。"""
    out = []
    def rec(n):
        if isinstance(n, dict):
            for v in n.values():
                rec(v)
        elif isinstance(n, list):
            for v in n:
                rec(v)
        elif isinstance(n, str):
            out.extend(IMG_URL_RE.findall(n))
            if n.startswith("http") and n.lower().split("?")[0].endswith(IMG_EXTS):
                out.append(n)
    rec(node)
    return out


# ---------------------------------------------------------------------------
# 登录模式
# ---------------------------------------------------------------------------
def do_login(args):
    from playwright.sync_api import sync_playwright
    chromium = find_chromium()
    print("将打开浏览器窗口。请在其中登录 Apptweak，登录完成、能看到数据后，回到本终端按 Enter。")
    with sync_playwright() as p:
        launch_kw = {"headless": False}
        if chromium:
            launch_kw["executable_path"] = chromium
        browser = p.chromium.launch(**launch_kw)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(APPTWEAK_HOME, wait_until="domcontentloaded")
        try:
            input("\n>>> 登录完成后，在此按 Enter 保存会话… ")
        except EOFError:
            print("非交互环境，等待 60 秒后自动保存……")
            time.sleep(60)
        context.storage_state(path=args.state)
        print(f"✅ 会话已保存到 {args.state}")
        browser.close()


# ---------------------------------------------------------------------------
# 抓取模式
# ---------------------------------------------------------------------------
def do_scrape(args):
    from playwright.sync_api import sync_playwright

    if not os.path.exists(args.state):
        sys.exit(f"错误：找不到会话文件 {args.state}。请先运行：python3 {os.path.basename(__file__)} login")

    outdir = os.path.abspath(args.out)
    os.makedirs(os.path.join(outdir, "raw"), exist_ok=True)
    os.makedirs(os.path.join(outdir, "images"), exist_ok=True)

    chromium = find_chromium()
    captured_json = []      # [(url, obj)]
    image_urls = {}         # url -> source(json/img-response/dom)

    def record_image(url, source):
        if not url or url.startswith("data:"):
            return
        # 跳过明显的 UI 静态资源（同域 assets、svg）
        low = url.lower()
        if low.endswith(".svg"):
            return
        if "app.apptweak.com/assets" in low or "/static/" in low:
            return
        image_urls.setdefault(url, source)

    with sync_playwright() as p:
        launch_kw = {"headless": args.headless}
        if chromium:
            launch_kw["executable_path"] = chromium
        browser = p.chromium.launch(**launch_kw)
        context = browser.new_context(storage_state=args.state,
                                      viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 监听所有响应：JSON 存盘 + 抽图；图片响应记录 URL
        def on_response(resp):
            try:
                ct = (resp.headers or {}).get("content-type", "")
            except Exception:
                ct = ""
            url = resp.url
            if ct.startswith("image/"):
                record_image(url, "img-response")
                return
            if "json" in ct or url.lower().endswith(".json"):
                try:
                    obj = resp.json()
                except Exception:
                    return
                captured_json.append((url, obj))
                for u in walk_find_images(obj):
                    record_image(u, "json")

        page.on("response", on_response)

        for target in args.url:
            print(f"\n▶ 打开: {target}")
            try:
                page.goto(target, wait_until="networkidle", timeout=90000)
            except Exception as e:
                print(f"  ! 加载警告（继续）: {e!r}")
            # 触发懒加载：反复滚动到底，直到高度不再变化或达上限
            auto_scroll(page, max_rounds=args.scroll_rounds)
            page.wait_for_timeout(1500)
            # DOM 兜底：抓 <img> 和 CSS 背景图
            try:
                dom_imgs = page.eval_on_selector_all("img", "els => els.map(e => e.currentSrc || e.src)")
            except Exception:
                dom_imgs = []
            for u in dom_imgs:
                if u:
                    record_image(u, "dom")
            try:
                bg = page.evaluate(
                    "() => Array.from(document.querySelectorAll('*'))"
                    ".map(e => getComputedStyle(e).backgroundImage)"
                    ".filter(s => s && s.startsWith('url('))"
                    ".map(s => s.slice(4, -1).replace(/[\"']/g,''))")
            except Exception:
                bg = []
            for u in bg:
                record_image(u, "dom-bg")

        # 存原始 JSON
        raw_path = os.path.join(outdir, "raw", "responses.json")
        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump([{"url": u, "body": o} for u, o in captured_json],
                      f, ensure_ascii=False, indent=2)
        print(f"\n捕获 {len(captured_json)} 个 JSON 响应 → {raw_path}")
        print(f"发现 {len(image_urls)} 个候选图片 URL，开始下载……")

        # 下载图片（用浏览器会话的 request context，带上登录态/正确 header）
        manifest_imgs = []
        idx = {"icon": 0, "screenshot": 0, "image": 0}
        for url, source in image_urls.items():
            kind = classify_url(url)
            idx[kind] += 1
            ext = guess_ext(url)
            fname = f"{kind}_{idx[kind]:03d}{ext}"
            dest = os.path.join(outdir, "images", fname)
            ok = download_via_context(context, url, dest)
            manifest_imgs.append({
                "url": url, "kind": kind, "source": source,
                "file": os.path.relpath(dest, outdir) if ok else None,
                "downloaded": ok,
            })
            print(("  ✓ " if ok else "  ✗ ") + f"{fname}  [{source}]")

        browser.close()

    manifest = {
        "scraped_at": datetime.now().isoformat(timespec="seconds"),
        "target_urls": args.url,
        "json_response_count": len(captured_json),
        "images": manifest_imgs,
    }
    mpath = os.path.join(outdir, "manifest.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    dl = sum(1 for e in manifest_imgs if e["downloaded"])
    print(f"\n✅ 完成：{dl}/{len(manifest_imgs)} 图片下载成功")
    print(f"   图片:   {outdir}/images/")
    print(f"   原始JSON:{outdir}/raw/responses.json  （含历史时间线数据，可据此提取日期）")
    print(f"   清单:   {mpath}")
    if dl == 0 and manifest_imgs:
        print("\n⚠️ 一张都没下下来？可能是会话过期 → 重跑 login；或页面还没加载出图 → 加大 --scroll-rounds。")


def auto_scroll(page, max_rounds=25):
    """反复滚动到底部触发懒加载，直到页面高度稳定。"""
    last_h = 0
    for i in range(max_rounds):
        try:
            h = page.evaluate("() => document.body.scrollHeight")
            page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        except Exception:
            break
        page.wait_for_timeout(800)
        if h == last_h:
            # 再等一轮确认没有新内容
            page.wait_for_timeout(700)
            h2 = page.evaluate("() => document.body.scrollHeight")
            if h2 == h:
                break
        last_h = h
    # 滚回顶部，确保上方图片也进入视口触发加载
    try:
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
    except Exception:
        pass


def download_via_context(context, url, dest, retries=3):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(retries):
        try:
            resp = context.request.get(url, timeout=60000)
            if resp.ok:
                body = resp.body()
                if body:
                    with open(dest, "wb") as f:
                        f.write(body)
                    return True
        except Exception:
            pass
        time.sleep(1.5 * (attempt + 1))
    return False


def main():
    ap = argparse.ArgumentParser(description="Apptweak 浏览器会话版爬虫（无需 API 席位）")
    sub = ap.add_subparsers(dest="mode", required=True)

    lp = sub.add_parser("login", help="打开浏览器登录并保存会话")
    lp.add_argument("--state", default=STATE_FILE_DEFAULT, help="会话文件路径")

    sp = sub.add_parser("scrape", help="用已保存会话抓取页面")
    sp.add_argument("--url", action="append", required=True,
                    help="要抓的页面 URL（可重复传多个 --url）")
    sp.add_argument("--state", default=STATE_FILE_DEFAULT, help="会话文件路径")
    sp.add_argument("--out", default="./apptweak_out", help="输出目录")
    sp.add_argument("--scroll-rounds", type=int, default=25, help="最大滚动轮数（历史多可调大）")
    sp.add_argument("--headless", action="store_true",
                    help="无头模式（默认有头，方便观察/首次调试）")

    args = ap.parse_args()
    if args.mode == "login":
        do_login(args)
    else:
        do_scrape(args)


if __name__ == "__main__":
    main()
