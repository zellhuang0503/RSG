# 新站報名第一版：意識能量工作坊

## 範圍與現況

- 試作課程：`/archives/7586`，第三期，2026-10-17、18，關係花園，NT$18,800。來源為原站同頁（2026-09-23 核對）。上課時段原頁未載明，顯示由課務通知。
- 完成共用期別表、內嵌表單、錯誤提示、申請編號與成功畫面。原有課程文案、側欄、導航不重做。
- D1 場次表為動態畫面和送出驗證的同一來源；原 JSON 用於首次種子資料及未啟用時的靜態 fallback，不覆寫已修改的 D1 場次。
- Worker 為課程頁與行事曆注入最新期別；行事曆只替換已對應的第三期舊活動，保留其他活動。
- 先保存申請與兩筆通知工作，再回傳成功。通知失敗仍保留申請；目前只寄「收到申請」，不承諾名額、不收款、不自動確認付款。
- 本文件記錄首個課程試作。2026-09-23 後續已套用全部 14 門團體課程，移除另外 13 個舊站入口；詳見 `registration-rollout-20260923.md`。正式基礎設施與管理功能仍未上線。

## 本地預覽

在 `rsg-site` 執行：

```powershell
npm run build
npm run registration:migrate:local
npm run registration:preview
```

開啟 `http://127.0.0.1:4324/archives/7586#course-registration`。4323 的 Astro 靜態預覽沒有 Worker／D1，不能用來驗收表單提交。local 模式只保存本機測試資料，通知狀態為 simulated，不發信。

密鑰經使用者明確同意後，可執行 `node scripts/setup-registration-key.mjs`，使用一次性的 `127.0.0.1:4325` 設定頁保存。密鑰只寫入忽略 Git 的 `.dev.vars`，腳本不印出密鑰、拒絕覆寫既有檔案。`.dev.vars` 含試寄模式與固定收件者；不複製到前端、文件或 Git。試寄完成後預覽應恢復 local 模式，以免每次測試都發信。

## 測試

`npm run test:registration` 以 Miniflare 真實 D1 模擬器執行隔離測試。涵蓋欄位驗證、保存／通知原子交易、並行重複送出、同 Email 重複申請、場次狀態／台北截止時間、來源驗證／公開環境禁用 local、人機驗證失敗、頻率限制、寄信逾時重試、並行通知鎖、測試收件者隔離、HTML 跳脫與場次異動競爭。

- 2026-09-23：15 項通過；Astro／Pagefind build 通過；正式設定 `wrangler deploy --dry-run` 通過，沒有實際部署。
- 瀏覽器本地填表已確認：必填提示、無效電話提示、保留姓名／Email、成功保存並顯示申請編號。
- 手機窄螢幕確認單欄、無水平溢出；內建瀏覽器截圖縮放不穩定，另以 Chrome 窄螢幕檢查版面並實際送出成功。桌面與手機測試各留下一筆 local 申請與兩筆 simulated 通知，沒有發信。
- 2026-09-23 13:10（台灣時間）真實試寄完成：瀏覽器送出申請 `RSG-20260923-EB1E9635`，local D1 的 student／office 通知均首次寄送即 accepted；Resend 兩封皆顯示 Delivered。收件人為 `zell.huang@gmail.com`、`Garden@rsg.com.tw`，主旨均有【測試】。Delivered 不等於已讀或進入主要收件匣。

## 正式啟用前

1. 建立正式 RSG D1，將真實 database_id 加入正式設定，套用 migrations；不可使用 local 的示範 ID。
2. 核對實際名額、截止日與課程時間。目前截止日採上課日台北時間 00:00，屬保守預設，須由課務定案。
3. 設定 Turnstile 正式 site/secret、RSG 專用 Resend Sending access key、隨機 RATE_LIMIT_SALT、正式 origin 白名單；密鑰存 Workers Secrets。public test/live 均需人機驗證，API 無金鑰或 DB 時拒絕接受報名。
4. 正式設定加入 D1 綁定與通知重試排程；試寄環境與正式 D1 分離。沒有排程就只能即時嘗試，不能保證背景重試。
5. 完成課務查看名單與待處理通知的受保護介面，再開放正式申請。此次尚未建管理後台、付款回報、正式確認信或退信 webhook。
6. 完成真實收信／Reply-To 驗證及桌面手機驗收，才將 REGISTRATION_MODE 由 disabled 改成 live 並部署。此次未 commit、push 或部署。

使用者已建立 `rsg-registration`（Sending access、限定 `notify.rsg.com.tw`；Key ID `bae9fa74-28fe-4244-ae13-71aa199cda1f`），並於 2026-09-23 13:09 透過本機設定頁保存至 Git 忽略的 `.dev.vars`。設定頁的 Referrer-Policy 已由 no-referrer 修正為 same-origin，保留 Host／Origin／CSRF 驗證；有效時間 60 分鐘，保存後關閉。真實試寄完成後，`.dev.vars` 的 REGISTRATION_MODE 已恢復 local 並重啟預覽，繼續填表不會寄信。正式 Worker Secret 尚未設定，未部署。

Resend 試寄證據：student `01a0ccac-8fd0-74fb-9f36-50a16e16c57e`；office `01a0ccac-9110-77c1-a87e-fc99ce6cd610`。學員信詳細頁確認 From 為 `registration@notify.rsg.com.tw`、Reply-To 為 `Garden@rsg.com.tw`，包含正確期別／日期／費用與「非正式報名」標示。尚未由收件人實際回信驗證 Reply-To 的收信路徑。

通知採固定內容與 Resend Idempotency-Key，遇到失敗最多重試 7 次；第一次寄送超過 23 小時的未知結果停止自動寄送並標 review，避免超出 Resend 24 小時去重期限後重複寄信。管理介面需能核對 review、查看通知狀態。申請編號不可當作查詢個資的憑證，本版沒有公開名單查詢 API。

參考：[Resend 去重鍵](https://resend.com/docs/dashboard/emails/idempotency-keys)、[Cloudflare Worker 與靜態資產路由](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[Turnstile 伺服器驗證](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)。
