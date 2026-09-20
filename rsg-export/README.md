# rsg-export：關係花園官網內容匯出

主站將以程式碼重建（靜態站，商店 shop.rsg.com.tw 維持原樣），第一步是把現有 WordPress 內容完整抓下來。本工具只用公開 REST API，不需要後台帳號、不動主機任何檔案。

## 使用

```bash
cd rsg-export
pip install requests markdownify
python export_wp.py
```

大約 500 篇文章、30 個頁面、活動與幾百張圖片，依 Wordfence 速率限制，預估 15 到 30 分鐘。

事前建議：WordPress 後台 → Wordfence → 所有防火牆選項 → 允許清單，把自己的對外 IP 加進去，避免被速率限制打斷。

## 輸出

| 路徑 | 內容 |
|---|---|
| `out/pages/*.md` | 頁面，front matter 含原始網址、日期、精選圖 |
| `out/posts/*.md` | 文章，含分類與標籤 |
| `out/events/*.md` | 活動，含起迄時間、地點、費用 |
| `out/media/` | 圖片與附件，維持 `wp-content/uploads/` 之後的路徑 |
| `out/raw/` | REST API 原始 JSON 與 HTML，轉檔不滿意可離線重跑 |
| `out/urls.csv` | **301 對照表底稿**：每個原始網址一列，`new_path` 預設等於原路徑，改網址時在這裡填新路徑 |
| `out/taxonomy.json` | 分類、標籤 |
| `out/report.json` | 統計與錯誤 |

`out/` 不進版控（已在根目錄 `.gitignore` 排除）。

## 重建原則（給後續設計用）

1. **網址一個都不變**：`archives/6311` 這類路徑已被 Google 與 AI 引擎收錄，新站維持同路徑；真的要改，`urls.csv` 的 `new_path` 填新值，部署時自動產生 301。
2. 內文裡的圖片網址已改寫成 `/media/...`，新站把 `out/media/` 原樣放到網站根目錄的 `media/` 即可。
3. Avada 短代碼在匯出時已由 WordPress 渲染成 HTML，Markdown 版是從渲染結果轉的；版面複雜的頁面請對照 `out/raw/pages/<id>.html` 重排。
4. 活動行事曆、聯絡表單、搜尋是三個需要另外實作的動態功能，其餘都是靜態內容。
