import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewsActive, newsLastDay } from '../src/lib/news.mjs';
import items from '../content/home-news.json' with { type: 'json' };

test('課程海報開課後留三個月，隔天自動下架', () => {
  const item = { title: '課程', startDate: '2026-10-17' };
  assert.equal(isNewsActive(item, '2027-01-17'), true);
  assert.equal(isNewsActive(item, '2027-01-18'), false);
});
test('月底開課遇到短月份，取那個月最後一天', () => {
  assert.equal(newsLastDay('2026-11-30'), '2027-02-28');
  assert.equal(newsLastDay('2026-08-29'), '2026-11-29');
});
test('沒有 startDate 的常駐項目一直顯示', () => {
  assert.equal(isNewsActive({ title: '推薦好友上課' }, '2099-01-01'), true);
});
test('home-news.json 的 startDate 都是 YYYY-MM-DD，且不再用 endDate', () => {
  for (const item of items) {
    assert.equal(item.endDate, undefined, item.title);
    if (item.startDate) assert.match(item.startDate, /^\d{4}-\d{2}-\d{2}$/, item.title);
  }
});

import { removeExpiredPosters } from '../src/lib/news.mjs';
import { readFileSync } from 'node:fs';

test('最新課程頁：開課滿三個月的海報從 HTML 拿掉，其他保留', () => {
  const html = '<div class="poster-gallery">\n  <a class="poster-gallery-item" data-start="2026-08-29" href="/x"><img src="a" /></a>\n  <figure class="poster-gallery-item" data-start="2026-10-17"><img src="b" /></figure>\n</div>';
  const out = removeExpiredPosters(html, '2026-11-30');
  assert.doesNotMatch(out, /src="a"/);
  assert.match(out, /src="b"/);
  assert.equal(removeExpiredPosters(html, '2026-11-29'), html);
});
test('最新課程頁每張海報都有開課日', () => {
  const md = readFileSync(new URL('../content/pages/latest-courses.md', import.meta.url), 'utf8');
  const items = md.match(/<(a|figure) class="poster-gallery-item"[^>]*>/g) ?? [];
  assert.ok(items.length > 0);
  for (const tag of items) assert.match(tag, /data-start="\d{4}-\d{2}-\d{2}"/, tag);
});
