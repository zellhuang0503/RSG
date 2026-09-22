import test from 'node:test';
import assert from 'node:assert/strict';
import { todayInTaipei, shiftMonth, monthDays, calendarEvent, visibleEvents, eventsBetween, eventsOnDay } from '../src/lib/calendar.mjs';
const event = (overrides = {}) => calendarEvent({ title: '工作坊', venue: '台北', href: '/events/test', start: '2026-09-22 10:00:00', end: '2026-09-22 18:00:00', allDay: false, ...overrides });
test('Taipei midnight does not depend on the host time zone', () => {
  assert.equal(todayInTaipei(new Date('2026-09-21T15:59:59Z')), '2026-09-21');
  assert.equal(todayInTaipei(new Date('2026-09-21T16:00:00Z')), '2026-09-22');
});
test('Monday-first calendar handles leap days and six-week months', () => {
  const days = monthDays('2028-02');
  assert.ok(days.includes('2028-02-29'));
  assert.equal(new Date(days[0] + 'T00:00:00Z').getUTCDay(), 1);
  assert.equal(days.length % 7, 0);
  assert.equal(monthDays('2026-03').length, 42);
});
test('month navigation crosses years', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
});
test('ended courses disappear immediately; ongoing courses stay', () => {
  assert.equal(visibleEvents([event()], new Date('2026-09-22T09:59:59Z')).length, 1);
  assert.equal(visibleEvents([event()], new Date('2026-09-22T10:00:01Z')).length, 0);
});
test('all-day and missing-end courses remain until Taiwan day ends', () => {
  const events = [event({ allDay: true }), event({ end: '' })];
  assert.equal(visibleEvents(events, new Date('2026-09-22T15:59:59Z')).length, 2);
  assert.equal(visibleEvents(events, new Date('2026-09-22T16:00:00Z')).length, 0);
});
test('multi-day courses appear across month and year boundaries without duplicates in counts', () => {
  const data = [event({ start: '2026-12-31', end: '2027-01-02', allDay: true })];
  assert.equal(eventsBetween(data, '2026-12-01', '2026-12-31').length, 1);
  assert.equal(eventsBetween(data, '2027-01-01', '2027-01-31').length, 1);
  assert.equal(eventsBetween(data, '2027-01-03', '2027-01-03').length, 0);
});
test('past date cells stay empty even when a multi-day course is ongoing', () => {
  const data = [event({ start: '2026-09-20', end: '2026-09-24', allDay: true })];
  const now = new Date('2026-09-22T04:00:00Z');
  assert.equal(eventsOnDay(data, '2026-09-21', now).length, 0);
  assert.equal(eventsOnDay(data, '2026-09-22', now).length, 1);
  assert.equal(eventsOnDay(data, '2026-09-24', now).length, 1);
});
test('same-day multiple courses and title/venue search', () => {
  const data = [event(), event({ title: '能量卡', venue: '大馬' })];
  assert.equal(eventsBetween(data, '2026-09-22', '2026-09-22').length, 2);
  assert.equal(eventsBetween(data, '2026-09-22', '2026-09-22', '大馬').length, 1);
  assert.equal(eventsBetween(data, '2026-09-22', '2026-09-22', '不存在').length, 0);
});
test('missing dates are not inferred from publication dates; explicit UTC is converted', () => {
  assert.equal(event({ start: '' }), null);
  assert.equal(event({ start: 'invalid' }), null);
  assert.equal(event({ start: '2026-09-21T17:00:00Z' }).start, '2026-09-22');
});
