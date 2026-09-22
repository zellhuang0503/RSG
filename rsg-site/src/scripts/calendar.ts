import { todayInTaipei, shiftMonth, monthDays, visibleEvents, eventsBetween, eventsOnDay, dateLabel, eventRange } from '../lib/calendar.mjs';
type CalendarEvent = { title: string; href: string; start: string; end: string; startsAt: number; endsAt: number; venue: string; time: string; allDay: boolean };
document.querySelectorAll<HTMLElement>('[data-calendar]').forEach(root => {
  const data: CalendarEvent[] = JSON.parse(root.querySelector('[data-events]')?.textContent || '[]');
  const input = root.querySelector<HTMLInputElement>('[data-month]')!;
  const search = root.querySelector<HTMLInputElement>('[data-search]')!;
  const output = root.querySelector<HTMLElement>('[data-output]')!;
  const heading = root.querySelector<HTMLElement>('[data-heading]')!;
  let month = todayInTaipei().slice(0, 7);
  let mode = 'month';
  let renderedClockState = '';
  const clockState = (now: Date) => todayInTaipei(now) + visibleEvents(data, now).map((event: CalendarEvent) => event.href).join('|');
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
    const element = document.createElement(tag);
    element.textContent = text; element.className = className;
    return element;
  };
  const eventLink = (event: CalendarEvent, day?: string) => {
    const link = node('a', '', 'calendar-event'); link.href = event.href;
    link.append(node('span', event.title, 'calendar-event-title'));
    link.append(node('span', day && day > event.start ? '續 · ' + event.time : event.time, 'calendar-event-time'));
    link.title = eventRange(event) + ' · ' + event.time + (event.venue ? ' · ' + event.venue : '');
    link.setAttribute('aria-label', event.title + '，' + link.title);
    return link;
  };
  const render = () => {
    const now = new Date(), today = todayInTaipei(now), currentMonth = today.slice(0, 7);
    if (month < currentMonth) month = currentMonth;
    const available = visibleEvents(data, now) as CalendarEvent[];
    renderedClockState = clockState(now);
    const days = monthDays(month) as string[];
    const last = days.filter(day => day.startsWith(month)).at(-1)!;
    const selected = eventsBetween(available, month + '-01', last, search.value) as CalendarEvent[];
    heading.textContent = `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`;
    input.min = currentMonth; input.value = month;
    root.querySelector<HTMLButtonElement>('[data-month-step="-1"]')!.disabled = month <= currentMonth;
    root.querySelector<HTMLElement>('[data-today-label]')!.textContent = `今天：${today.slice(0, 4)} 年 ${dateLabel(today)}（台灣時間）`;
    root.querySelector<HTMLElement>('[data-status]')!.textContent = `本月 ${selected.length} 場${search.value.trim() ? '符合搜尋的' : ''}課程 · 僅顯示進行中及即將舉辦的活動`;
    root.querySelector<HTMLElement>('[data-mobile-hint]')!.hidden = mode !== 'month';
    const fragment = document.createDocumentFragment();
    if (mode === 'month') {
      const scroller = node('div', '', 'calendar-scroll'); scroller.tabIndex = 0;
      scroller.setAttribute('role', 'region'); scroller.setAttribute('aria-label', '月曆，可左右捲動');
      const table = node('table', '', 'calendar-table');
      table.append(node('caption', heading.textContent + '課程行事曆', 'visually-hidden'));
      const head = node('thead'), row = node('tr');
      ['一', '二', '三', '四', '五', '六', '日'].forEach(day => { const th = node('th', '星期' + day); th.scope = 'col'; row.append(th); });
      head.append(row); table.append(head);
      const body = node('tbody');
      for (let index = 0; index < days.length; index += 7) {
        const tr = node('tr');
        days.slice(index, index + 7).forEach(day => {
          const td = node('td', '', [!day.startsWith(month) ? 'other-month' : '', day < today ? 'past-date' : '', day === today ? 'today' : ''].join(' '));
          const date = node('time', String(Number(day.slice(8))), 'calendar-date'); date.dateTime = day;
          date.setAttribute('aria-label', day + ' ' + dateLabel(day));
          if (day === today) { date.setAttribute('aria-current', 'date'); date.append(node('span', '今天', 'calendar-today-badge')); }
          td.append(date);
          if (day.startsWith(month)) (eventsOnDay(selected, day, now) as CalendarEvent[]).forEach(event => td.append(eventLink(event, day)));
          tr.append(td);
        }); body.append(tr);
      }
      table.append(body); scroller.append(table); fragment.append(scroller);
    } else {
      const list = node('ul', '', 'calendar-agenda');
      selected.forEach(event => {
        const item = node('li'); item.append(node('p', eventRange(event), 'calendar-range'), eventLink(event));
        if (event.venue) item.append(node('p', event.venue, 'calendar-venue'));
        list.append(item);
      }); fragment.append(list);
    }
    if (!selected.length) {
      const empty = node('div', '', 'calendar-empty');
      empty.append(node('p', search.value.trim() ? '這個月沒有符合搜尋的課程。' : '這個月目前沒有尚未結束的課程。'));
      const next = eventsBetween(available, shiftMonth(month, 1) + '-01', '9999-12-31', search.value)[0] as CalendarEvent | undefined;
      if (next) {
        const button = node('button', '查看下一場：' + dateLabel(next.start) + ' ' + next.title); button.type = 'button';
        button.addEventListener('click', () => { month = next.start.slice(0, 7); render(); root.querySelector<HTMLButtonElement>('[data-today]')!.focus(); });
        empty.append(button);
      } fragment.append(empty);
    }
    output.replaceChildren(fragment);
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === mode)));
  };
  root.querySelectorAll<HTMLButtonElement>('[data-month-step]').forEach(button => button.addEventListener('click', () => { month = shiftMonth(month, Number(button.dataset.monthStep)); render(); }));
  root.querySelector('[data-today]')!.addEventListener('click', () => { month = todayInTaipei().slice(0, 7); render(); });
  input.addEventListener('change', () => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(input.value)) month = input.value; render(); });
  search.addEventListener('input', render);
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.view === 'list' ? 'list' : 'month'; render(); }));
  const refreshDates = () => { if (!document.hidden && clockState(new Date()) !== renderedClockState) render(); };
  setInterval(refreshDates, 60_000);
  document.addEventListener('visibilitychange', refreshDates);
  render();
  root.querySelector<HTMLElement>('.calendar-fallback')!.hidden = true;
  root.querySelector<HTMLElement>('.calendar-enhanced')!.hidden = false;
});
