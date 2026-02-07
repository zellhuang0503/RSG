# Dify 知識庫遷移指南

## 📋 遷移工具說明

本工具可自動化完成從 **Dify Cloud** 到 **Zeabur 自建 Dify** 的知識庫遷移。

---

## 🚀 快速開始

### 前置需求

1. **Python 3.8+** 環境
2. **requests 套件**
   ```bash
   pip install requests
   ```

3. **Dify Cloud API Key** (知識庫服務)
   - 路徑: `知識庫` → `服務 API` → `API 金鑰`
   - 建立一組新的 API Key 並複製

4. **Zeabur Dify API Key** (遷移時需要)
   - 在 Zeabur 建立 Dify 實例後取得

---

## 📖 使用步驟

### 步驟 1: 僅匯出資料 (建議先執行)

```bash
# 執行遷移工具
python dify_migration_tool.py
```

**互動流程:**
```
請輸入 Dify Cloud 知識庫服務 API Key: [貼上您的 API Key]

開始匯出...
[進度顯示]

是否現在就匯入到 Zeabur Dify? (y/n): n  # 先選 n,僅匯出
```

**輸出結果:**
- 📁 `dify_migration_backup/` 目錄
  - `full_migration_data.json` - 完整遷移資料
  - `datasets_list.json` - 知識庫清單
  - `[知識庫名稱]_[文件名稱]_[ID].json` - 個別文件備份
  - `migration_log_[時間].txt` - 遷移日誌

---

### 步驟 2: 驗證匯出資料

```bash
# 檢查匯出的資料
cd dify_migration_backup
ls -lh

# 查看知識庫清單
cat datasets_list.json

# 查看遷移日誌
cat migration_log_*.txt
```

**確認項目:**
- ✅ 知識庫數量正確 (應該有多個,包含 Podcast、YouTube 等)
- ✅ 文件總數 ≈ 280 份
- ✅ 每份文件都有對應的 JSON 備份
- ✅ `full_migration_data.json` 檔案大小合理 (應該數 MB)

---

### 步驟 3: 建立 Zeabur Dify 環境

在執行匯入前,需先在 Zeabur 建立 Dify 實例:

```bash
# 在 Zeabur 建立以下服務:
1. Dify (使用官方 Docker image: langgenius/dify-api)
2. PostgreSQL
3. Redis
4. Qdrant (向量資料庫)
```

**環境變數配置:**
```env
# Dify 核心設定
SECRET_KEY=your-secret-key
MODE=api

# 資料庫
DB_USERNAME=postgres
DB_PASSWORD=your-db-password
DB_HOST=postgres.zeabur.internal
DB_PORT=5432
DB_DATABASE=dify

# Redis
REDIS_HOST=redis.zeabur.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# 向量資料庫
VECTOR_STORE=qdrant
QDRANT_URL=http://qdrant.zeabur.internal:6333

# LLM 配置 (OpenRouter + DeepSeek)
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=your-openrouter-key
```

---

### 步驟 4: 執行匯入

**方法 A: 使用遷移工具自動匯入**

```bash
python dify_migration_tool.py
```

```
請輸入 Dify Cloud 知識庫服務 API Key: [貼上 Cloud API Key]
# 工具會自動跳過匯出 (因為已有備份)

是否現在就匯入到 Zeabur Dify? (y/n): y

請輸入 Zeabur Dify 知識庫服務 API Key: [貼上 Zeabur API Key]
請輸入 Zeabur Dify API URL: https://your-dify.zeabur.app/v1

[開始匯入...]
```

**方法 B: 手動從備份匯入**

若您已有 `full_migration_data.json`:

```python
from dify_migration_tool import DifyMigrationTool
import json

# 載入備份資料
with open("dify_migration_backup/full_migration_data.json", "r", encoding="utf-8") as f:
    migration_data = json.load(f)

# 執行匯入
tool = DifyMigrationTool(source_api_key="dummy")  # 不需要真實 key
tool.import_to_new_dify(
    target_api_key="your-zeabur-api-key",
    target_base_url="https://your-dify.zeabur.app/v1",
    migration_data=migration_data
)
```

---

## ⚙️ 進階選項

### 自訂匯出範圍

若只想匯出特定知識庫:

```python
from dify_migration_tool import DifyMigrationTool

tool = DifyMigrationTool(source_api_key="your-api-key")

# 列出所有知識庫
datasets = tool.list_datasets()

# 選擇特定知識庫
target_dataset = [d for d in datasets if "Podcast" in d["name"]][0]

# 僅匯出該知識庫
documents = tool.get_dataset_documents(target_dataset["id"])
```

---

## 🔍 故障排除

### 問題 1: API 限流 (Rate Limit)

**症狀:**
```
❌ 取得文件列表失敗: 429 Too Many Requests
```

**解決方案:**
在腳本中增加延遲:
```python
# 在 dify_migration_tool.py 中找到 time.sleep(0.3)
# 改為更長的延遲
time.sleep(1.0)  # 增加到 1 秒
```

---

### 問題 2: 文件過大無法匯入

**症狀:**
```
❌ 文件建立失敗: 413 Payload Too Large
```

**解決方案:**
分段上傳大型文件:
```python
# 將文件切分為多個較小的文件
# 或調整 Zeabur Dify 的 MAX_FILE_SIZE 環境變數
```

---

### 問題 3: Embedding 失敗

**症狀:**
```
⚠️ 文件建立成功,但索引失敗
```

**解決方案:**
1. 檢查 Zeabur Dify 的 LLM 配置是否正確
2. 確認 OpenRouter API Key 有效
3. 檢查向量資料庫 (Qdrant) 是否正常運行

---

## 📊 預期遷移時間

基於您的知識庫規模 (280 份文件, 117.85 MB):

| 階段 | 預估時間 | 說明 |
|------|---------|------|
| **匯出** | 15-20 分鐘 | 取決於 API 限流 |
| **驗證** | 5 分鐘 | 檢查備份完整性 |
| **匯入** | 30-40 分鐘 | 包含 re-embedding |
| **總計** | **50-65 分鐘** | 全自動執行 |

---

## 🎯 遷移檢查清單

### 匯出前
- [ ] 已取得 Dify Cloud 知識庫服務 API Key
- [ ] 已安裝 Python 3.8+ 與 requests 套件
- [ ] 已建立備份目錄

### 匯出後
- [ ] `full_migration_data.json` 存在且大小合理
- [ ] 文件數量正確 (≈ 280 份)
- [ ] 遷移日誌無嚴重錯誤

### 匯入前
- [ ] Zeabur Dify 實例已建立並運行
- [ ] PostgreSQL、Redis、Qdrant 正常運作
- [ ] 已取得 Zeabur Dify API Key
- [ ] LLM 配置正確 (OpenRouter + DeepSeek)

### 匯入後
- [ ] 所有知識庫已建立
- [ ] 文件數量與原始一致
- [ ] 隨機抽查 5-10 份文件內容正確
- [ ] 測試 Flora 機器人回應品質

---

## 💡 最佳實踐

1. **先匯出,後匯入**
   - 不要一次執行完整流程
   - 先驗證匯出資料完整性

2. **保留備份**
   - `dify_migration_backup/` 目錄請妥善保存
   - 建議上傳到雲端儲存 (Google Drive/Dropbox)

3. **分批測試**
   - 先遷移 1-2 個知識庫測試
   - 確認無誤後再遷移全部

4. **雙軌並行**
   - 遷移完成後,保留 Dify Cloud 2 週作為備援
   - 確認 Zeabur 版本穩定後再關閉

---

## 📞 技術支援

若遇到問題,請提供:
1. 遷移日誌檔案 (`migration_log_*.txt`)
2. 錯誤訊息截圖
3. Zeabur Dify 環境變數配置

---

**版本**: 1.0.0  
**更新日期**: 2026-02-07  
**維護者**: 梵亞行銷技術團隊
