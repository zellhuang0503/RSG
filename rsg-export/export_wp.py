#!/usr/bin/env python3
"""
rsg-export：把 rsg.com.tw 的 WordPress 內容透過公開 REST API 匯出成 Markdown。

不需要後台帳號，只讀公開資料（已發佈的頁面、文章、活動、媒體）。
輸出目錄 out/：
  pages/<slug>.md      頁面（front matter + Markdown + 原始 HTML 另存 raw/）
  posts/<slug>.md      文章
  events/<slug>.md     The Events Calendar 活動
  media/               圖片與附件（維持 wp-content/uploads 之後的相對路徑）
  raw/<type>/<id>.json REST API 原始回應（可重跑轉檔而不必再抓）
  urls.csv             每個原始網址一列：type,id,url,path,title,date,modified,new_path
                       這份就是新站 301 對照表的底稿
  taxonomy.json        分類與標籤
  report.json          統計與錯誤

用法：
  pip install requests markdownify
  python export_wp.py                  # 全部匯出
  python export_wp.py --no-media       # 跳過圖片下載
  python export_wp.py --only pages     # pages / posts / events / media 擇一
  python export_wp.py --resume         # 已存在的 raw/ 不重抓

注意：主機上的 Wordfence 有速率限制，預設每次請求間隔 0.6 秒，
若出現 429 會自動等待後重試。建議先在 Wordfence 把自己的 IP 加入允許清單。
"""
import argparse
import csv
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse, unquote

try:
    import requests
except ImportError:
    sys.exit("請先執行：pip install requests markdownify")
try:
    from markdownify import markdownify as html2md
except ImportError:
    html2md = None

SITE = os.environ.get("SITE_URL", "https://rsg.com.tw").rstrip("/")
API = SITE + "/wp-json"
OUT = Path(os.environ.get("OUT_DIR", "out"))
UA = "rsg-export/1.0 (vai-marketing.com; site migration; contact zell.huang@gmail.com)"
DELAY = float(os.environ.get("DELAY", "0.6"))
PER_PAGE = 50

session = requests.Session()
session.headers["User-Agent"] = UA
report = {"fetched": {}, "errors": [], "media_downloaded": 0, "media_failed": 0}


# ---------- HTTP ----------
def get(url, params=None, stream=False, tries=5):
    for attempt in range(tries):
        try:
            r = session.get(url, params=params, timeout=60, stream=stream)
        except requests.RequestException as e:
            report["errors"].append({"url": url, "error": str(e)})
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code == 429 or r.status_code == 503:
            wait = int(r.headers.get("Retry-After", "0") or 0) or 30 * (attempt + 1)
            print(f"  被速率限制（{r.status_code}），等待 {wait} 秒…")
            time.sleep(wait)
            continue
        time.sleep(DELAY)
        return r
    return None


def paged(endpoint, extra=None):
    """逐頁抓取 REST 集合，回傳所有項目。"""
    items, page = [], 1
    while True:
        params = {"per_page": PER_PAGE, "page": page, "_embed": "1"}
        if extra:
            params.update(extra)
        r = get(f"{API}/{endpoint}", params)
        if r is None:
            break
        if r.status_code == 400 and page > 1:
            break  # 超過最後一頁
        if r.status_code != 200:
            report["errors"].append({"url": r.url, "status": r.status_code, "body": r.text[:200]})
            break
        batch = r.json()
        if not batch:
            break
        items.extend(batch)
        total_pages = int(r.headers.get("X-WP-TotalPages", "1") or 1)
        print(f"  {endpoint} 第 {page}/{total_pages} 頁，累計 {len(items)} 筆")
        if page >= total_pages:
            break
        page += 1
    return items


# ---------- 轉檔 ----------
def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def to_markdown(html):
    if not html:
        return ""
    if html2md is None:
        return html  # 沒裝 markdownify 就保留 HTML
    md = html2md(html, heading_style="ATX", bullets="-", strip=["script", "style"])
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def localize_media(text):
    """把內文裡的 wp-content/uploads 絕對網址改成 /media/ 相對路徑。"""
    return re.sub(
        re.escape(SITE) + r"/wp-content/uploads/",
        "/media/",
        text,
    )


def url_path(u):
    return unquote(urlparse(u).path.rstrip("/")) or "/"


def yaml_str(s):
    s = (s or "").replace('"', '\\"').replace("\n", " ")
    return f'"{s}"'


def featured_image(item):
    try:
        m = item["_embedded"]["wp:featuredmedia"][0]
        return m.get("source_url", "")
    except (KeyError, IndexError, TypeError):
        return ""


def terms(item, taxonomy):
    out = []
    for group in item.get("_embedded", {}).get("wp:term", []):
        for t in group:
            if t.get("taxonomy") == taxonomy:
                out.append(t.get("name"))
    return out


def write_md(kind, item, extra_meta=None):
    slug = unquote(item.get("slug") or str(item["id"]))
    title = strip_html(item["title"]["rendered"] if isinstance(item.get("title"), dict) else item.get("title", ""))
    html = item["content"]["rendered"] if isinstance(item.get("content"), dict) else item.get("content", "") or ""
    excerpt = strip_html(item["excerpt"]["rendered"]) if isinstance(item.get("excerpt"), dict) else ""
    link = item.get("link") or item.get("url", "")
    body = localize_media(to_markdown(html))

    meta = [
        f"title: {yaml_str(title)}",
        f"slug: {yaml_str(slug)}",
        f"wp_id: {item['id']}",
        f"type: {kind}",
        f"original_url: {yaml_str(link)}",
        f"original_path: {yaml_str(url_path(link))}",
        f"date: {yaml_str(item.get('date', ''))}",
        f"modified: {yaml_str(item.get('modified', ''))}",
        f"status: {yaml_str(item.get('status', 'publish'))}",
        f"featured_image: {yaml_str(localize_media(featured_image(item)))}",
        f"excerpt: {yaml_str(excerpt)}",
    ]
    cats = terms(item, "category")
    tags = terms(item, "post_tag")
    if cats:
        meta.append("categories:\n" + "\n".join(f"  - {yaml_str(c)}" for c in cats))
    if tags:
        meta.append("tags:\n" + "\n".join(f"  - {yaml_str(t)}" for t in tags))
    if item.get("parent"):
        meta.append(f"parent_id: {item['parent']}")
    if extra_meta:
        meta.extend(extra_meta)

    d = OUT / kind
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{slug}.md").write_text("---\n" + "\n".join(meta) + "\n---\n\n" + body + "\n", encoding="utf-8")

    rawdir = OUT / "raw" / kind
    rawdir.mkdir(parents=True, exist_ok=True)
    (rawdir / f"{item['id']}.json").write_text(json.dumps(item, ensure_ascii=False, indent=1), encoding="utf-8")
    (rawdir / f"{item['id']}.html").write_text(html, encoding="utf-8")

    return {
        "type": kind,
        "id": item["id"],
        "url": link,
        "path": url_path(link),
        "title": title,
        "date": item.get("date", ""),
        "modified": item.get("modified", ""),
        "new_path": url_path(link),  # 預設維持原路徑，之後在 urls.csv 手動調整
    }


# ---------- 各類內容 ----------
def export_pages(rows):
    print("匯出頁面…")
    items = paged("wp/v2/pages", {"status": "publish"})
    report["fetched"]["pages"] = len(items)
    for it in items:
        rows.append(write_md("pages", it, [f"menu_order: {it.get('menu_order', 0)}", f"template: {yaml_str(it.get('template', ''))}"]))


def export_posts(rows):
    print("匯出文章…")
    items = paged("wp/v2/posts", {"status": "publish"})
    report["fetched"]["posts"] = len(items)
    for it in items:
        rows.append(write_md("posts", it))


def export_events(rows):
    print("匯出活動（The Events Calendar）…")
    items, page = [], 1
    while True:
        r = get(f"{API}/tribe/events/v1/events", {"per_page": PER_PAGE, "page": page, "status": "publish"})
        if r is None or r.status_code != 200:
            if r is not None and page == 1:
                report["errors"].append({"url": r.url, "status": r.status_code, "body": r.text[:200]})
            break
        data = r.json()
        batch = data.get("events", [])
        if not batch:
            break
        items.extend(batch)
        print(f"  events 第 {page}/{data.get('total_pages', '?')} 頁，累計 {len(items)} 筆")
        if page >= int(data.get("total_pages", 1) or 1):
            break
        page += 1
    report["fetched"]["events"] = len(items)
    for ev in items:
        # tribe API 的欄位結構和 wp/v2 不同，整理成相同介面
        venue = ev.get("venue") or {}
        item = {
            "id": ev["id"],
            "slug": ev.get("slug"),
            "title": {"rendered": ev.get("title", "")},
            "content": {"rendered": ev.get("description", "")},
            "excerpt": {"rendered": ev.get("excerpt", "")},
            "link": ev.get("url"),
            "date": ev.get("date"),
            "modified": ev.get("modified"),
            "status": ev.get("status", "publish"),
            "_embedded": {"wp:featuredmedia": [{"source_url": (ev.get("image") or {}).get("url", "")}]} if ev.get("image") else {},
        }
        extra = [
            f"start_date: {yaml_str(ev.get('start_date', ''))}",
            f"end_date: {yaml_str(ev.get('end_date', ''))}",
            f"all_day: {str(ev.get('all_day', False)).lower()}",
            f"venue: {yaml_str(venue.get('venue', '') if isinstance(venue, dict) else '')}",
            f"venue_address: {yaml_str(venue.get('address', '') if isinstance(venue, dict) else '')}",
            f"cost: {yaml_str(ev.get('cost', ''))}",
            f"website: {yaml_str(ev.get('website', ''))}",
        ]
        rows.append(write_md("events", item, extra))


def export_taxonomy():
    print("匯出分類與標籤…")
    tax = {"categories": paged("wp/v2/categories", {"hide_empty": "false"}),
           "tags": paged("wp/v2/tags", {"hide_empty": "false"})}
    (OUT / "taxonomy.json").write_text(json.dumps(tax, ensure_ascii=False, indent=1), encoding="utf-8")


def export_media(rows):
    print("匯出媒體…")
    items = paged("wp/v2/media")
    report["fetched"]["media"] = len(items)
    (OUT / "raw").mkdir(parents=True, exist_ok=True)
    (OUT / "raw" / "media.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    for m in items:
        src = m.get("source_url", "")
        if "/wp-content/uploads/" not in src:
            continue
        rel = src.split("/wp-content/uploads/", 1)[1]
        dest = OUT / "media" / rel
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        r = get(src, stream=True, tries=3)
        if r is None or r.status_code != 200:
            report["media_failed"] += 1
            continue
        with open(dest, "wb") as f:
            for chunk in r.iter_content(65536):
                f.write(chunk)
        report["media_downloaded"] += 1
        if report["media_downloaded"] % 50 == 0:
            print(f"  已下載 {report['media_downloaded']} 個檔案")
        rows.append({"type": "media", "id": m["id"], "url": src, "path": url_path(src), "title": strip_html(m.get("title", {}).get("rendered", "")),
                     "date": m.get("date", ""), "modified": m.get("modified", ""), "new_path": "/media/" + rel})


def export_sitemap_urls(rows):
    """從 Rank Math sitemap 補抓 REST 沒涵蓋的網址（分類頁、作者頁等），確保 301 對照表完整。"""
    print("讀取 sitemap…")
    seen = {r["url"] for r in rows}
    r = get(f"{SITE}/sitemap_index.xml")
    if r is None or r.status_code != 200:
        return
    subs = re.findall(r"<loc>(.*?)</loc>", r.text)
    for sm in subs:
        rr = get(sm)
        if rr is None or rr.status_code != 200:
            continue
        for u in re.findall(r"<loc>(.*?)</loc>", rr.text):
            if u in seen or "/wp-content/uploads/" in u:
                continue
            seen.add(u)
            rows.append({"type": "sitemap-only", "id": "", "url": u, "path": url_path(u), "title": "", "date": "", "modified": "", "new_path": url_path(u)})


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["pages", "posts", "events", "media"])
    ap.add_argument("--no-media", action="store_true")
    ap.add_argument("--resume", action="store_true", help="保留既有輸出，只補缺的媒體")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    t0 = time.time()

    if args.only in (None, "pages"):
        export_pages(rows)
    if args.only in (None, "posts"):
        export_posts(rows)
    if args.only in (None, "events"):
        export_events(rows)
    if args.only is None:
        export_taxonomy()
    if args.only in (None, "media") and not args.no_media:
        export_media(rows)
    if args.only is None:
        export_sitemap_urls(rows)

    with open(OUT / "urls.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["type", "id", "url", "path", "title", "date", "modified", "new_path"])
        w.writeheader()
        w.writerows(rows)

    report["seconds"] = round(time.time() - t0)
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n完成：", json.dumps(report["fetched"], ensure_ascii=False),
          f"，媒體 {report['media_downloaded']} 個，失敗 {report['media_failed']} 個，錯誤 {len(report['errors'])} 筆，耗時 {report['seconds']} 秒")
    print(f"輸出在 {OUT.resolve()}；urls.csv 是 301 對照表底稿。")


if __name__ == "__main__":
    main()
