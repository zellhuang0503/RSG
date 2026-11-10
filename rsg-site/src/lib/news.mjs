// 首頁「最新消息」輪播的下架規則（2026-11-10 Roger 定）：課程海報從開課日起留三個月，之後自動拿掉。
// startDate＝開課第一天（台灣日期 YYYY-MM-DD）。例：10/17 開課 → 顯示到 1/17，1/18 消失。
// 建置時先排除，瀏覽器開啟時再依當天日期排除一次（不用等重新部署）。
// 沒填 startDate 的（推薦好友、一對一服務等常駐項目）一直顯示。
export const newsLastDay = (startDate) => {
  const [y, m, d] = startDate.split('-').map(Number);
  const daysInTarget = new Date(Date.UTC(y, m + 3, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + 2, Math.min(d, daysInTarget))).toISOString().slice(0, 10);
};
export const isNewsActive = (item, today) => !item.startDate || newsLastDay(item.startDate) >= today;
