# 正式報名啟用與驗收（2026-09-23）

本文件記錄較早的 pilot / rollout 文件之後的實際部署結果。新站已啟用正式報名；rsg.com.tw 的主網域切換不在此次工作範圍內。

## 已部署

- 新站：https://rsg.cloundflare1.workers.dev
- Cloudflare Worker：rsg；帳戶 cloundflare1。
- 正式版本：78485233-4a7e-4b24-824e-6e9b5ac0ecc6；REGISTRATION_MODE=live。
- D1：rsg-registration，binding REGISTRATIONS_DB，ID 97aa3b85-9613-48ce-95c4-67492ad1933f；0001–0004 migration 已套用。
- Turnstile：managed widget，允許新站 workers.dev 與 rsg.com.tw；伺服器驗證 hostname 和 action。
- Worker secrets：RESEND_API_KEY、TURNSTILE_SECRET_KEY、RATE_LIMIT_SALT。值不存入本文件或 Git。
- 寄件者：關係花園｜課程報名 <registration@notify.rsg.com.tw>；回覆與課務通知：Garden@rsg.com.tw。
- Cron：每 2 分鐘處理待寄通知；送出申請時亦立即啟動寄信。

## 課程規則

課程日期表、行事曆、表單共用已公布場次。過期場次不呈現；不再使用另一個提前截止時間。完整課程最後一天（台灣日期）結束後關閉申請；明確取消、草稿、額滿或關閉的場次不開放。

企業外訓為使用者明確指定的例外：行事曆只顯示公告，不連結內容頁、不提供報名。保留既有封存內容檔案，沒有做刪除。

| 公開場次 | 日期 | 新站入口 |
|---|---|---|
| 意識能量工作坊第三期 | 2026/10/17–18 | /archives/7586#course-registration |
| 主題整合系統排列第五期（工作事業） | 2026/11/21–22 | /archives/7182#course-registration |
| 花園意識能量卡［I階］工作坊 | 2026/12/19–20 | /events/花園意識能量卡［i階］工作坊-4#course-registration |

十二月場次僅確認原站公開日期、名稱；費用顯示「待課務確認」、時間與地點由課務通知，不借用其他期別金額。未公布新日期的其餘課程仍顯示籌備中。

上線後 D1 是執行中的期別資料來源；新增／修改場次須透過 migration 更新 D1，並同步靜態種子資料及課程路徑。不是只修改 JSON 再部署就會覆寫既有 D1 場次。舊兩筆資料的 closesAt 欄位保留，但新程式已不採用。

## 實際驗收

- 29/29 registration + calendar 自動測試通過；Astro 與 Pagefind 建置成功。
- 15 個課程／活動路徑 HTTP 200，均只有一個報名容器；有公布日期的三個場次才有表單。
- 公開新站瀏覽器實際填表，Turnstile 自動通過，D1 保存測試申請 RSG-20260923-6086C954。
- 學員試寄 zell.huang@gmail.com：Resend ID 01a0cccf-b3a5-747a-b4f3-d4bfd8c1a31a，後台顯示 Delivered。
- 課務試寄 Garden@rsg.com.tw：Resend ID 01a0cccf-b550-72c8-a77b-0db4d6480e73，後台顯示 Delivered。
- 兩封各嘗試一次、無錯誤。Delivered 表示接收方郵件伺服器接受，不等同收件人已閱讀。
- 切換 live 後三個場次 API 均回傳 live；瀏覽器表單無試寄提示。
- live API 對缺少 Turnstile token 的合成請求回覆 422；未建立報名或寄信。
- D1 最後核對：只有一筆 mode=test，兩筆通知 accepted；沒有建立假正式報名。
- 十一月行事曆瀏覽器驗證：企業外訓可見，相關連結數量為 0。

## 營運與後續

申請資料與兩筆待寄通知先一起存入 D1，再送信；學員信只是收件確認，名額與付款由課務確認。寄信遇到暫時錯誤可重試，超過次數／時限或永久錯誤改為 review，需人工核對。自動測試已覆蓋此流程，未故意中斷正式寄信服務。

目前沒有課務管理後台，也沒有 Resend 送達 webhook；D1 的 accepted 僅表示寄信服務接受，實際送達可查 Resend。初期課務以通知信作業，日後可再做管理介面與退信處理。

本次先直接部署並完成驗收，再依使用者指示提交與推送；提交紀錄以 Git 為準。分支 codex/rsg-latest-courses；後續 Git 建置應包含本次設定與程式，避免舊設定覆蓋正式環境。
