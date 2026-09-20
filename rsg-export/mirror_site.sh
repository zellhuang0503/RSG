#!/usr/bin/env bash
# rsg-export/mirror_site.sh：把 rsg.com.tw 主站抓成純靜態 HTML 快照，
# 作為程式碼重建期間的過渡版本（部署到 Cloudflare Pages，舊 WordPress 立即下線）。
#
# 用法：
#   bash mirror_site.sh                # 輸出到 mirror/rsg.com.tw/
#   SITE=https://rsg.com.tw bash mirror_site.sh
#
# 需要 wget（macOS: brew install wget；Windows 建議用 WSL 或 Git Bash 附的 wget）。
# 只抓主站，shop.rsg.com.tw 與 cards.rsg.com.tw 不抓，連結維持指向原子網域。
set -euo pipefail

SITE="${SITE:-https://rsg.com.tw}"
HOST="${SITE#https://}"
OUT="${OUT:-mirror}"
UA="rsg-export-mirror/1.0 (+梵亞行銷 site migration)"

mkdir -p "$OUT"
cd "$OUT"

wget \
  --mirror \
  --page-requisites \
  --convert-links \
  --adjust-extension \
  --no-parent \
  --restrict-file-names=unix \
  --wait=0.5 --random-wait \
  --user-agent="$UA" \
  --reject-regex '(\?|/)(feed|wp-json|wp-admin|wp-login|xmlrpc|comments|\?s=|\?replytocom|/action~|controller=)' \
  --exclude-directories='/wp-admin,/wp-json' \
  --domains="$HOST" \
  -e robots=off \
  "$SITE/" || true   # wget 遇到 404 會回非零，不視為失敗

echo
echo "快照完成：$(pwd)/$HOST"
echo "檔案數：$(find "$HOST" -type f | wc -l)"
echo
echo "上線前請處理："
echo "  1. 全站搜尋 'wp-admin' 與 'wp-login'，把後台連結拿掉（例如選單的「會員登入」改連 shop）。"
echo "  2. 聯絡表單 (Contact Form 7) 在靜態站不會送出，先改成 mailto 或改接免費表單服務。"
echo "  3. 活動行事曆的月曆切換是動態功能，靜態版只保留已抓到的頁面。"
