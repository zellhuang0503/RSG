// 課程海報的下架規則（2026-11-10 Roger 定）：從開課日起留三個月，之後自動拿掉。
// 用在首頁「最新消息」輪播（home-news.json 的 startDate）和「最新課程」頁（海報的 data-start）。
// startDate＝開課第一天（台灣日期 YYYY-MM-DD）。例：10/17 開課 → 顯示到 1/17，1/18 消失。
// 建置時先排除，瀏覽器開啟時再依當天日期排除一次（不用等重新部署）。
// 沒填開課日的（推薦好友、一對一服務等常駐項目）一直顯示。
export const newsLastDay = (startDate) => {
  const [y, m, d] = startDate.split('-').map(Number);
  const daysInTarget = new Date(Date.UTC(y, m + 3, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + 2, Math.min(d, daysInTarget))).toISOString().slice(0, 10);
};
export const isNewsActive = (item, today) => !item.startDate || newsLastDay(item.startDate) >= today;

// 「最新課程」頁的海報寫在 Markdown 裡：<a|figure class="poster-gallery-item" data-start="YYYY-MM-DD">…</a|figure>
export const removeExpiredPosters = (html, today) =>
  html.replace(/<(a|figure)\b[^>]*\bdata-start="(\d{4}-\d{2}-\d{2})"[^>]*>[\s\S]*?<\/\1>\s*/g,
    (match, _tag, startDate) => (isNewsActive({ startDate }, today) ? match : ''));
