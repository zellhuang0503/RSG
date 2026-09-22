// Calendar days are always interpreted in Taiwan, independent of browser time zone.
export function todayInTaipei(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
export function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function monthDays(month) {
  const [year, number] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) =>
    new Date(Date.UTC(year, number - 1, 1 - offset + index)).toISOString().slice(0, 10));
}
function parseDate(value) {
  if (!value) return null;
  let normalized = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += 'T00:00:00';
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)) normalized += '+08:00';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function calendarEvent(event) {
  const start = parseDate(event.start);
  if (!start) return null; // Never substitute the publication date.
  const end = parseDate(event.end) || start;
  const startDay = todayInTaipei(start);
  const endDay = todayInTaipei(end < start ? start : end);
  const endsAt = event.allDay || !event.end || /^\d{4}-\d{2}-\d{2}$/.test(event.end)
    ? new Date(endDay + 'T23:59:59.999+08:00').getTime() : Math.max(start.getTime(), end.getTime());
  const time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
  return { ...event, start: startDay, end: endDay, startsAt: start.getTime(), endsAt,
    time: event.allDay ? '全天' : time.format(start) + (event.end ? '–' + time.format(end) : '') };
}
export function visibleEvents(events, now = new Date()) {
  return events.filter(event => event && event.endsAt >= now.getTime())
    .sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title, 'zh-TW'));
}
export function eventsBetween(events, start, end, query = '') {
  const needle = query.trim().toLocaleLowerCase();
  return events.filter(event => event.start <= end && event.end >= start &&
    (!needle || (event.title + ' ' + event.venue).toLocaleLowerCase().includes(needle)));
}
export function eventsOnDay(events, day, now = new Date(), query = '') {
  return day < todayInTaipei(now) ? [] : eventsBetween(visibleEvents(events, now), day, day, query);
}
export function dateLabel(day) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(day + 'T00:00:00Z'));
}
export function eventRange(event) {
  return dateLabel(event.start) + (event.end !== event.start ? ' — ' + dateLabel(event.end) : '');
}
