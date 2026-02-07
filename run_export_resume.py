#!/usr/bin/env python3
"""
Dify 知識庫匯出執行腳本 (續傳版本)
從中斷處繼續匯出
"""

from dify_migration_tool import DifyMigrationTool
import json
from pathlib import Path

# Dify Cloud API Key
DIFY_CLOUD_API_KEY = "dataset-u1BhTgjJ0L0Dec8c1EFfUQjP"

def main():
    print("=" * 60)
    print("繼續從 Dify Cloud 匯出知識庫")
    print("=" * 60)
    print()
    
    # 建立遷移工具實例
    tool = DifyMigrationTool(DIFY_CLOUD_API_KEY)
    
    # 載入已匯出的知識庫清單
    datasets_file = tool.backup_dir / "datasets_list.json"
    with open(datasets_file, "r", encoding="utf-8") as f:
        datasets = json.load(f)
    
    print(f"📦 總共 {len(datasets)} 個知識庫")
    print()
    
    # 檢查哪些知識庫已經匯出
    exported_datasets = []
    for dataset in datasets:
        dataset_id = dataset["id"]
        dataset_name = dataset["name"]
        
        # 檢查是否已有匯出檔案
        exported_files = list(tool.backup_dir.glob(f"{dataset_name}_*.json"))
        
        if exported_files:
            print(f"✅ 已匯出: {dataset_name} ({len(exported_files)} 份文件)")
            exported_datasets.append(dataset_id)
        else:
            print(f"⏳ 待匯出: {dataset_name}")
    
    print()
    print(f"已完成: {len(exported_datasets)}/{len(datasets)} 個知識庫")
    print()
    
    # 匯出剩餘的知識庫
    for dataset in datasets:
        dataset_id = dataset["id"]
        dataset_name = dataset["name"]
        
        if dataset_id in exported_datasets:
            continue
        
        print("=" * 60)
        print(f"📦 處理知識庫: {dataset_name}")
        print("=" * 60)
        
        try:
            # 取得文件列表
            documents = tool.get_dataset_documents(dataset_id)
            
            if not documents:
                print(f"⚠️ 知識庫 {dataset_name} 沒有文件,跳過")
                continue
            
            # 匯出每份文件
            for idx, doc in enumerate(documents, 1):
                doc_id = doc["id"]
                doc_name = doc["name"]
                
                # 檢查是否已匯出
                doc_backup_file = tool.backup_dir / f"{dataset_name}_{doc_name}_{doc_id}.json"
                if doc_backup_file.exists():
                    print(f"  ✅ [{idx}/{len(documents)}] 已存在: {doc_name}")
                    continue
                
                print(f"  🔄 [{idx}/{len(documents)}] 匯出文件: {doc_name}")
                
                # 取得文件分段
                segments = tool.export_document_segments(dataset_id, doc_id)
                
                if segments is not None:
                    doc_export = {
                        "id": doc_id,
                        "name": doc_name,
                        "data_source_type": doc.get("data_source_type", "upload_file"),
                        "word_count": doc.get("word_count", 0),
                        "segments": segments
                    }
                    
                    # 保存單一文件的備份
                    with open(doc_backup_file, "w", encoding="utf-8") as f:
                        json.dump(doc_export, f, ensure_ascii=False, indent=2)
                    
                    print(f"     ✅ 已保存")
                else:
                    print(f"     ⚠️ 匯出失敗,跳過")
                
                import time
                time.sleep(0.5)  # 避免 API 限流
            
            print(f"✅ 知識庫 {dataset_name} 匯出完成")
            print()
            
        except Exception as e:
            print(f"❌ 匯出知識庫 {dataset_name} 時發生錯誤: {e}")
            print("   繼續處理下一個知識庫...")
            print()
            continue
    
    print()
    print("=" * 60)
    print("✅ 所有知識庫匯出完成!")
    print("=" * 60)
    print()
    
    # 統計
    all_files = list(tool.backup_dir.glob("*_*.json"))
    print(f"📊 匯出統計:")
    print(f"   - 知識庫數量: {len(datasets)}")
    print(f"   - 文件總數: {len(all_files)}")
    print()
    print(f"📁 備份位置: {tool.backup_dir}")

if __name__ == "__main__":
    main()
