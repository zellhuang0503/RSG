# Dify 遷移行動清單

## 📅 時程規劃

**開始日期**: 2026-02-10 (下週一)  
**完成目標**: 2026-04-11 前全面上線  
**Dify Cloud 到期**: 2026-04-11

---

## ✅ 第一週任務 (2/10 - 2/14)

### 🔴 高優先級 (必做)

#### 1. 取消 Dify Cloud 自動續約
- [ ] 登入 Stripe 帳單頁面: https://billing.stripe.com
- [ ] 找到 "Dify Professional Plan" 訂閱
- [ ] 點擊「取消訂閱」但保留服務到 4/11
- [ ] 確認收到取消確認信

**預估時間**: 5 分鐘  
**重要性**: ⭐⭐⭐⭐⭐ (避免被扣 $590)

---

#### 2. 從 Dify Cloud 匯出知識庫

**步驟 A: 取得 API Key**
- [ ] 登入 Dify Cloud: https://cloud.dify.ai
- [ ] 前往 `知識庫` → 右上角 `服務 API` → `API 金鑰`
- [ ] 建立新的 API Key 並複製
- [ ] 保存到安全的地方 (密碼管理器)

**步驟 B: 執行匯出腳本**
```bash
# 開啟 PowerShell
cd E:\CascadeProjects\RSG

# 安裝依賴 (首次執行)
pip install requests

# 執行遷移工具
python dify_migration_tool.py
```

**互動提示:**
```
請輸入 Dify Cloud 知識庫服務 API Key: [貼上您的 Key]
是否現在就匯入到 Zeabur Dify? (y/n): n  ← 選 n
```

**步驟 C: 驗證備份**
- [ ] 檢查 `dify_migration_backup/` 目錄已建立
- [ ] 確認 `full_migration_data.json` 存在
- [ ] 查看 `migration_log_*.txt` 無嚴重錯誤
- [ ] 文件數量 ≈ 280 份

**預估時間**: 30 分鐘 (含等待)  
**重要性**: ⭐⭐⭐⭐⭐

---

### 🟡 中優先級 (建議做)

#### 3. 備份到雲端
- [ ] 將 `dify_migration_backup/` 整個資料夾壓縮
- [ ] 上傳到 Google Drive 或 Dropbox
- [ ] 確認上傳成功

**預估時間**: 10 分鐘  
**重要性**: ⭐⭐⭐⭐

---

## ✅ 第二週任務 (2/17 - 2/21)

### 4. 在 Zeabur 建立 Dify 測試環境

**步驟 A: 建立服務**
- [ ] 登入 Zeabur: https://zeabur.com
- [ ] 建立新專案: `dify-flora-migration`
- [ ] 新增服務:
  - [ ] PostgreSQL (Zeabur Marketplace)
  - [ ] Redis (Zeabur Marketplace)
  - [ ] Qdrant (Docker: qdrant/qdrant)
  - [ ] Dify API (Docker: langgenius/dify-api)
  - [ ] Dify Web (Docker: langgenius/dify-web)

**步驟 B: 配置環境變數**

參考檔案: `DIFY_MIGRATION_GUIDE.md` 的「步驟 3」

關鍵變數:
```env
# 資料庫連線
DB_HOST=postgres.zeabur.internal
REDIS_HOST=redis.zeabur.internal
QDRANT_URL=http://qdrant.zeabur.internal:6333

# LLM (使用 OpenRouter + DeepSeek)
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=[您的 OpenRouter Key]
```

**步驟 C: 驗證服務**
- [ ] 訪問 Dify Web UI: `https://[your-domain].zeabur.app`
- [ ] 建立管理員帳號
- [ ] 建立測試知識庫 (上傳 1 份文件測試)
- [ ] 測試 LLM 回應

**預估時間**: 2-3 小時  
**重要性**: ⭐⭐⭐⭐⭐

---

## ✅ 第三週任務 (2/24 - 2/28)

### 5. 執行知識庫匯入

**步驟 A: 取得 Zeabur Dify API Key**
- [ ] 登入 Zeabur Dify
- [ ] 前往 `知識庫` → `服務 API` → `API 金鑰`
- [ ] 建立並複製 API Key

**步驟 B: 執行匯入**
```bash
cd E:\CascadeProjects\RSG
python dify_migration_tool.py
```

**互動提示:**
```
請輸入 Dify Cloud 知識庫服務 API Key: [可隨便填]
是否現在就匯入到 Zeabur Dify? (y/n): y  ← 選 y

請輸入 Zeabur Dify 知識庫服務 API Key: [貼上 Zeabur Key]
請輸入 Zeabur Dify API URL: https://[your-domain].zeabur.app/v1
```

**步驟 C: 驗證匯入**
- [ ] 檢查所有知識庫已建立
- [ ] 文件數量與原始一致 (280 份)
- [ ] 隨機抽查 5 份文件內容正確

**預估時間**: 1 小時  
**重要性**: ⭐⭐⭐⭐⭐

---

### 6. 重建 Flora 機器人

- [ ] 從 Dify Cloud 匯出 Flora 應用的 DSL
  - 路徑: `工作室` → `Flora` → 右上角 `...` → `匯出 DSL`
- [ ] 在 Zeabur Dify 匯入 DSL
  - 路徑: `工作室` → `建立應用` → `匯入 DSL`
- [ ] 重新連接知識庫
- [ ] 測試對話功能 (至少 20 組測試)

**預估時間**: 1 小時  
**重要性**: ⭐⭐⭐⭐⭐

---

## ✅ 第四週任務 (3/3 - 3/7)

### 7. 官網整合測試

- [ ] 修改官網嵌入代碼
- [ ] 在測試環境驗證
- [ ] 灰度發布 (20% 流量)
- [ ] 監控錯誤與效能

**預估時間**: 2-3 小時  
**重要性**: ⭐⭐⭐⭐

---

## ✅ 上線前檢查 (3/10 前)

### 功能驗證
- [ ] 所有知識庫正常運作
- [ ] Flora 回應品質與 Dify Cloud 一致
- [ ] 官網聊天功能正常
- [ ] 回應時間 < 3 秒

### 效能監控
- [ ] 設定 Zeabur 監控告警
- [ ] 記錄基準效能指標
- [ ] 準備回滾方案 (保留 Dify Cloud 備援)

---

## 🚨 緊急聯絡資訊

**若遇到問題,請提供:**
1. 遷移日誌檔案 (`migration_log_*.txt`)
2. 錯誤訊息截圖
3. Zeabur 服務狀態

**技術支援**: 找 AI 助理 (我) 😊

---

## 📊 成本效益提醒

| 項目 | Dify Cloud | Zeabur 自建 | 節省 |
|------|-----------|------------|------|
| **年費** | $590 | $265 | **$325** |
| **節省比例** | - | - | **55%** |

**投資回報**: 立即見效,無前期成本

---

## 📝 備註

- 所有工具與文件已準備好在 `E:\CascadeProjects\RSG\`
- 遷移過程全自動化,無需手動上傳文件
- 保留 Dify Cloud 到 4/11 作為備援
- 預計 3 月中旬完成全面遷移

---

**建立日期**: 2026-02-07  
**預計完成**: 2026-03-15  
**最後期限**: 2026-04-11

✅ 祝您私教教材準備順利!下週見!
