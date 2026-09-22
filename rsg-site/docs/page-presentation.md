# 原站頁面還原的共用規則

- 每頁只維護 Markdown 文案、圖片與 `presentation` 設定，不建立逐頁 CSS 或 JavaScript。
- 置中服務頁使用 `presentation.layout: centered-service`。`hero` 指定原媒體庫的 src、alt、width、height，`appointment: true` 加入共用預約區塊。
- `ServicePage.astro` 負責全寬主圖及內容結構；`Appointment.astro` 集中維護預約文字、時間、客服連結和圖片，必要時以 props 傳入差異。
- 內容段落使用 `.service-section`，其中 h1/h2 自動置中、套用綠色字與黃色分隔線。`.service-subtitle` 和 `.service-checklist` 為共用副標與核取清單。
- 所有顏色、寬度、留白、手機版規則放在 `src/styles/presentation.css`，不要加入網址或特定頁面 slug 選擇器。
- 任意區塊加 `data-reveal="left"` 可套用原站的捲入淡入效果（20px、1 秒、每次造訪一次）；也支援 `up` 及預設淡入。`Base.astro` 統一載入 `RevealEffects.astro`，不要複製 observer 到每頁。
- 動態尊重 reduced-motion，鍵盤聚焦立即顯示內容；無 JavaScript 和列印時仍可閱讀。
- 實測原站一對一催眠的三段為 fadeInLeft / 1.0 秒。預約圖片為 hover-type-none，故不額外加懸停放大。其他頁面的懸停互動應先查原站，再抽成共用樣式。

參考範本：`content/pages/one-on-one-hypnosis.md`。
