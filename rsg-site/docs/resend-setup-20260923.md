# RSG Resend 寄信設定進度

2026-09-23。以下為登入後的實際觀察，不是公開方案推測。

## 已完成

- Team：`zell.huang`；Transactional 與 Team 方案皆為 Free。
- 原有網域 `pt-bethany.org.tw` 狀態為 Verified，未變更。
- 已新增 `notify.rsg.com.tw`，區域 Tokyo；Resend 網域 ID：`69fd842c-b05a-4ee6-bf7f-4450bc2610ad`。
- Usage 顯示網域 `2 / 3`、每日 `0 / 100`、每月 `0 / 3,000`（當下快照）；Transactional 額外付費開關為關閉且不可用。
- Webhooks 顯示 `No webhooks yet`。未新增 webhook，須等 RSG 接收端完成再接。
- 主收件與 Reply-To 已獲使用者確認：`Garden@rsg.com.tw`。
- 已在 Resend 網域頁確認 `notify.rsg.com.tw` 狀態為 Verified，頁面顯示「Your domain is ready to send emails」，Domain verified 時間為 2026-09-23 12:12 PM（當前介面顯示）。這只代表寄信網域通過驗證，不代表報名程式或收件測試已完成。

## 已加入 Cloudflare 的 DNS

記錄值直接抄自新網域的 Resend Manual setup 畫面。下列名稱相對於 `rsg.com.tw` zone，TTL 為 Auto；兩筆 CNAME 必須 DNS Only。

| 類型 | 名稱 | 內容 |
|---|---|---|
| TXT | `resend._domainkey.notify` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDS7H+HhYfPMchtWlLB3TAnCL4PBBb4bQNYxem6aDTcczTMuWVGc1ooicP0iMeeiThRADrF9mG/9IJaR6OJHvBgPfw4SxBkb53Hcjbr/ye7rC/rjx9hXxzAI/sj4RHronX7UnbfbASK0FNDN63T+l28hIlkinhPJkj0O3fmPAxHIwIDAQAB` |
| CNAME | `rsend.notify` | `rsend-apne1.forge.rmta.net` |
| CNAME | `send.notify` | `send.forge.rmta.net` |

TXT 是公開 DKIM 公鑰，不是 API Key。此次 Resend 產生的是兩筆 CNAME 方案，不能沿用舊文章中的固定 Amazon SES MX／SPF 範本。

Enable Sending 為開啟，Enable Receiving 為關閉；保留主網域現有 Cloudflare Email Routing MX，不把 `Garden@` 收信移到 Resend。

使用者登入並授權後，已在 Cloudflare `rsg.com.tw` zone 新增上述三筆記錄；兩筆 CNAME 均確認為「僅 DNS」。公開解析器 `1.1.1.1` 已查到 TXT 與兩筆正確 CNAME 目標。原有 13 筆記錄保留，新增後為 16 筆；原網站 A、MX、根網域 SPF／DMARC 均未修改。

## 尚未完成

1. RSG 專用 `rsg-registration` API Key 已建立（Sending access 且限制 `notify.rsg.com.tw`），並安全保存至 Git 忽略的本機 `.dev.vars`；尚未存入正式 Workers Secret。
2. 第一個課程的本地報名 API、D1 與共用表單已完成，15 項自動測試通過。2026-09-23 13:10 真實試寄至 `zell.huang@gmail.com` 與 `Garden@rsg.com.tw`，Resend 皆為 Delivered。尚未建立正式 D1 或部署報名功能。詳見 registration-pilot-20260923.md。

已驗證 From：`關係花園｜課程報名 <registration@notify.rsg.com.tw>`；Reply-To：`Garden@rsg.com.tw`。試寄後本地預覽恢復 local 模式，不會繼續發信。
