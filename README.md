# RSG - 梵亞行銷技術工具集

本專案包含梵亞行銷有限公司的技術工具與自動化腳本。

## 📦 專案內容

### Dify 知識庫遷移工具

自動化工具,用於將 Dify Cloud 知識庫遷移到自建 Dify 實例 (如 Zeabur)。

#### 核心檔案

- **`dify_migration_tool.py`** - 主要遷移工具類別
- **`run_export.py`** - 快速匯出腳本
- **`run_export_resume.py`** - 續傳匯出腳本 (支援中斷後繼續)
- **`show_export_stats.py`** - 匯出統計顯示

#### 文件

- **`DIFY_MIGRATION_GUIDE.md`** - 完整使用指南
- **`DIFY_MIGRATION_CHECKLIST.md`** - 分週行動清單

#### 功能特色

✅ **全自動化** - 透過 Dify API 批次匯出/匯入  
✅ **完整備份** - 保留所有文件內容與分段資訊  
✅ **續傳支援** - 中斷後可從斷點繼續  
✅ **詳細日誌** - 追蹤每個步驟的執行狀態  
✅ **成本節省** - 從 Dify Cloud 遷移可省 55% 年費

#### 快速開始

```bash
# 1. 安裝依賴
pip install requests

# 2. 匯出知識庫
python run_export.py

# 3. 查看統計
python show_export_stats.py
```

詳細使用方式請參考 [DIFY_MIGRATION_GUIDE.md](DIFY_MIGRATION_GUIDE.md)

---

### 關係花園 rsg.com.tw GEO / AEO 專案

在不修改官網內容的前提下，用 Cloudflare Worker 與子目錄問答站提升 AI 搜尋引用率。

- **`docs/RSG_資安事件_博弈垃圾頁處理清單.md`** - 2026-09-20 發現 `/about` 被植入博弈垃圾頁的處理清單；清理驗收通過前暫停切橘雲與部署
- **`docs/RSG_GEO_AEO_執行方案.md`** - 整體方案、橘雲/灰雲決策、站外實體清單、成效衡量、時程
- **`rsg-ask/`** - 問答站內容與零相依建置腳本（`node build.js --drafts` 預覽）
- **`rsg-edge/`** - Cloudflare Worker 與部署手冊（子目錄 / 子網域兩種模式）

---

## 📝 授權

© 2026 梵亞行銷有限公司 - 內部使用工具

---

## 🔧 維護

**維護者**: 梵亞行銷技術團隊  
**最後更新**: 2026-02-07
