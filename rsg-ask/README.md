# rsg-ask：關係花園 學習指南（子目錄問答站）

不動 WordPress 官網任何一個字，在 `rsg.com.tw/ask/`（或備案 `ask.rsg.com.tw`）建立一組「答案優先」的問答頁，讓 Google AI 摘要、ChatGPT、Perplexity 等引擎有可以引用的官方來源。

## 目錄

```
rsg-ask/
├── site.config.json   機構實體資料（Organization / 講師 / sameAs），Worker 與建置共用
├── build.js           零相依套件的靜態站產生器
├── content/*.md       每題一檔（front matter + 內文）
└── dist/              建置輸出（不進版控）
```

## 建置

```bash
node build.js            # 只輸出 status: approved 的頁面（正式）
node build.js --drafts   # 連 draft / review 一起輸出（預覽；未定稿頁自動 noindex、不進 sitemap）
```

輸出：`dist/ask/index.html`、`dist/ask/<slug>/index.html`、`dist/ask/<slug>.md`、`dist/ask/sitemap.xml`、`dist/llms.txt`。

## 內容檔格式

```markdown
---
title: 系統排列是什麼？              # 頁面標題，就是使用者會問的問題
slug: what-is-family-constellation  # 小寫英數與連字號；決定網址
category: definition                # brand / course / definition / choice
status: review                      # draft → review → approved（只有 approved 會正式上線）
updated: 2026-09-20
summary: 一句話直接回答（60 到 120 字），會放在頁首答案框與 FAQPage schema
faq:                                # 延伸問題，每題都會進 FAQPage schema
  - q: 問題
    a: 答案
sources:                            # 資料來源，會顯示在頁尾
  - [來源名稱](https://...)
related:                            # 相關問題的 slug
  - who-is-it-for
---
## 內文用 Markdown 子集
支援：## / ### 標題、段落、- 清單、1. 清單、> 引言、**粗體**、[連結](url)
```

## 審稿流程（給業主）

業主對文字非常講究，所以流程設計成「審事實與引用」而不是「審文采」：

1. **一次審一批**：每批 5 到 10 題，用 `node build.js --drafts` 產出預覽後給業主看網頁，不是看 Markdown。
2. **三種內容、三種審法**
   - 引用原文型（標示「引用官網」）：只審「引得對不對、出處對不對」。
   - 事實型（費用、地點、報名、講師經歷）：只審「正不正確」。內容裡的 `【待業主確認】` 就是要業主填的空格。
   - 定義型（系統排列、內在小孩、覺知）：以一般性知識說明撰寫、附學術或書籍來源，不模仿講師口吻。業主若不滿意可整段刪除，不逐字修。
3. **業主回覆方式**：直接在預覽頁截圖圈選，或回覆「第 N 題：OK / 刪除 / 改成 ___」。梵亞改完把 `status` 改成 `approved`。
4. **紅線**：不改寫官網任何既有文字；學員心得逐字引用並標明出處；不做醫療宣稱。

## 內容規劃（第一批 21 題）

| 類別 | 題數 | 說明 |
|---|---|---|
| brand 關於關係花園 | 6 | 機構、講師、地點、費用、報名、評價。大量 `【待業主確認】`，是 AI 判斷實體的核心 |
| course 課程介紹 | 5 | 生命專車、靜心手作、意識覺醒、課程音檔、體驗會 |
| definition 觀念解說 | 6 | 系統排列、排列過程、內在小孩、覺知、靜心、意識覺醒 |
| choice 如何選擇 | 4 | 適合誰、一對一 vs 工作坊、從哪開始、需要準備什麼 |

第二批建議方向：每個工作坊一頁「這門課在解決什麼問題」、講師個人頁擴充、地區型問題（台北 / 台中 系統排列 課程）。
