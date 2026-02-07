#!/usr/bin/env python3
"""
Dify 知識庫匯出執行腳本
自動執行匯出流程
"""

from dify_migration_tool import DifyMigrationTool

# Dify Cloud API Key
DIFY_CLOUD_API_KEY = "dataset-u1BhTgjJ0L0Dec8c1EFfUQjP"

def main():
    print("=" * 60)
    print("開始從 Dify Cloud 匯出知識庫")
    print("=" * 60)
    print()
    
    # 建立遷移工具實例
    tool = DifyMigrationTool(DIFY_CLOUD_API_KEY)
    
    print(f"📁 備份目錄: {tool.backup_dir}")
    print(f"📄 日誌檔案: {tool.log_file}")
    print()
    
    # 執行完整匯出
    migration_data = tool.export_all_datasets()
    
    print()
    print("=" * 60)
    print("✅ 匯出完成!")
    print("=" * 60)
    print()
    print(f"📦 匯出統計:")
    print(f"   - 知識庫數量: {len(migration_data['datasets'])}")
    
    total_docs = sum(len(ds['documents']) for ds in migration_data['datasets'])
    print(f"   - 文件總數: {total_docs}")
    
    print()
    print(f"📁 備份位置: {tool.backup_dir}")
    print(f"📄 完整資料: {tool.backup_dir / 'full_migration_data.json'}")
    print(f"📋 遷移日誌: {tool.log_file}")
    print()
    print("下一步: 請檢查備份資料是否完整")

if __name__ == "__main__":
    main()
