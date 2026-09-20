# 關係花園 rsg.com.tw GEO / AEO 執行方案

> 目標：在**不修改官網任何既有內容**的前提下，讓 rsg.com.tw 成為 AI 搜尋引擎（Google AI 摘要、ChatGPT、Perplexity、Gemini）回答「關係花園」與「系統排列、內在小孩、覺知」相關問題時的引用來源。
>
> 方案：B（子目錄問答站）＋ C（邊緣層不可見的結構化資料）＋ D（站外實體建設）。A（獨立子網域）為備案。
>
> 版本：2026-09-20 v1 ｜ 梵亞行銷

## 1. 現況（2026-09-20 從搜尋索引與 Cloudflare 後台觀察）

| 項目 | 現況 | 影響 |
|---|---|---|
| Cloudflare Proxy | 主站與 www、shop 皆為灰色雲（僅 DNS） | Cloudflare 任何邊緣功能對主站不生效；也代表 Cloudflare 沒有擋 AI 爬蟲 |
| 灰雲原因 | 管理員回報過去橘雲時外掛功能受限 | 需釐清是哪些功能，多數可用設定解決（見 rsg-edge/README.md） |
| www / 非 www | 兩個版本都被索引 | 權重分散，AI 引用來源不一致 |
| 網址結構 | `/archives/數字`、`/events/中文` | 不影響 AI 讀取，暫不處理 |
| 結構化資料 | 未確認 | 需診斷（見 §4） |
| FAQ 型內容 | 無 | 最大缺口，由子目錄站補 |
| 實體資訊 | 「關於花園」頁完整但未結構化 | 由 site.config.json 集中管理並輸出 Organization / Person schema |
| 站外 | Facebook 粉絲團、shop 子網域、舊 Yahoo 目錄 | 需對齊名稱、地址、電話，並補 Google 商家檔案 |

## 2. 架構

```
使用者 / AI 爬蟲
      │
      ▼
Cloudflare 邊緣（Worker：rsg-edge）
      ├── /ask/*、/llms.txt ─────────▶ 靜態問答站（rsg-ask/dist，由本 repo 建置）
      ├── /robots.txt ──────────────▶ WordPress 原內容 + 追加 sitemap
      ├── www.* ────────────────────▶ 301 到 rsg.com.tw
      └── 其他 ─────────────────────▶ WordPress（原封不動；可選：head 加 Organization JSON-LD）
```

- **內容**：`rsg-ask/content/*.md`，每題一檔，狀態 draft → review → approved。只有 approved 上線。
- **實體資料**：`rsg-ask/site.config.json` 一份，Worker 與問答站共用。
- **部署**：`rsg-edge/`，`npm run deploy:subdir`（模式一）或 `npm run deploy:subdomain`（模式二）。

## 3. 橘色雲 vs 灰色雲的決策

管理員當年改灰雲的理由「外掛功能受限」，九成是以下其中之一，而且**每一項都可以在 Cloudflare 關掉、不用放棄 Proxy**：

| 症狀 | 元兇 | 解法 |
|---|---|---|
| 滑塊、表單、Elementor 動畫壞掉 | Rocket Loader | 關閉 |
| 版面跑掉 | Auto Minify | 關閉 |
| 表單收不到、頁面 email 變亂碼 | Email Obfuscation | 關閉 |
| 金流回呼失敗、REST API 403 | Bot Fight Mode / Browser Integrity Check | 關閉 |
| 安全外掛把所有人封鎖、登入被鎖 | 訪客 IP 變成 Cloudflare IP | 裝官方 Cloudflare 外掛還原真實 IP |
| 無限轉址 | SSL 模式 Flexible | 改 Full (strict) |
| 後台看到舊內容 | 快取到登入頁 | Cache Rule 略過 wp-admin 與登入 cookie |
| 大檔上傳失敗 | 免費方案 100 MB 單次上傳上限 | 改用 FTP 或分割 |
| 長時間匯入逾時（524） | 免費方案 100 秒逾時 | 匯入時暫時切灰雲 |

**建議決策流程**

1. 先用模式二把 `ask.rsg.com.tw` 上線，內容審稿與 AI 引用測試不必等主站。
2. 同時向管理員取得 §4 的資訊，確認當年的具體症狀。
3. 若症狀都在上表，選一個離峰時段依 rsg-edge/README.md「WordPress 安全開法」設定後切橘雲，驗證 30 分鐘，有問題即切回。
4. 主站橘雲穩定一週後，把問答站改部署為模式一（`/ask/`），並在 ask.rsg.com.tw 設 301 到對應路徑。

## 4. 需要向 WordPress 管理員取得的資訊

| 資訊 | 怎麼取得 | 用途 |
|---|---|---|
| 完整外掛清單（含版本、是否啟用） | 後台 → 工具 → 網站健康狀態 → 資訊 → 「複製網站資訊到剪貼簿」 | 判斷哪些外掛與 Cloudflare 衝突；同時看到主題、PHP、伺服器 |
| 快取外掛 | 同上（WP Rocket / LiteSpeed Cache / W3TC / WP Super Cache） | 決定 Cloudflare 端快取規則，避免雙重快取 |
| 安全外掛 | 同上（Wordfence / iThemes / All In One WP Security） | 決定是否需要還原真實 IP |
| SEO 外掛與其 schema 設定 | 同上 + 後台 SEO 外掛「網站基本資料」頁截圖 | 決定 Organization schema 由外掛或 Worker 輸出 |
| 是否有 WooCommerce | 同上 | shop 子網域是否也在同一個 WordPress |
| 當年切灰雲的具體症狀 | 直接問管理員 | 對照 §3 表格 |
| 固定網址設定 | 後台 → 設定 → 固定網址 截圖 | 確認 `/ask/` 路徑沒有被 WordPress 占用 |

貼「網站健康狀態」資訊前，請刪掉其中的資料庫名稱、使用者與伺服器路徑。

## 5. 路線 D：站外實體建設清單

| 項目 | 動作 | 為什麼 |
|---|---|---|
| Google 商家檔案 | 建立或認領，名稱「關係花園 Relationship Garden」，類別「生活教練 / 教育中心」，地址電話與官網一致 | Google AI 摘要與 Gemini 的地區型回答直接取用 |
| Facebook 粉絲團「關於」 | 簡介改寫成與 site.config.json 的 description 一致，加上成立年份與官網連結 | AI 交叉驗證實體 |
| shop.rsg.com.tw | 頁尾或關於頁加回主站連結與相同機構描述 | 同上 |
| YouTube 頻道（若有） | 頻道說明加官網連結；影片說明欄加對應問答頁連結 | YouTube 已是 AI 摘要最常引用的網域 |
| Wikidata | 建立「關係花園」項目：成立 2005、創辦人、官網、國家 | 免費且 AI 引擎高度信任的實體來源 |
| 舊 Yahoo 目錄 | 更新或申請移除 | 清除不一致資訊 |
| 合作單位 | 請馬來西亞智慧花園等單位在其網站介紹頁加連結 | 外部連結與實體佐證 |
| 講師個人 | 兩位講師若有個人 Facebook、著作、受訪報導，集中列在 site.config.json 的 founders.sameAs（待補欄位） | Person 實體權威 |

## 6. 成效衡量

| 指標 | 工具 | 頻率 |
|---|---|---|
| AI 推薦流量 | GA4 自訂管道：來源含 chatgpt.com、perplexity.ai、copilot.microsoft.com、gemini.google.com | 每月 |
| AI 爬蟲造訪 | Cloudflare AI Crawl Control（需橘雲） | 每週 |
| 被引用情形 | 固定 10 個問題，每月在 ChatGPT、Perplexity、Google AI 摘要各問一次，記錄是否提及與引用哪一頁 | 每月 |
| 索引狀態 | Search Console：`/ask/` 頁面收錄數、精選摘要曝光 | 每週 |
| 轉化 | 問答頁 → 官網活動頁 → 報名的點擊路徑（GA4 事件） | 每月 |

固定 10 題建議：系統排列是什麼、系統排列適合誰、台灣哪裡可以上系統排列課程、關係花園是什麼、關係花園講師、關係花園評價、關係花園課程費用、內在小孩工作坊推薦、伴侶關係課程推薦、意識覺醒工作坊。

## 7. 時程

| 週 | 工作 | 產出 |
|---|---|---|
| 1 | 取得 §4 資訊；業主審第一批 10 題；模式二上線 | ask.rsg.com.tw 可訪問，Search Console 提交 |
| 2 | 業主審第二批 11 題；站外實體清單前四項 | Google 商家檔案、Facebook 對齊 |
| 3 | 主站橘雲測試（若 §4 資訊允許） | 主站走 Proxy，AI Crawl Control 開啟 |
| 4 | 切換為模式一 `/ask/`；schema 注入決策 | www 統一、robots 補 sitemap、llms.txt 上線 |
| 5 至 12 | 每兩週新增 5 到 8 題；每月引用測試 | 累積 50 題以上 |

## 8. 附帶事項：DMARC

Cloudflare 提示的 DMARC 與 GEO 無關，但影響 @rsg.com.tw 寄信是否被判為垃圾郵件。建議順序：

1. 先盤點所有會用 @rsg.com.tw 寄信的來源：Google Workspace 或其他信箱、WordPress 主機本身（表單通知）、電子報工具。
2. SPF 記錄必須把這些來源全部 include，結尾用 `~all`。目前 SPF 旁有警告符號，很可能就是少了主機或信箱的 include。
3. 每個寄信來源都要設 DKIM。
4. 再加 DMARC，**從 `p=none` 開始**並填回報信箱：`v=DMARC1; p=none; rua=mailto:dmarc@rsg.com.tw`，觀察二到四週報告。
5. 確認所有合法來源都通過後，再升到 `p=quarantine`，最後 `p=reject`。直接設 reject 會讓漏列的來源（最常見是 WordPress 表單通知）整批被退。
