# Flora / Hetzner 唯讀診斷紀錄

> 後續狀態：使用者已於同日授權修復，18:07 完成。以下保留修復前診斷；目前結果與回復方式請見 [修復執行紀錄](Flora_修復執行紀錄_20260924.md)。

日期：2026-09-24；檢查約 17:14–17:43，Asia/Taipei。

## 結論與可信度

1. **已確認主機存在資源累積異常。** Dify worker 對應的 Docker 容器管理程序（containerd-shim）占用約 2.10 GiB RAM、1.00 GiB swap，開啟約 13.7 萬個檔案描述符，主要為 pipe；其他容器同類管理程序只有約 21–30 個描述符、6–25 MiB RAM。這是需要處理的異常，不能靠單純加大主機掩蓋。
2. **今天打不開網頁，更直接的線索是經 Cloudflare 的連線路徑間歇性逾時。** 同一台 Windows 對同一 `/apps` 頁面，直連 Hetzner 約 1.8 秒，經 Cloudflare 約 8–12 秒或 15–25 秒逾時；從 Hetzner 本機測試該公開網址約 0.42 秒。這將問題範圍縮小到依來源／入口而異的代理連線路徑，尚不能定案為 Cloudflare 平台、ISP 路由、用戶端代理或 Cloudflare 到 origin 的哪一段故障。
3. **沒有查到今天新發生 OOM 的證據。** 主控台四次記憶體耗盡事件均在 7–8 月，不能用來證明今天故障。短採樣仍有 1.8 GiB available RAM，沒有觀察到大量 swap 進出。

不能把資源累積、worker unhealthy 和本次瀏覽器打不開直接串成已證實的單一因果鏈。目前未修復或宣稱恢復穩定。

## 故障情境與環境

- 使用者約 16:20 發現無法開啟 Flora／知識庫管理介面；時間為口述估計，日誌檢查涵蓋 15:30–17:30。
- 前兩天輕量使用尚正常；「打算確認知識庫時發現連不進去」不表示曾開始上傳或重建索引。
- Hetzner RSG-Flora，CX33，4 vCPU、8 GB RAM、40 GB 磁碟，Helsinki；IP 157.180.85.189。
- Ubuntu 24.04.4 LTS；Dify 1.13.3；Docker 29.3.1、containerd 2.2.2、runc 1.3.4。
- 主機自 2026-05-30 02:38:41 UTC 開機，已運作 117 天。
- Cloudflare 後台確認 flora 為單一 A 記錄，指向上述 IP 並啟用代理；SSL/TLS 模式為 Flexible，介面顯示 172 天前設定。直接 origin HTTPS 連線失敗不能據此認定目前代理設定錯誤，因 Flexible 的 origin 路徑為 HTTP。

## 主機資源證據

| 項目 | 採樣結果 | 判讀 |
|---|---|---|
| RAM | 總量 7.6 GiB、used 5.8 GiB、available 1.8 GiB | 非採樣當下完全耗盡 |
| swap | 2 GiB 幾乎全滿 | 有歷史記憶體壓力，不能單獨證明即時卡頓 |
| vmstat | 5 秒取樣 si/so 均為 0 | 未在該短窗口看到大量換頁 |
| memory PSI | avg10=0.00，avg60=0.02 | 當下等待記憶體壓力低 |
| 磁碟 | 約 24/38 GiB，67%，餘 12 GiB | 未滿 |
| inode | 19% | 未滿 |
| worker shim PID 124465 | RSS 約 2.10 GiB、swap 約 1.00 GiB | 明顯偏高；PSS/private anonymous 確認是真實程序占用 |
| worker shim 開啟描述符 | 17:37 約 136,745 個，其中 pipe 136,724；17:39:46 為 136,761 個 | 明確資源累積；短時間仍增加，但尚未定位洩漏程式碼 |
| 其他 shim | 多為 21–30 個描述符、6–25 MiB RSS | worker 的異常對照 |

PID 124465 對應 `docker-worker-1`，於 2026-08-23 06:48:27 UTC 啟動。`FDSize=262144` 只是表格容量，並不是實際開啟數；上表使用 `/proc/PID/fd` 實際計數。採樣沒有設定容器記憶體限制。

## OOM 與容器狀態

journalctl 的四筆 OOM 實際時間（UTC）：2026-07-10 01:10:22、07-12 06:48:43、08-20 06:00:29、08-23 06:48:23。最近一筆是台灣 8 月 23 日 14:48。主控台保留訊息不是即時事故通知；api 的 OOMKilled=true 也不能當成今天新事件。

api、PostgreSQL、Redis、sandbox 健康；worker 與 worker_beat 顯示 unhealthy，但排程與任務仍有收到、完成的正常紀錄。健康檢查為 `celery -A app.celery inspect ping`，每 30 秒執行、10 秒逾時；beat 最近五次檢查均逾時。

[Dify 官方 PR #34572](https://github.com/langgenius/dify/pull/34572) 已於 2026-04-06 合併改善 worker/beat 健康檢查 CPU 開銷的變更，新增輕量入口並預設關閉檢查。這是本站舊式檢查的直接修正線索，**不是已證明能修復此 shim 資源累積的依據**；尚未驗證本站實際部署如何納入該變更。

worker_beat 啟動時間是今天 16:46:27；來源未知，本輪診斷沒有重啟它。今日 Docker runtime 警告查詢未回傳項目。

### 日誌關鍵字誤判已排除

- 初篩 worker 239 行、beat 120 行含 `timeout`，實際是正常排程名稱 `human_input_form_timeout.check_and_resume`，**不是 359 次逾時錯誤**。
- Nginx 六行含 `error` 是 `/error-docs` API 路徑，HTTP 都是 200，**不是六次 HTTP 失敗**。
- web 有 `Failed to find Server Action` 訊息，但沒有證據能將它們與使用者本次失敗请求對應。
- UFW 阻擋探測紀錄不能單憑數量推論攻擊造成故障。

## 同頁面連線比較

以下為少量無認證 GET；未發送模型對話、未觸發知識庫索引。時間為整體請求完成時間，部分取樣另列首位元組。

| 來源與路徑 | HTTP / 結果 | 完成時間 |
|---|---|---|
| Hetzner 本機 → 127.0.0.1/apps，Host flora | 200 | 0.174 秒 |
| Hetzner → 公開 https://flora.rsg.com.tw/apps | 200 | 0.415 秒 |
| Windows → origin HTTP /apps，Host flora | 200 | 1.876 秒 |
| Windows → 公開 HTTPS /apps | 20 秒、0 bytes 逾時 | 未完成 |
| Windows → Cloudflare 104.21.88.207，保留正確 hostname/TLS | 15 秒、0 bytes 逾時 | 未完成 |
| Windows → Cloudflare 172.67.153.93，保留正確 hostname/TLS | 200，CF-RAY a400d2a29c959688-TPE | 11.880 秒（首位元組 9.136 秒） |
| Windows → 104.21.88.207，帶診斷標記 query | 15 秒、0 bytes 逾時 | 未完成 |
| Windows → 172.67.153.93，帶診斷標記 query | 200，CF-RAY a400d6bd190556e9-TPE | 7.778 秒（首位元組 3.100 秒） |
| Windows → origin HTTP，帶診斷標記 query | 200 | 1.843 秒（首位元組 0.659 秒） |

104.21.88.207 逾時標記為 `flora_diag=20260924T1742_cf104`。09:42:11 UTC 取得的 Nginx 最近五分鐘紀錄中查不到該標記；當時沒有 origin 存取紀錄可證明這筆請求抵達 Nginx。後續另兩筆對照請求完成，但 SSH 工作階段已結束，後續標記的 origin 日誌對照未取得，不能假稱完成。

`--resolve` 只為單次 curl 指定入口，沒有修改電腦 DNS、hosts 或 Cloudflare DNS。來源、時間與 HTTP/HTTPS 傳輸不同，因此這些結果支持「代理路徑有問題」，尚不構成特定供應商責任判定。頁面 HTTP 200 也不代表已登入的知識庫 API、向量搜尋或實際對話端到端通過。

## 建議後續處置順序（尚未執行）

1. 先在另一個網路來源重測兩個 Cloudflare 入口，搭配 Cloudflare 請求／錯誤紀錄及 origin 相同標記對照，區分本地網路與代理到 origin。保留上列 Ray ID；不要僅因這次結果就停用代理或固定共用 Cloudflare IP。
2. 修復維護窗口中，先確認沒有執行中的知識庫工作、備份與 compose 設定，再針對 worker 的 shim 資源累積安排受控重建／重啟，並套用適配版本的健康檢查修正；後續比較 fd/RSS 是否再次成長。重啟只可能清除累積，不等於消除根因。
3. 依實際使用驗證後台、知識庫、正式 Flora 對話；最後才判斷 8 GB 是否真的不足，以及是否需升級或遷移。

目前沒有足夠證據支持「再加 RAM」或「搬去 Cloudflare 就能解決」。同時，現在 public Flora 網域本來已經經過 Cloudflare，後端才是 Hetzner。

## PowerShell 畫面錯誤與採樣界線

使用者截圖的 `python3 Unknown option` 是本機採樣腳本以 CRLF 傳送參數造成的錯誤，並非密碼錯誤，也不是本次 Flora 故障證據。已改用 LF；本機回歸測試得到 `LINE_HEX=70726f62650a`、`SELFTEST_OK`，修正版成功取得本報告追加證據。

使用既有 root 密碼互動登入，密碼未交給助手、未保存；未新增遠端金鑰。本輪沒有重啟、升級、刪除、修改遠端容器、DNS 或主機設定。診斷 SSH 工作階段已結束。

## 原始本機檔案

- `flora-readonly-diagnosis-20260924.txt`：第一輪資源、核心與容器紀錄。
- `flora-detail-readonly-20260924.txt`：shim 對應、健康檢查、版本及細部採樣。
- `flora-session-readonly-20260924-v2.txt`：日誌原文辨識、fd 計數、主機內網路探測及首次標記對照。
- PowerShell 本機 curl 對照來自本次工具輸出，數字完整摘錄於上表；未將工具輸出不存在的後續遠端結果記為已完成。