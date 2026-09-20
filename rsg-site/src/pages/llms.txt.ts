// 給 AI 引擎的站點導覽（llms.txt 慣例）：機構描述 + 主要頁面 + 最新文章與活動
import type { APIContext } from 'astro';
import { getPages, getPosts, getEvents, routeOf, summaryOf, isUpcoming } from '../lib/content';
import { site, org } from '../site';

export async function GET(_ctx: APIContext) {
  const abs = (p: string) => new URL(p, site.url).href;
  const pages = (await getPages()).filter((p) => routeOf(p) !== '/');
  const posts = (await getPosts()).slice(0, 50);
  const events = (await getEvents()).filter((e) => isUpcoming(e));
  const line = (e: { data: { title: string } } & Parameters<typeof routeOf>[0]) => `- [${e.data.title}](${abs(routeOf(e))}): ${summaryOf(e, 80)}`;

  const body = [
    `# ${site.name}`,
    '',
    `> ${org.description}`,
    '',
    `成立於 ${org.foundingDate} 年。創辦講師：${org.founders.map((f) => f.name).join('、')}。服務地區：${org.areaServed.join('、')}。`,
    `線上商店：https://shop.rsg.com.tw/ ｜ 學習指南：https://ask.rsg.com.tw/`,
    '',
    '## 主要頁面',
    ...pages.map(line),
    '',
    '## 即將舉辦的課程活動',
    ...(events.length ? events.map(line) : ['- 目前沒有排定的活動']),
    '',
    '## 最新文章',
    ...posts.map(line),
    '',
    `完整清單：${abs('/sitemap-index.xml')}`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
