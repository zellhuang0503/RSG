# rsg-site：關係花園 rsg.com.tw 新主站

以 [Astro](https://astro.build/) 建置的靜態網站，取代原本的 WordPress + Avada 主站。內容是 Markdown 檔案，網站是純 HTML，沒有後台、沒有外掛、沒有資料庫，攻擊面歸零。商店 `shop.rsg.com.tw` 維持原本的 WooCommerce，**完全不動**。

```
rsg-site/
├── content/                 網站內容（全部進版控）
│   ├── pages/*.md           頁面：關於花園、學員分享…
│   ├── posts/*.md           文章
│   ├── events/*.md          課程活動
│   ├── taxonomy.json        分類與標籤（名稱 → 網址 slug）
│   └── urls.csv             舊站網址對照表（匯入後產生）
├── public/                  原樣複製到網站根目錄
│   ├── media/               圖片（舊站 wp-content/uploads 的內容）
│   ├── _redirects           Cloudflare Pages 轉址規則（由 npm run import 產生）
│   ├── _headers             安全與快取標頭
│   └── robots.txt
├── scripts/
│   ├── import-export.mjs    把 rsg-export/out 搬進來
│   └── _redirects.base      固定轉址規則（www、/about、/feed…）
├── src/
│   ├── site.ts              全站設定：選單、每頁篇數、logo
│   ├── content.config.ts    內容欄位定義
│   ├── lib/content.ts       查詢、網址、日期工具
│   ├── layouts/Base.astro   共用版面（head、頁首、頁尾）
│   ├── components/          Seo、Header、Footer、卡片、分頁
│   ├── pages/               路由（見下方「網址規則」）
│   └── styles/global.css    全站樣式與色彩變數
└── astro.config.mjs
```

機構資料（名稱、描述、創辦人、Facebook）讀自 `../rsg-ask/site.config.json`，與問答站、Cloudflare Worker 共用同一份，改一處全部生效。

## 第一次使用

需要 Node.js 22 以上。

```bash
cd rsg-site
npm install
npm run dev        # http://localhost:4321，存檔即時更新
npm run build      # 產生 dist/，含站內搜尋索引
npm run preview    # 用建置結果起本機伺服器（網址行為與正式站相同）
```

骨架附了幾個 `sample-*.md` 範例內容，匯入舊站內容時會自動刪除。

## 匯入舊站內容

1. 先跑匯出（在自己的電腦，或 cPanel 終端機都可以）：

   ```bash
   cd rsg-export
   pip install requests markdownify
   python export_wp.py
   ```

   在 cPanel 終端機跑的話，`pip` 換成 `pip3 install --user requests markdownify`，`python` 換成 `python3`。匯出結果在 `rsg-export/out/`。

2. 搬進新站：

   ```bash
   cd rsg-site
   npm run import                       # 預設讀 ../rsg-export/out
   npm run import -- /path/to/out       # 匯出資料夾在別處時
   ```

   腳本會複製內容與圖片、產生 `public/_redirects`，並列出 `content/unmatched-paths.txt`：舊站 sitemap 有、但新站沒有對應頁面的網址（多半是分類、分頁、作者頁）。看一遍，需要保留的在 `content/urls.csv` 的 `new_path` 填新路徑，重跑 `npm run import` 就會變成 301。

3. `npm run dev` 逐頁檢查。用 Avada Builder 排版的頁面（首頁、關於、課程介紹）轉成 Markdown 後只剩文字與圖片，需要對照 `rsg-export/out/raw/pages/<id>.html` 重新排版；一般文章通常不用改。

4. 圖片如果超過幾百 MB，`public/media/` 進版控會讓 repo 很肥。可以改放 Cloudflare R2 並在 `src/site.ts` 加一個媒體網域，之後再處理。

## 網址規則

**舊站網址一個都不變**，這是最重要的原則，Google 與 AI 引擎已收錄的 `/archives/6311`、`/about-2`、`/events/xxx` 全部維持。

| 網址 | 來源 |
|---|---|
| `/`、`/about-2`、`/archives/6311`、`/events/xxx` … | `content/**` 每個檔案的 `original_path` |
| `/posts`、`/posts/2` … | 文章清單與分頁 |
| `/archives/category/<名稱>`、`/archives/tag/<名稱>` | 分類與標籤，與舊站網址相同 |
| `/events` | 活動清單（即將舉辦 + 過往） |
| `/search` | 站內搜尋（Pagefind，build 時產生索引） |
| `/feed.xml`、`/sitemap-index.xml`、`/llms.txt`、`/robots.txt` | 自動產生 |

網址沒有結尾斜線（與舊站一致）。建置輸出是 `about-2.html`，Cloudflare Pages 會以 `/about-2` 提供並把 `/about-2.html` 轉回乾淨網址。如果匯入時腳本提示舊站多數網址有結尾斜線，把 `astro.config.mjs` 改成 `trailingSlash: 'always'`、`build.format: 'directory'`。

## 內容編輯

每篇內容是一個 Markdown 檔，上半部是欄位、下半部是內文。新文章複製這個範本：

```markdown
---
title: "文章標題"
original_path: "/posts/2026-10-autumn-workshop"   # 網址，開頭有 /、結尾沒有
date: "2026-10-01T10:00:00"
excerpt: "一句話摘要，會出現在清單卡片與搜尋結果"
featured_image: "/media/2026/10/cover.jpg"      # 可留空
categories:
  - "課程紀錄"
tags: []
status: "publish"                                 # draft 不會出現在網站上
---

內文用 Markdown。圖片放 public/media/ 底下：

![說明文字](/media/2026/10/photo.jpg)
```

活動多四個欄位：`start_date`、`end_date`（`2027-01-16 09:30:00` 格式）、`venue`、`cost`、`website`（報名連結，通常是商店的商品頁）。

分類名稱要和 `content/taxonomy.json` 裡的一致，新分類先在那裡加一筆（`name` 與 `slug`）。

選單在 `src/site.ts` 的 `nav`。logo 放到 `public/`，路徑填在 `site.logo`。

### 首頁輪播

把圖片放進 `public/banners/`，依檔名排序自動變成首頁輪播（建議 `01.jpg`、`02.jpg`…，寬 1920px、高 800 到 1000px，每張壓到 300 KB 以下）。每張的文案與連結在 `content/banners.json` 填：

```json
[
  { "file": "01.jpg", "title": "生命覺醒之花", "subtitle": "二十年的耕耘深植，只為此刻的綻放與覺醒。" },
  { "file": "02.jpg", "title": "生命藍圖工作坊", "subtitle": "活出最高版本的自己", "href": "/archives/7554" }
]
```

沒填文案的圖會用 `src/site.ts` 的 `heroTitle`、`heroSubtitle`。資料夾是空的時候，首頁用 `site.heroImage` 單張圖。

## 部署到 Cloudflare Pages（免費）

1. Cloudflare 儀表板 → Workers & Pages → Create → Pages → **Connect to Git**，選這個 repo。
2. 建置設定：
   - Framework preset：Astro
   - Root directory：`rsg-site`
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 環境變數：`NODE_VERSION` = `22`
3. 第一次部署完成會得到 `rsg-site.pages.dev` 預覽網址，全站點一遍。之後每次 push 到 `main` 自動重新部署，PR 會有預覽網址。
4. 正式切換（選離峰時段，整個過程 10 分鐘，可隨時切回）：
   1. Pages 專案 → Custom domains → 加 `rsg.com.tw` 與 `www.rsg.com.tw`。Cloudflare 會提示把 DNS 的 A 記錄改成 CNAME 指向 Pages，按確認。**`shop` 與其他子網域不要動。**
   2. 等 1 到 5 分鐘，`curl -I https://rsg.com.tw/` 應看到 `server: cloudflare`，沒有 `x-powered-by: PHP`。
   3. 打開 `/about-2`、任一篇 `/archives/…`、`/events`、`/search`，以及 `https://www.rsg.com.tw/` 應 301 到非 www。
   4. Google Search Console 重新提交 `sitemap-index.xml`（舊的 `sitemap_index.xml` 與 `sitemap.xml` 可以刪除）。
5. 切回舊站：DNS 把 CNAME 改回原本的 A 記錄即可，舊 WordPress 檔案都還在主機上。確認新站穩定一週後，再從 cPanel 把舊站目錄封存（下載備份後刪除），主機上只留商店。

`.github/workflows/build-site.yml` 會在每次 PR 與 push 做建置檢查，Cloudflare 那邊才是真正的部署。

## 三個動態功能的處理

| 功能 | 做法 |
|---|---|
| 站內搜尋 | Pagefind，純靜態，`npm run build` 時產生索引，不需要伺服器 |
| 聯絡表單 | 靜態站沒有後端。建議用 [Web3Forms](https://web3forms.com/)（免費額度 250 封/月）或 Cloudflare Pages Functions 轉寄 email；在需要的頁面直接放表單 HTML |
| 活動報名與付款 | 全部導向商店 `shop.rsg.com.tw`，活動頁的 `website` 欄位填商品頁連結 |

## 與其他目錄的關係

- `rsg-export/`：一次性的匯出工具，匯入完成後不再需要。
- `rsg-ask/`：學習指南問答站，目前部署在 `ask.rsg.com.tw`。主站上線後可以把它的內容併進本站的 `/ask/` 路徑（同一個 Astro 專案多一個集合），屆時 `rsg-edge` 的 Worker 就不需要了。
- `docs/`：資安事件紀錄與 GEO/AEO 方案。
