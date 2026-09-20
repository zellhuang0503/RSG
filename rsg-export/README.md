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

## 過渡方案：靜態快照先上線

重建需要幾週，期間舊 WordPress 帶著無法修補的漏洞。與其花錢買授權，不如把現站抓成純 HTML 快照先上線，舊站立即下線，攻擊面歸零。

### 第一步：抓快照

```bash
bash mirror_site.sh          # 輸出到 mirror/rsg.com.tw/
```

抓完先在本機打開 `mirror/rsg.com.tw/index.html` 檢查首頁、幾個課程頁、文章頁。

### 第二步：修三個靜態站做不到的地方

| 功能 | 靜態版處理 |
|---|---|
| 聯絡表單 | 暫時改成 `mailto:` 連結，或改接免費表單服務（Web3Forms、Formspree 免費額度都夠） |
| 活動行事曆 | 只保留已抓到的活動頁；月曆切換拿掉，或改嵌 Google 日曆 |
| 會員登入 | 選單連結改指向 `https://shop.rsg.com.tw/wp-login.php` |
| 站內搜尋 | 暫時拿掉搜尋框 |

### 第三步：部署到 Cloudflare Pages（免費）

1. Cloudflare 儀表板 → Workers & Pages → Create → Pages → **Upload assets**（直接上傳，不用接 Git）。
2. 專案名稱 `rsg-static`，把 `mirror/rsg.com.tw/` 整個資料夾拖進去，Deploy。
3. 部署完會有一個 `rsg-static.pages.dev` 預覽網址，全站點一遍。
4. 專案 → Custom domains → 加入 `rsg.com.tw` 與 `www.rsg.com.tw`。Cloudflare 會提示要把 DNS 的 A 記錄換成 CNAME 指向 Pages，按確認即可。`shop` 與 `cards` 兩個子網域不動。
5. 在 `mirror/rsg.com.tw/` 根目錄放一個 `_redirects` 檔，內容至少兩行，讓 www 與 `/about` 維持轉址：

```
https://www.rsg.com.tw/*  https://rsg.com.tw/:splat  301
/about                    /about-2                   301
```

6. DNS 切換後，`curl -I https://rsg.com.tw/` 應看到 `server: cloudflare`，沒有 `x-powered-by: PHP`。舊 WordPress 從此對外不可達。

### 之後

正式重建的靜態站完成後，同一個 Pages 專案改接 GitHub repo 自動部署，網址不變，直接取代快照。
