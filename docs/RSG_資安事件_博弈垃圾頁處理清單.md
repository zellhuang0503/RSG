# rsg.com.tw 資安事件：博弈 SEO 垃圾頁植入 — 處理清單

**發現日期**：2026-09-20
**狀態**：待處理（本清單完成前，暫停 GEO/AEO 專案的切橘雲與 Worker 部署）

## 事件摘要

- 對 `https://rsg.com.tw/about` 的請求回傳印尼博弈垃圾頁（關鍵字 DEWI111、slot gacor、Slot88；偽裝成 eBay 商品頁，`canonical` 指向 `/about`，hero 圖來自 postimg.cc，amphtml 指向 `*.workers.dev`）。
- Google `site:rsg.com.tw` 查詢中，`/about` 的收錄標題已變成「Server Slot Gacor Jackpot Terbesar Situs Slot88 Auto Maxwin…」，其餘頁面標題正常。
- 回應標頭為 `Server: LiteSpeed`、無 `cf-ray`，確認網站仍為灰雲，垃圾內容由 A2 主機上的 WordPress 直接輸出，**不是 Cloudflare 功能造成**。
- 手法為 SEO spam injection / cloaking：一般瀏覽器可能看到正常頁面，只對爬蟲或特定請求標頭吐垃圾內容，業主自行瀏覽不易察覺。
- 同時觀察到 GPTBot 被原站回 429（ClaudeBot、PerplexityBot、bingbot 正常），來源是主機端的 Wordfence 速率限制或 LiteSpeed 規則。

## 主機環境（引用自 rsg-edge/README.md）

- A2 Hosting 新加坡機房，rsg.com.tw 為 vae-marketing.com 帳號下的附加網域，**同帳號另有 21 個網站**。
- WordPress 6.8.9、PHP 8.3、Avada 7.12.1（未更新至 7.16.1）、30 個外掛全部啟用，其中含 File Manager Advanced。

## 第 0 階段：保全證據與通知（當天）

- [ ] 通知業主（關係花園），說明影響範圍與預計處理時程。
- [ ] cPanel 對整個帳號做一次完整備份，命名含日期與「infected」字樣，**不要覆蓋既有備份**，保留作鑑識用。
- [ ] 保存證據：`curl -s -A "Googlebot/2.1" https://rsg.com.tw/about > about_infected.html`，連同 Google 搜尋結果截圖一併存檔。
- [ ] 到 Google Search Console 檢視「安全性與專人介入處理」→「安全性問題」，記錄目前狀態。

## 第 1 階段：找出入侵點與被改的檔案

### Wordfence 掃描

- [ ] Wordfence → Scan → 掃描選項改「高敏感度」，勾選：核心檔案比對、佈景主題與外掛檔案比對、掃描映像檔與二進位檔案中的 PHP、掃描 wp-content 外的檔案。
- [ ] 逐一處理掃描結果中的「未知檔案」「已修改的核心檔案」「可疑程式碼」。

### 手動檢查（Wordfence 抓不到的常見藏匿點）

- [ ] `wp-content/uploads/` 底下任何 `.php`、`.phtml`、`.ico` 但內容為 PHP 的檔案。
  ```bash
  find wp-content/uploads -type f \( -name "*.php" -o -name "*.phtml" -o -name "*.php.*" \) -print
  grep -rl "<?php" wp-content/uploads --include="*.ico" --include="*.png" --include="*.jpg"
  ```
- [ ] 根目錄、`wp-content/`、`wp-content/uploads/` 的 `.htaccess`：找 `RewriteCond %{HTTP_USER_AGENT}`、`RewriteRule` 導向不明 PHP、`php_value auto_prepend_file`。
- [ ] `wp-config.php`：找不明的 `include`/`require`、`eval`、`base64_decode`、`gzinflate`。
- [ ] `wp-content/mu-plugins/`：此目錄的外掛不會出現在後台外掛清單，任何不認識的檔案都要看。
- [ ] Avada 子主題 `functions.php` 與 `header.php`、Avada 主題 `functions.php`：找 `eval`、`base64_decode`、`str_rot13`、`gzinflate`、長串十六進位字串、以 `$_REQUEST`/`$_COOKIE` 觸發的程式碼。
- [ ] `index.php`、`wp-load.php`、`wp-settings.php`、`wp-includes/` 內最近修改時間異常的檔案：
  ```bash
  find . -type f -name "*.php" -mtime -60 -not -path "./wp-content/cache/*" -printf "%TY-%Tm-%Td %TH:%TM %p\n" | sort
  ```
- [ ] 全站 grep 垃圾關鍵字：
  ```bash
  grep -rIl -E "dewi111|slot gacor|gacor|maxwin|postimg\.cc|workers\.dev" . --include="*.php" --include="*.js" --include="*.htaccess"
  ```

### 資料庫檢查

- [ ] `wp_options`：`siteurl`、`home` 是否正確；`active_plugins` 有無不認識的外掛；找 `option_name` 含 `widget_text`、`widget_custom_html` 中的可疑 script；找 base64 長字串。
  ```sql
  SELECT option_name, LENGTH(option_value) FROM wp_options WHERE option_value LIKE '%base64_decode%' OR option_value LIKE '%eval(%' OR option_value LIKE '%gacor%' OR option_value LIKE '%dewi111%';
  ```
- [ ] `wp_posts`：`/about` 頁（page）的 `post_content` 是否被改；全表搜尋垃圾關鍵字與 `<script`：
  ```sql
  SELECT ID, post_title, post_type, post_status FROM wp_posts WHERE post_content LIKE '%gacor%' OR post_content LIKE '%dewi111%' OR post_content LIKE '%<script%';
  ```
- [ ] `wp_postmeta`：Rank Math 的 `rank_math_title`、`rank_math_description`、`rank_math_canonical_url` 有無被改（尤其 `/about` 的 post ID）。
- [ ] `wp_users` / `wp_usermeta`：列出所有 `administrator`，刪除不認識的帳號；檢查既有管理員的 email 是否被改。
- [ ] WP-Cron：安裝 WP Crontrol 或查 `wp_options` 的 `cron` 欄位，找不明排程（常見用來定期重新寫入後門）。

### 外掛與主題

- [ ] **移除 File Manager Advanced**（檔案管理類外掛是此類事件的高頻入口）；後續需要傳檔案改用 cPanel 檔案管理員或 SFTP。
- [ ] 檢查是否有「不在後台清單但存在於 `wp-content/plugins/` 的目錄」；有就刪。
- [ ] 記錄所有外掛版本，與 WPScan / Patchstack 的漏洞資料庫比對，找出近期有已知漏洞的版本。

## 第 2 階段：清除與加固

- [ ] 刪除所有找到的後門檔案與被注入的程式碼；被改的核心檔案用 Wordfence「還原原始版本」或 WP-CLI `wp core download --force --skip-content` 重新覆蓋。
- [ ] Avada 更新至最新版（7.16.1 或更新），所有外掛更新至最新版；無法更新或已棄用的外掛移除。
- [ ] 更換全部密碼：所有 WordPress 管理員、cPanel、FTP/SFTP、MySQL 使用者，並更新 `wp-config.php` 的 DB 密碼。
- [ ] 重產 `wp-config.php` 的 8 組 salts（https://api.wordpress.org/secret-key/1.1/salt/），強制所有登入失效。
- [ ] 檢查 cPanel 帳號本身：Email 帳號密碼、cron jobs、SSH keys、`~/.bashrc`、`~/public_html` 以外的目錄有無可疑檔案。
- [ ] 若主機提供，開啟 A2 的 Imunify360 / Patchman 掃描（cPanel 內查看是否有此工具）。
- [ ] 依 rsg-edge/README.md 決策，Wordfence 與 Kadence Security Basic 二擇一；UpdraftPlus 與 WPvivid 二擇一，降低攻擊面。
- [ ] Wordfence 開啟：登入雙因素驗證、暴力破解保護、防火牆「擴充保護模式」。
- [ ] 檔案權限：目錄 755、檔案 644、`wp-config.php` 440 或 400；`wp-content/uploads` 加 `.htaccess` 禁止執行 PHP：
  ```apache
  <FilesMatch "\.(php|phtml|php[0-9])$">
    Require all denied
  </FilesMatch>
  ```
- [ ] 若無法確定已清乾淨：改走「乾淨重建」路線，新裝 WordPress 核心、重新從官方來源下載主題與外掛、只搬 `uploads`（掃過後）與資料庫（掃過後）。

## 第 3 階段：同帳號其他 21 個網站

同一個 cPanel 使用者下的網站，PHP 程序可互相讀寫，只清 rsg.com.tw 通常幾天內會再感染。

- [ ] 對同帳號的 21 個網站全部跑第 1 階段的檔案掃描（Wordfence 或 `grep`/`find` 指令）。
- [ ] 沒有在用的網站直接從 cPanel 移除附加網域並刪除檔案。
- [ ] 中長期建議：把 rsg.com.tw 搬到獨立 cPanel 帳號或獨立主機，做帳號層級隔離。

## 第 4 階段：搜尋引擎與 AI 引擎善後

- [ ] Google Search Console：
  - [ ] 「安全性問題」若有列出，清完後送出「要求審查」。
  - [ ] 對 `/about` 使用「網址檢查」→「要求建立索引」；若清理需時，先用「移除」工具暫時隱藏 `/about`。
  - [ ] 「網頁」報表檢查有無突然多出大量不明網址（垃圾頁常會生成上千個假網址）。
  - [ ] 「連結」報表檢查有無博弈網站的外部連結指向本站。
- [ ] Bing Webmaster Tools 同上（ChatGPT 搜尋用 Bing 索引）。
- [ ] 一週後再用 `site:rsg.com.tw` 與 `site:rsg.com.tw gacor` 覆核。
- [ ] 若 AI 引擎（ChatGPT、Perplexity）對「關係花園」的回答出現博弈內容，記錄並等待其索引更新，必要時透過各家的內容回報管道申訴。

## 第 5 階段：GPTBot 429 修正

- [ ] Wordfence → Firewall → Rate Limiting：查看「Live Traffic」中 GPTBot 的紀錄，是被速率限制還是被封鎖清單擋。
- [ ] 若是 Wordfence：Rate Limiting 的「If a crawler's page views exceed」放寬，或在「Allowlisted URLs / IPs」加入 OpenAI 公布的 GPTBot IP 範圍（https://openai.com/gptbot.json）。
- [ ] 若 Wordfence 沒有紀錄：查 cPanel 的 LiteSpeed 設定與 `.htaccess` 有無針對 User-Agent 的規則。
- [ ] 修正後驗證：`curl -sI -A "GPTBot/1.0" https://rsg.com.tw/` 應回 200。

## 第 6 階段：清理完成的驗收標準

全部符合才可繼續 rsg-edge/README.md 的「橘雲前置檢查清單」：

- [ ] 用一般瀏覽器 UA、Googlebot UA、`Accept: text/markdown` 三種方式請求 `/about` 與首頁，內容皆為關係花園正常頁面。
- [ ] Wordfence 完整掃描零發現。
- [ ] 全站 `grep` 垃圾關鍵字零命中。
- [ ] Google Search Console「安全性問題」為空，`/about` 收錄標題恢復正常。
- [ ] 同帳號其他網站掃描完成且無發現。
- [ ] 所有密碼與 salts 已更換，File Manager Advanced 已移除。
- [ ] GPTBot、ClaudeBot、PerplexityBot、bingbot 皆回 200。

## 順帶修正的 SEO 問題（清理後處理，非本事件範圍）

本次檢測同時觀察到，列在這裡避免遺漏：

| 項目 | 現況 | 處理 |
|---|---|---|
| Organization schema 重複 | 首頁輸出兩個 `Organization`，同一 `@id`，`sameAs` 為空 | Schema & Structured Data 外掛與 Rank Math 二擇一，填齊 sameAs |
| 作者資訊外洩 | VideoObject 的 author 名稱為 Gmail 信箱，`sameAs` 指向舊測試主機 huangc13.sg-host.com | WordPress 使用者「公開顯示名稱」改為關係花園或講師名，清除網站欄位 |
| 首頁 title 重複 | 「關係花園 Relationship Garden - 關係花園 Relationship Garden」 | Rank Math 首頁 title 改為單一品牌名加標語 |
| 首頁 description | 出現兩個 meta description，內容為頁面文字片段 | Rank Math 首頁 description 重填；查是否 Avada 或 SASWP 也在輸出 |
| H1 內含 H2 | Avada 標題元件文字欄位被填入 HTML | 該元件改為純文字 |
| robots.txt | 大量 All-in-One Event Calendar 遺留規則，無 `Sitemap:` 行 | Rank Math → 一般設定 → 編輯 robots.txt，清掉 `action~` 規則並加 `Sitemap: https://rsg.com.tw/sitemap_index.xml` |

## 對 GEO/AEO 專案時程的影響

在被入侵狀態下切橘雲、允許 AI 爬蟲、注入 Organization schema，等於協助垃圾頁擴散並讓 AI 引擎把博弈內容與「關係花園」關聯起來。本清單第 6 階段驗收通過後，再依 rsg-edge/README.md 進行橘雲切換與 Worker 部署。
