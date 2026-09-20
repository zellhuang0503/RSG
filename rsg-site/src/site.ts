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
  nav: [
    { label: '關於花園', href: '/about-2' },
    { label: '課程活動', href: '/events' },
    { label: '文章', href: '/posts' },
    { label: '學員分享', href: '/share' },
    { label: '線上商店', href: 'https://shop.rsg.com.tw/', external: true },
  ],
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

export type NavItem = (typeof site.nav)[number];
