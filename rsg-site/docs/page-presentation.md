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

## 有左側目錄的課程說明頁

- 文章設定 `presentation.layout: course-detail`，由 `CoursePage.astro` 統一排列左側目錄、右侧內文與共用預約區。第一個範本為 `content/posts/一對一排列.md`（原站 `/archives/6968`，不同於無側欄的同名 `/arrangement-one-to-one`）。
- `CourseSidebar.astro` 直接取用 `site.nav` 的三組課程資料，避免每頁複製目錄；標示當前課程，手機可展開／收合，無 JavaScript 時保持可讀。
- 內容使用 `.course-section`、`.course-section-inner`、`.course-figure`、`.course-emphasis`；米黃底用 `.course-section--cream`，較窄的介紹用 `.course-section--intro`。標題自動使用綠字／金線，段落左右對齊。
- 每段沿用 `data-reveal="left"` 與全站 `RevealEffects`。圖片保留原始比例，依原站不加懸停縮放。預約沿用 `Appointment`，不複製文案和客服連結。
- 原站置中的段落使用 `.course-align-center`，左對齊使用 `.course-align-left`；主圖、圖示組、清單、日期表格、影片分別使用 `.course-banner-frame`、`.course-feature-grid`、`.course-checklist`、`.course-table`、`.course-video`。所有樣式集中在同一份 CSS。
- 團體課程設定 `appointment: false` 及 `registrationCourseId`，由 `NativeRegistration.astro` 提供本站期別表格與報名表。14 門課程共用 `registration.css`、`registration.ts` 和 Worker／D1；不再使用 `registrationUrl` 或 WordPress 表單。未排定未來場次時顯示籌備中；一對一排列保留 `Appointment` 預約模式。詳見 `registration-rollout-20260923.md`。

## 2026-09-22 課程頁套用與檢查

- 向內探索 10 頁：6968、2061、2059、6311、7053、5063、7160、7182、7529、7554。
- 向下扎根 4 頁：7493、6119、6610、7586；向上擴展 1 頁：6553。
- 先以 `/archives/6968` 比對原站，完成桌面／390px 手機版的段落、圖片、捲入動畫、預約與目錄驗證，再套用其餘 14 頁。各頁保留原站課程文案、圖像比例、日期與費用，未自行更新課程資訊。
- 其餘 14 頁從原站正文核對文字完整性、圖片、清單及表格；移除 WordPress 匯出表單殘留與重複的桌面／手機段落。所有本地圖片及內文文章連結均確認有對應檔案／建置頁面；14 個報名錨點均存在於原站 HTML，未送出報名資料或測試收件。
- 15 頁均完成桌面及 390px 手機版的目錄當前項目、版寬檢查，無整頁橫向溢出；手機目錄展開、收合及跨課程跳轉已實測，寬表格在各自容器內捲動。
- `npm run build` 通過：971 個路由，Pagefind 索引 969 頁。每個課程正文只有一個 h1，目錄包含行事曆及 15 個課程連結。
- 生命專車的 YouTube iframe 已保留（9HZdxCVudkg），但內建瀏覽器仍顯示空白，沒有將影片播放標記為通過；需在一般瀏覽器或部署後另驗播放。
- 主題整合系統排列（7182）原站的 `關係花園_課程-20251226.png` 回傳 404；舊匯出檔對到的 `關係花園_課程-20251226-2.jpg` 實際是生命專車海報，因此未沿用錯圖。正確主圖及正文保留，缺失配圖待原素材補回。
- 本輪為本地修改，尚未 commit、push 或部署。
