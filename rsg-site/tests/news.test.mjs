import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewsActive } from '../src/lib/news.mjs';
import items from '../content/home-news.json' with { type: 'json' };

test('課程海報在最後一天當天仍顯示，隔天自動下架', () => {
  const item = { title: '課程', endDate: '2026-11-22' };
  assert.equal(isNewsActive(item, '2026-11-22'), true);
  assert.equal(isNewsActive(item, '2026-11-23'), false);
});
test('沒有 endDate 的常駐項目一直顯示', () => {
  assert.equal(isNewsActive({ title: '推薦好友上課' }, '2099-01-01'), true);
});
test('home-news.json 的 endDate 都是 YYYY-MM-DD', () => {
  for (const item of items) if (item.endDate) assert.match(item.endDate, /^\d{4}-\d{2}-\d{2}$/, item.title);
});
