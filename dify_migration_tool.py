#!/usr/bin/env python3
"""
Dify 知識庫自動化遷移工具
用途: 從 Dify Cloud 批次匯出知識庫,並匯入到 Zeabur 自建 Dify 實例

作者: 梵亞行銷技術團隊
日期: 2026-02-07
"""

import os
import json
import time
import requests
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime


class DifyMigrationTool:
    """Dify 知識庫遷移工具"""
    
    def __init__(self, source_api_key: str, source_base_url: str = "https://api.dify.ai/v1"):
        """
        初始化遷移工具
        
        Args:
            source_api_key: Dify Cloud 知識庫服務 API Key
            source_base_url: Dify Cloud API 基礎 URL
        """
        self.source_api_key = source_api_key
        self.source_base_url = source_base_url
        self.headers = {
            "Authorization": f"Bearer {source_api_key}",
            "Content-Type": "application/json"
        }
        
        # 建立本地備份目錄 (在 RSG 專案內)
        project_root = Path(__file__).parent
        self.backup_dir = project_root / "dify_migration_backup"
        self.backup_dir.mkdir(exist_ok=True)
        
        # 遷移日誌
        self.log_file = self.backup_dir / f"migration_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    def log(self, message: str):
        """記錄遷移日誌"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        print(log_message)
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(log_message + "\n")
    
    def list_datasets(self) -> List[Dict]:
        """
        列出所有知識庫
        
        Returns:
            知識庫列表
        """
        self.log("開始列出所有知識庫...")
        
        url = f"{self.source_base_url}/datasets"
        params = {"page": 1, "limit": 100}
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            datasets = data.get("data", [])
            
            self.log(f"✅ 找到 {len(datasets)} 個知識庫")
            
            # 保存知識庫清單
            with open(self.backup_dir / "datasets_list.json", "w", encoding="utf-8") as f:
                json.dump(datasets, f, ensure_ascii=False, indent=2)
            
            return datasets
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ 列出知識庫失敗: {e}")
            return []
    
    def get_dataset_documents(self, dataset_id: str) -> List[Dict]:
        """
        取得指定知識庫的所有文件
        
        Args:
            dataset_id: 知識庫 ID
            
        Returns:
            文件列表
        """
        self.log(f"正在取得知識庫 {dataset_id} 的文件列表...")
        
        url = f"{self.source_base_url}/datasets/{dataset_id}/documents"
        params = {"page": 1, "limit": 100}
        
        all_documents = []
        
        try:
            while True:
                response = requests.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                documents = data.get("data", [])
                all_documents.extend(documents)
                
                # 檢查是否還有下一頁
                if not data.get("has_more", False):
                    break
                
                params["page"] += 1
                time.sleep(0.5)  # 避免 API 限流
            
            self.log(f"✅ 找到 {len(all_documents)} 份文件")
            return all_documents
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ 取得文件列表失敗: {e}")
            return []
    
    def export_document_segments(self, dataset_id: str, document_id: str) -> Optional[List[Dict]]:
        """
        匯出文件的所有分段 (chunks)
        
        Args:
            dataset_id: 知識庫 ID
            document_id: 文件 ID
            
        Returns:
            分段列表
        """
        url = f"{self.source_base_url}/datasets/{dataset_id}/documents/{document_id}/segments"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            segments = data.get("data", [])
            
            return segments
            
        except requests.exceptions.RequestException as e:
            self.log(f"⚠️ 匯出文件 {document_id} 分段失敗: {e}")
            return None
    
    def export_all_datasets(self) -> Dict[str, any]:
        """
        匯出所有知識庫的完整資料
        
        Returns:
            遷移資料字典
        """
        self.log("=" * 60)
        self.log("開始完整匯出流程")
        self.log("=" * 60)
        
        migration_data = {
            "export_time": datetime.now().isoformat(),
            "source": "Dify Cloud",
            "datasets": []
        }
        
        # 1. 列出所有知識庫
        datasets = self.list_datasets()
        
        # 2. 對每個知識庫,匯出所有文件與分段
        for dataset in datasets:
            dataset_id = dataset["id"]
            dataset_name = dataset["name"]
            
            self.log(f"\n📦 處理知識庫: {dataset_name} ({dataset_id})")
            
            dataset_export = {
                "id": dataset_id,
                "name": dataset_name,
                "description": dataset.get("description", ""),
                "indexing_technique": dataset.get("indexing_technique", "high_quality"),
                "embedding_model": dataset.get("embedding_model", ""),
                "documents": []
            }
            
            # 取得文件列表
            documents = self.get_dataset_documents(dataset_id)
            
            # 匯出每份文件的內容
            for idx, doc in enumerate(documents, 1):
                doc_id = doc["id"]
                doc_name = doc["name"]
                
                self.log(f"  [{idx}/{len(documents)}] 匯出文件: {doc_name}")
                
                # 取得文件分段
                segments = self.export_document_segments(dataset_id, doc_id)
                
                if segments is not None:
                    doc_export = {
                        "id": doc_id,
                        "name": doc_name,
                        "data_source_type": doc.get("data_source_type", "upload_file"),
                        "word_count": doc.get("word_count", 0),
                        "segments": segments
                    }
                    
                    dataset_export["documents"].append(doc_export)
                    
                    # 保存單一文件的備份
                    doc_backup_file = self.backup_dir / f"{dataset_name}_{doc_name}_{doc_id}.json"
                    with open(doc_backup_file, "w", encoding="utf-8") as f:
                        json.dump(doc_export, f, ensure_ascii=False, indent=2)
                
                time.sleep(0.3)  # 避免 API 限流
            
            migration_data["datasets"].append(dataset_export)
        
        # 3. 保存完整遷移資料
        migration_file = self.backup_dir / "full_migration_data.json"
        with open(migration_file, "w", encoding="utf-8") as f:
            json.dump(migration_data, f, ensure_ascii=False, indent=2)
        
        self.log("\n" + "=" * 60)
        self.log(f"✅ 匯出完成!資料已保存至: {self.backup_dir}")
        self.log(f"📄 完整遷移檔案: {migration_file}")
        self.log("=" * 60)
        
        return migration_data
    
    def import_to_new_dify(self, target_api_key: str, target_base_url: str, migration_data: Dict):
        """
        匯入資料到新的 Dify 實例 (Zeabur)
        
        Args:
            target_api_key: Zeabur Dify 知識庫服務 API Key
            target_base_url: Zeabur Dify API 基礎 URL
            migration_data: 遷移資料
        """
        self.log("\n" + "=" * 60)
        self.log("開始匯入到 Zeabur Dify")
        self.log("=" * 60)
        
        target_headers = {
            "Authorization": f"Bearer {target_api_key}",
            "Content-Type": "application/json"
        }
        
        for dataset in migration_data["datasets"]:
            dataset_name = dataset["name"]
            self.log(f"\n📦 建立知識庫: {dataset_name}")
            
            # 1. 建立新的知識庫
            create_dataset_url = f"{target_base_url}/datasets"
            create_payload = {
                "name": dataset_name,
                "description": dataset.get("description", ""),
                "indexing_technique": dataset.get("indexing_technique", "high_quality")
            }
            
            try:
                response = requests.post(create_dataset_url, headers=target_headers, json=create_payload)
                response.raise_for_status()
                new_dataset = response.json()
                new_dataset_id = new_dataset["id"]
                
                self.log(f"✅ 知識庫建立成功: {new_dataset_id}")
                
                # 2. 重新建立文件與分段
                for doc in dataset["documents"]:
                    doc_name = doc["name"]
                    self.log(f"  📄 重建文件: {doc_name}")
                    
                    # 合併所有分段的文本
                    full_text = "\n\n".join([seg["content"] for seg in doc["segments"]])
                    
                    # 建立文件 (透過文本上傳)
                    create_doc_url = f"{target_base_url}/datasets/{new_dataset_id}/document/create_by_text"
                    doc_payload = {
                        "name": doc_name,
                        "text": full_text,
                        "indexing_technique": dataset.get("indexing_technique", "high_quality"),
                        "process_rule": {
                            "mode": "automatic"
                        }
                    }
                    
                    try:
                        doc_response = requests.post(create_doc_url, headers=target_headers, json=doc_payload)
                        doc_response.raise_for_status()
                        self.log(f"    ✅ 文件建立成功")
                        
                    except requests.exceptions.RequestException as e:
                        self.log(f"    ❌ 文件建立失敗: {e}")
                    
                    time.sleep(1)  # 避免 API 限流
                
            except requests.exceptions.RequestException as e:
                self.log(f"❌ 知識庫建立失敗: {e}")
        
        self.log("\n" + "=" * 60)
        self.log("✅ 匯入完成!")
        self.log("=" * 60)


def main():
    """主程式"""
    print("=" * 60)
    print("Dify 知識庫自動化遷移工具")
    print("梵亞行銷技術團隊")
    print("=" * 60)
    print()
    
    # 步驟 1: 從 Dify Cloud 匯出
    print("📋 步驟 1: 從 Dify Cloud 匯出知識庫")
    print("-" * 60)
    
    source_api_key = input("請輸入 Dify Cloud 知識庫服務 API Key: ").strip()
    
    if not source_api_key:
        print("❌ API Key 不能為空!")
        return
    
    tool = DifyMigrationTool(source_api_key)
    
    print("\n開始匯出...")
    migration_data = tool.export_all_datasets()
    
    # 步驟 2: 匯入到 Zeabur Dify (選配)
    print("\n" + "=" * 60)
    print("📋 步驟 2: 匯入到 Zeabur Dify (選配)")
    print("-" * 60)
    
    import_now = input("是否現在就匯入到 Zeabur Dify? (y/n): ").strip().lower()
    
    if import_now == "y":
        target_api_key = input("請輸入 Zeabur Dify 知識庫服務 API Key: ").strip()
        target_base_url = input("請輸入 Zeabur Dify API URL (例: https://your-dify.zeabur.app/v1): ").strip()
        
        if target_api_key and target_base_url:
            tool.import_to_new_dify(target_api_key, target_base_url, migration_data)
        else:
            print("⚠️ 資訊不完整,跳過匯入步驟")
    else:
        print("ℹ️ 已跳過匯入步驟")
        print(f"📁 匯出資料已保存至: {tool.backup_dir}")
        print("   您可以稍後手動執行匯入")
    
    print("\n✅ 遷移工具執行完畢!")


if __name__ == "__main__":
    main()
