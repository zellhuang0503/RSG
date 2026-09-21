export type NavItem = { label: string; href: string; external?: boolean; children?: { label: string; href: string }[] };

// 全站設定。機構資料（名稱、描述、創辦人、sameAs）只維護一份，
// 與 rsg-ask 問答站、rsg-edge Worker 共用 ../rsg-ask/site.config.json。
import shared from '../../rsg-ask/site.config.json';

export const org = shared.organization;

export const site = {
  name: shared.siteName,
  shortName: org.alternateName,
  url: 'https://rsg.com.tw',
  language: 'zh-Hant-TW',
  description: org.description,
  // 放在 public/ 的 logo，匯入舊站媒體後改成實際路徑（例如 /media/2020/05/logo.png）
  logo: '/logo.svg',
  ogImage: '/og-default.png',
  // 主選單。children 會變成下拉；請對照舊站選單調整文字與順序
  nav: [
    { label: '關於花園', href: '/about-2' },
    {
      label: '課程',
      href: '/events',
      children: [
        { label: '課程活動時程', href: '/events' },
        { label: '課程在這兒', href: '/課程在這兒' },
        { label: '最新課程', href: '/latest-courses' },
        { label: '線上學習課程', href: '/線上學習課程' },
      ],
    },
    {
      label: '一對一服務',
      href: '/negotiate-one-to-one',
      children: [
        { label: '一對一協談', href: '/negotiate-one-to-one' },
        { label: '一對一排列', href: '/arrangement-one-to-one' },
        { label: '一對一催眠', href: '/one-on-one-hypnosis' },
        { label: '企業 1-1 教練', href: '/one-on-one-corporate-coaching' },
      ],
    },
    { label: '學員怎麼說', href: '/share' },
    {
      label: '文章',
      href: '/posts',
      children: [
        { label: '所有文章', href: '/posts' },
        { label: '關係花園文章', href: '/archives/category/關係花園文章' },
        { label: '心靈捕夢網', href: '/心靈捕夢網' },
        { label: '最新學員心得', href: '/archives/category/最新學員心得' },
      ],
    },
    { label: '線上商店', href: 'https://shop.rsg.com.tw/', external: true },
  ] as NavItem[],
  footerLinks: [
    { label: 'Facebook 粉絲團', href: 'https://www.facebook.com/rsg.garden/' },
    { label: '線上商店', href: 'https://shop.rsg.com.tw/' },
    { label: '學習指南', href: 'https://ask.rsg.com.tw/' },
  ],
  postsPerPage: 12,
  // 首頁顯示幾篇最新文章、幾場即將舉辦的活動
  homeLatestPosts: 6,
  homeUpcomingEvents: 3,
  // 全站 JSON-LD 與 llms.txt 用
  foundingDate: org.foundingDate,
};


