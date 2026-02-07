import json
from pathlib import Path

# 載入知識庫清單
with open("dify_migration_backup/datasets_list.json", "r", encoding="utf-8") as f:
    datasets = json.load(f)

# 統計
total_datasets = len(datasets)
total_documents = sum(d["document_count"] for d in datasets)
total_words = sum(d["word_count"] for d in datasets)

# 統計實際匯出的檔案
backup_dir = Path("dify_migration_backup")
exported_files = list(backup_dir.glob("*_*.json"))
# 排除 datasets_list.json
exported_files = [f for f in exported_files if f.name != "datasets_list.json"]

print("=" * 60)
print("Dify 知識庫匯出完成統計")
print("=" * 60)
print()
print(f"📦 知識庫總數: {total_datasets} 個")
print(f"📄 文件總數: {total_documents} 份")
print(f"📝 總字數: {total_words:,} 字")
print()
print(f"✅ 實際匯出檔案: {len(exported_files)} 個 JSON 檔案")
print()
print("📁 備份位置: E:\\CascadeProjects\\RSG\\dify_migration_backup")
print()

# 列出知識庫明細
print("知識庫明細:")
print("-" * 60)
for idx, dataset in enumerate(datasets, 1):
    print(f"{idx}. {dataset['name']}")
    print(f"   文件數: {dataset['document_count']} 份")
    print(f"   字數: {dataset['word_count']:,} 字")
    print()
