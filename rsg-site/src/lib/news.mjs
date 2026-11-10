// 首頁「最新消息」輪播的下架規則：有填 endDate（課程最後一天，台灣日期 YYYY-MM-DD）的海報，
// 過了那一天就不顯示。建置時先排除，瀏覽器開啟時再依當天日期排除一次（不用等重新部署）。
// 沒填 endDate 的（推薦好友、一對一服務等常駐項目）一直顯示。
export const isNewsActive = (item, today) => !item.endDate || item.endDate >= today;
