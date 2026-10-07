# rsg.com.tw 新站切換計劃（預定 2026-10-09）

2026-10-07 撰寫；業主已同意 10/9 以新站取代舊 WordPress 主站。**本文件只是計劃，撰寫時沒有改動 DNS、Cloudflare 設定或任何正式環境。**

## 範圍

| 項目 | 處理 |
|---|---|
| `rsg.com.tw`、`www.rsg.com.tw` | 從舊 WordPress（A2 主機）切到 Cloudflare Worker `rsg` |
| `shop.rsg.com.tw`、`cards.rsg.com.tw`、`flora.rsg.com.tw`、`ask.rsg.com.tw` | **完全不動** |
| MX、SPF、DKIM、Resend 三筆記錄 | **完全不動** |
| 舊 WordPress 檔案與資料庫 | 保留在主機上至少一週，作為切回備援 |

新站目前在 `https://rsg.cloundflare1.workers.dev`，Workers Builds 從 `main` 的 `rsg-site/` 自動部署。報名（D1 + Turnstile + Resend）與 Flora（`/api/flora/`）已上線運作，`ALLOWED_ORIGINS` 與 Turnstile 主機名稱都已包含 `rsg.com.tw`。

## 時程

### D-2（10/7，今天）
- [ ] 業主確認切換時段（建議 10/9 上午 9:00–10:00 之前或晚上 22:00 後的離峰時段）與當天聯絡窗口。
- [ ] 通知業主：**10/8 起舊站後台停止新增／修改內容**（內容凍結），否則改動不會出現在新站。

### D-1（10/8）準備
1. **補抓最新內容**：重跑 `rsg-export/export_wp.py` → `npm run import`，比對自上次匯入後舊站新增的文章、活動、頁面；有差異就合併進 `main`。
2. **補一條圖片轉址**（目前缺）：舊站圖片網址是 `/wp-content/uploads/…`，新站在 `/media/…`，外部連結和 Google 圖片搜尋會 404。在 `scripts/_redirects.base` 加 `/wp-content/uploads/*  /media/:splat  301` 後重建 `_redirects`。
3. **抽查舊網址**：從 `content/urls.csv` 隨機抽 30 筆，以及 Search Console「成效」流量前 20 名的網址，對預覽站確認都是 200 或 301 到正確頁面。
4. **記錄回退資料**：Cloudflare `rsg.com.tw` zone → DNS，截圖／匯出目前根網域與 `www` 的 A／CNAME 記錄值（舊主機 IP）及是否為橘色雲。這是切回時唯一要用的數字。
5. **全站最後檢查（預覽站）**：首頁、`/about-2`、任一 `/archives/…`、`/events`、課程報名頁（送一筆測試報名再刪除）、`/search`、Flora 對話一輪、手機版選單。
6. **降低 TTL**：根網域與 `www` 若為「僅 DNS」，把 TTL 改成 2 分鐘，加快切換與回退生效（橘色雲則不需要）。
7. 舊站全站備份（cPanel 檔案 + 資料庫）下載一份到本機。

### D-Day（10/9）切換，約 30 分鐘
1. Cloudflare → Workers 和 Pages → `rsg` → 設定 → 網域和路由 → 新增自訂網域 `rsg.com.tw`、`www.rsg.com.tw`。Cloudflare 會提示取代既有 DNS 記錄，確認時**只動這兩筆**。
2. 規則 → 重新導向規則：主機名稱等於 `www.rsg.com.tw` → 動態 301 → `concat("https://rsg.com.tw", http.request.uri.path)`。
3. 等 1–5 分鐘後驗證：
   - `curl -I https://rsg.com.tw/` 看到 `server: cloudflare`，沒有 `x-powered-by: PHP`。
   - `https://www.rsg.com.tw/` → 301 到非 www。
   - `/about` → `/about-2`；`/feed` → `/feed.xml`；`/wp-login.php` → 商店登入頁；任一舊 `/wp-content/uploads/…` 圖片 → `/media/…`。
   - 報名頁送出一筆測試，確認 Turnstile 通過、收到確認信。
   - 在 `rsg.com.tw` 上開 Flora 對話一輪（驗證新網域在 `ALLOWED_ORIGINS` 內）。
   - 從 `shop.rsg.com.tw`、`cards.rsg.com.tw` 點回主站的連結正常。
4. 郵件檢查（約 10 分鐘，依 `docs/RSG_GEO_AEO_執行方案.md` §8）：新站寄一封報名確認信、業主信箱寄一封到 Gmail，「顯示原始郵件」確認 SPF／DKIM／DMARC 都 PASS。
5. Google Search Console：提交 `https://rsg.com.tw/sitemap-index.xml`，移除舊的 `sitemap_index.xml`／`sitemap.xml`；用「網址審查」對首頁要求建立索引。
6. 通知業主切換完成，附上要請他們自己點一遍的頁面清單。

### 回退（任何時候發現重大問題）
Worker → 網域和路由移除兩個自訂網域，DNS 把 D-1 記錄的原 A 記錄加回去即可，約 5 分鐘生效。舊 WordPress 在回退期間仍完整可用。**判斷標準**：首頁或報名無法使用、大量舊網址 404、寄信失敗，三者任一即回退後再處理。

### D+1 ～ D+7 觀察
- 每天看 Cloudflare Worker 錯誤率與 Search Console「網頁」的 404／重新導向報告，補缺漏轉址。
- Turnstile、Resend、D1 報名每天至少一筆正常。
- 確認 Cloudflare AI Crawl Control／llms.txt 已在主網域生效（主站已走 Proxy）。

### D+7 之後收尾
- 舊站目錄下載備份後從 cPanel 封存刪除，主機只留商店。
- 依 §8 升級 DMARC（`p=none` → `quarantine`）。
- 評估把 `ask.rsg.com.tw` 改為 `rsg.com.tw/ask/`（rsg-edge 模式一）。
- 根網域 TTL 改回 Auto。

## 待業主確認
1. 切換時段與當天聯絡人。
2. 10/8 起內容凍結是否可行。
3. 舊站是否有我們沒盤點到、需要保留的功能（例如表單外掛、會員專區、嵌入的第三方工具）。
4. Google Analytics／GTM：新站目前**沒有**埋追蹤碼。若業主需要延續流量數據，需在切換前提供 GA4 評估 ID 一併加入。
