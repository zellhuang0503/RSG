# rsg-edge：關係花園 Cloudflare Worker 部署手冊

一支 Worker，兩種部署模式。主站要不要開橘色雲，決定用哪一種。

| | 模式一 subdir（建議） | 模式二 subdomain（備案） |
|---|---|---|
| 網址 | `rsg.com.tw/ask/` | `ask.rsg.com.tw/` |
| 主站 DNS | 需切橘色雲 | 維持灰色雲，完全不動 |
| 繼承主網域權重 | 是，視為官網子目錄 | 部分，需另外累積 |
| www 轉址、robots 補 sitemap、Organization schema 注入、llms.txt 在主網域 | 可以 | 不行（這些都要主站走 Proxy） |
| Cloudflare AI Crawl Control、Markdown for Agents、AI Index、Crawler Hints 對主站生效 | 可以 | 不行 |
| WordPress 外掛相容風險 | 有，需照下方「WordPress 安全開法」設定 | 無 |

## 前置

```bash
cd rsg-edge
npm install            # 只會裝 wrangler
npx wrangler login
```

`site.config.json` 在 `../rsg-ask/`，Worker 與建置共用同一份機構資料。

## 模式二：子網域（可以今天就上線）

```bash
npm run deploy:subdomain
```

wrangler 會自動在 rsg.com.tw 這個 zone 建立 `ask.rsg.com.tw` 的 DNS 記錄並綁定 Worker。主站的 A 記錄一個都不會動。上線後：

1. Google Search Console 新增 `ask.rsg.com.tw` 資源（或直接用 rsg.com.tw 的「網域」資源，會涵蓋所有子網域），提交 `https://ask.rsg.com.tw/sitemap.xml`。
2. Bing Webmaster Tools 同上。
3. 在官網頁尾或選單加一個「學習指南」連結指向 ask.rsg.com.tw。這是唯一需要動官網的一行，若業主不同意，可以先只放 Facebook 粉絲團的「關於」。

## 模式一：子目錄（需先開橘色雲）

### 第一步：WordPress 安全開法（先設定，再切橘雲）

管理員先前把橘雲改回灰雲，通常是這幾個 Cloudflare 功能與外掛打架。**先把它們全部關掉，只留純代理**：

| 位置 | 設定 | 原因 |
|---|---|---|
| SSL/TLS → 概觀 | 加密模式 **Full (strict)** | Flexible 會造成 WordPress 無限轉址 |
| Speed → Optimization | **Rocket Loader 關閉** | 最常打壞 WordPress 外掛 JS（滑塊、表單、Elementor） |
| Speed → Optimization | Auto Minify 全關、Early Hints 關 | 部分主題 CSS/JS 壓縮後失效 |
| Scrape Shield | Email Address Obfuscation **關閉** | 會改寫頁面中的 email，破壞表單與外掛 |
| Security → Bots | Bot Fight Mode **關閉** | 會擋 WooCommerce 金流回呼、REST API、AI 爬蟲 |
| Security → Settings | Browser Integrity Check 關閉 | 會擋部分外掛的 API 請求 |
| Caching → Cache Rules | 新增規則：URI 包含 `/wp-admin`、`/wp-login.php`、`/wp-json`、`/cart`、`/checkout`、`/my-account` 或 Cookie 包含 `wordpress_logged_in` → **Bypass cache** | 避免後台與登入狀態被快取 |
| Network | WebSockets 開、HTTP/3 開 | 無害 |
| WordPress 端 | 安裝官方 **Cloudflare** 外掛，或在 wp-config 加 `HTTP_CF_CONNECTING_IP` 還原訪客 IP | 否則 Wordfence 等安全外掛會把 Cloudflare 的 IP 當攻擊者封鎖 |

### 第二步：切橘雲並驗證

1. DNS 頁把 `rsg.com.tw` 與 `www.rsg.com.tw` 兩筆 A 記錄切成橘色雲。`shop` 先不動。
2. 立刻驗證：首頁、任一課程頁、活動日曆、聯絡表單送出、`/wp-admin` 登入、發佈一篇草稿。
3. 有任何異常，把兩筆切回灰雲即可還原，DNS 生效通常在一分鐘內。

### 第三步：部署 Worker

```bash
npm run deploy:subdir
```

上線後驗證：

```bash
curl -sI https://www.rsg.com.tw/ | findstr /i "location"        # 應為 301 到 rsg.com.tw
curl -s https://rsg.com.tw/robots.txt                             # 末尾應多出 Sitemap: .../ask/sitemap.xml
curl -sI https://rsg.com.tw/ask/ | findstr /i "x-rsg-edge"        # assets
curl -s https://rsg.com.tw/llms.txt
```

### 第四步：確認 Organization schema 後再開注入

跑一次 `curl -s https://rsg.com.tw/ | findstr /i "ld+json"`。若 WordPress 的 SEO 外掛已經輸出 `Organization`，就保持 `INJECT_ORG_SCHEMA: "false"`，改在外掛裡填齊資料；若沒有，把 `wrangler.jsonc` 的 `env.subdir.vars.INJECT_ORG_SCHEMA` 改成 `"true"` 重新部署。重複的 Organization schema 會讓引擎整組丟棄，所以二擇一。

### 第五步：Cloudflare 免費 AI 功能

主站走 Proxy 之後才有意義：

- **Security → AI Crawl Control**：允許 GPTBot、OAI-SearchBot、ClaudeBot、PerplexityBot、Google-Extended；保留封鎖純訓練用爬蟲可自行決定。
- **Caching → Configuration → Crawler Hints** 開啟（免費 IndexNow，加速 Bing 收錄；ChatGPT 搜尋用 Bing 索引）。
- **AI → Markdown for Agents**（beta）開啟：AI 代理帶 `Accept: text/markdown` 時直接拿到乾淨 Markdown。
- **AI Index**（beta）開啟：Cloudflare 自動產生的 llms.txt 與搜尋 API。若啟用，本 Worker 的 `/llms.txt` 會優先回應，兩者內容方向一致，不衝突。

## Worker 行為摘要（subdir 模式）

- `www.*` → 301 到非 www。
- `/ask`、`/ask/*`、`/llms.txt` → 靜態資產。
- `/robots.txt` → 原站內容 + 追加 sitemap。
- 其他 → 原封不動轉給 WordPress；`/wp-admin`、`/wp-json`、非 GET 一律不處理。
- 任何例外 → 直接透傳原站，Worker 出錯不會讓官網掛掉。

## 免費方案配額

Workers 免費方案每日 100,000 次請求、每次 10 ms CPU。subdir 模式下每個官網頁面請求都會經過 Worker，一般中小型網站綽綽有餘；若 Cloudflare 分析顯示每日請求接近上限，把 `env.subdir.routes` 縮成 `rsg.com.tw/ask*`、`rsg.com.tw/llms.txt`、`rsg.com.tw/robots.txt`、`www.rsg.com.tw/*`，並放棄 schema 注入即可。
