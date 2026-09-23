# Flora 聊天機器人：新站遷移待辦

日期：2026-09-23。狀態：已依使用者提供的公開嵌入碼完成新站整合；保留既有 Hetzner / Dify 後端。

## 已確認資訊

- 使用者確認 `flora.rsg.com.tw` 是 Flora 智能聊天機器人，目前部署在 Hetzner，正透過舊版 WordPress 網站提供服務。
- 使用者口述平台為「Define.ai」；先前 Cloudflare DNS 備註為 `Dify-Flora on Hetzner`，因此暫記為 Dify，實際版本與部署方式仍待檢查。
- 新網站上線時必須接續提供 Flora，不能在停用 WordPress 時遺漏此功能。
- 初次盤點時只記錄需求。後續使用者提供公開嵌入碼，已新增網站共用元件；未變更 DNS、Hetzner、機器人設定或知識庫。

## 新站整合與驗證

- `src/components/FloraChat.astro` 由 `Base.astro` 載入，全站共用官方 `embed.min.js`。腳本與聊天來源皆使用 `https://flora.rsg.com.tw`，避免 HTTPS 頁面混合內容。
- 沿用使用者提供的公開應用 token；它不是後端 API key。未提供或植入登入帳號、API key、使用者姓名或識別碼。
- 聊天按鈕使用原站保存的 Flora 圓形頭像、24rem × 40rem 視窗；按鈕置於回頂端上方，視窗固定於可視範圍，窄螢幕與低高度限制最大尺寸。補上按鈕名稱、鍵盤 Enter／空白開關與焦點外框，Escape 沿用 Dify 關閉行為。
- 本機建置通過。390px 版面未溢出，兩個浮動按鈕間隔 16px，鍵盤開啟／Escape 關閉通過。本機內建瀏覽器對遠端 iframe 回報 `net::ERR_BLOCKED_BY_CLIENT`；HTTPS 部署頁後續已確認可以正常顯示與對話。
- 公開聊天頁已實際送出一則網站串接測試並收到 Flora 回覆；課程連結為 `https://rsg.com.tw/latest-courses` 與 `/events`，新站保留相同路徑。預覽站階段這些連結仍指向原網域，正式域名切換後會落在新站。
- 首次測試曾看到未替換的選填姓名變數；最終線上回讀已呈現「Hi，您好，有什麼我可以協助的?」。本次未改寫 Dify 後端設定。

## 部署結果

- 網站程式提交：`9feeb03`，推送至 `codex/rsg-latest-courses`。
- Cloudflare Worker `rsg` 版本：`72130585-9822-4e1f-9bb0-cd30c9752e17`，網址 `https://rsg.cloundflare1.workers.dev`。部署頁 HTML 與本機建置逐字一致，回應 HTTP 200。
- 在部署頁的內嵌 Flora 送出「你好，這是新版網站內嵌測試，請簡短回覆確認已連線。」；收到「您好，連線確認沒問題！」及 Flora 服務介紹，確認非僅顯示空框。
- 桌面與實測 CSS 視窗寬 390px 的手機版均可顯示；手機聊天框左邊界約 16px、無橫向溢出、關閉按鈕可操作。保持原有 Dify 對話服務與跨頁對話延續。
- 原網域 `rsg.com.tw` 尚未切换；Flora 回覆中的原網域課程連結已核對新站對應路徑皆 HTTP 200。

## 原站 Flora 浮動圖示

- 依使用者要求，將預設藍色 Dify 圖示改為既有 `/media/2025/07/FLORA-1-1.png` 圓形頭像。原圖來源由 `content/urls.csv` 對照 WordPress `/wp-content/uploads/2025/07/FLORA-1-1.png`；使用已遷入本站的圖檔，不依賴 WordPress 持續供應圖片。
- 使用者回饋 48px 太小，因此桌面放大為 80px、手機為 72px，頭像填滿圓形按鈕；聊天框上移並依視窗高度限制尺寸，與按鈕保留 12px 間隔。Dify 開關邏輯不變，展開時切換白底深藍關閉符號，關閉後恢復 Flora 頭像。
- 依使用者要求加入 4 秒循環的輕微頭像縮放與水綠光暈，旁邊顯示「Flora 小幫手」。懸停／鍵盤聚焦時暫停動態；聊天開啟後隱藏光暈與提示、停止頭像動畫，避免干擾閱讀。`prefers-reduced-motion` 下維持靜態呈現。
- 本機建置、圖片顯示、點擊展開及 Escape 關閉後的圖示還原均已驗證。

## 聊天框展開／收合修正

- 原固定寬高的 `!important` 覆蓋 Dify 的展開尺寸，導致右上角按鈕變更狀態但畫面沒有變大。現在接收官方 `dify-chatbot-expand-change` 事件，核對 Flora origin 與 iframe 視窗後同步 `data-expanded`。
- 桌面一般寬 24rem，展開寬 40rem；手機一般高 32rem，展開使用剩餘可視高度。兩種模式都保留螢幕邊界、聊天按鈕間距及既有對話。
- 程式提交 `b9d76fa` 已部署，Worker 版本 `f2407d51-b46b-4417-ae36-7acdfafd22f7`。實際點擊 iframe 右上角按鈕，桌面宽度 384 → 640 → 384px，390px 手機高度 512 → 664 → 512px；對話保留且沒有橫向溢出。
- 品牌顯示仍由 Dify 後端控制；目前自架 1.13.3 的設定頁沒有品牌移除選項。使用者確認採自架方式，尚未提供品牌移除商業授權資訊，未改動品牌設定。官方授權對使用 Dify 前端的品牌移除有額外條件：<https://github.com/langgenius/dify/blob/main/LICENSE>；`remove_webapp_brand` 技術設定存在，不代表自架自動取得品牌移除授權。

## 後續整合順序

1. 盤點舊站實際嵌入方式、聊天入口樣式與使用頁面，確認 Dify 應用及既有服務設定。
2. 先評估保留 Hetzner 後端與 `flora.rsg.com.tw`，將聊天入口以全站共用元件接到 Cloudflare 新站。網站搬遷不等於必須同時搬遷聊天後端。
3. 檢查新站網域的嵌入限制、內容安全政策及手機呈現；測試開啟、對話與既有功能。不得將後端 API 金鑰放進前端。
4. 檢查機器人知識庫、回覆及工具是否仍依賴舊 WordPress 網址或報名表，逐一改接新站可用入口。
5. 新站驗收通過後才安排舊站下線。若要將 Dify 本體搬离 Hetzner，另行盤點資料、儲存與部署需求，再規劃搬遷。

完成標準：新站桌面與手機可使用 Flora，課程與報名連結正確，且停用 WordPress 不會中斷聊天服務。
