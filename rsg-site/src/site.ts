export type NavItem = { label: string; href: string; external?: boolean; children?: NavItem[] };

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
  logo: '/media/2025/11/RsgLogo-Zhtw-En-075.png',
  ogImage: '/media/2025/11/學習主軸主圖.jpg',
  // 首頁主視覺，照舊站輪播第一張的文案
  heroImage: '/media/2025/11/學習主軸主圖.jpg',
  heroTitle: '生命覺醒之花',
  heroSubtitle: '二十年的耕耘深植，只為此刻的綻放與覺醒。',
  // 主選單，照舊站（2026-09 截圖）順序與下拉項目
  nav: [
    {
      label: '個案服務',
      href: '/one-on-one-hypnosis',
      children: [
        { label: '一對一催眠', href: '/one-on-one-hypnosis' },
        { label: '企業 1-1 教練', href: '/one-on-one-corporate-coaching' },
      ],
    },
    {
      label: '課程與工作坊',
      href: '/events',
      children: [
        { label: '課程行事曆', href: '/events' },
        { label: '最新課程', href: '/latest-courses' },
        {
          label: '向內探索',
          href: '/archives/category/課程介紹',
          children: [
            { label: '一對一排列', href: '/archives/6968' },
            { label: '生命專車工作坊', href: '/archives/2061' },
            { label: '深度轉化工作坊', href: '/archives/2059' },
            { label: '內在小孩工作坊', href: '/archives/6311' },
            { label: '咖啡時光 Coffee Time', href: '/archives/7053' },
            { label: '數字與療癒', href: '/archives/5063' },
            { label: '開啟感知力工作坊', href: '/archives/7160' },
            { label: '主題整合系統排列工作坊', href: '/archives/7182' },
            { label: 'Polish Your Life｜生命整合工作坊', href: '/archives/7529' },
            { label: '生命藍圖工作坊', href: '/archives/7554' },
          ],
        },
        {
          label: '向下扎根',
          href: '/archives/category/課程介紹',
          children: [
            { label: '2025 除舊工作坊 × 2026 啟動工作坊', href: '/archives/7493' },
            { label: '慢活營', href: '/archives/6119' },
            { label: '招財開運自己來工作坊', href: '/archives/6610' },
            { label: '意識能量工作坊', href: '/archives/7586' },
          ],
        },
        {
          label: '向上擴展',
          href: '/archives/category/課程介紹',
          children: [{ label: '調頻與顯化工作坊', href: '/archives/6553' }],
        },
      ],
    },
    { label: '花園意識能量卡', href: 'https://cards.rsg.com.tw/', external: true },
    { label: '心靈捕夢網', href: '/心靈捕夢網' },
    { label: '能量商店', href: 'https://shop.rsg.com.tw/', external: true },
    {
      label: '關於花園',
      href: '/about-2',
      children: [
        { label: '關於花園', href: '/about-2' },
        { label: '20 週年─生命覺醒之花', href: '/relationship-gardne-20th' },
        { label: '學員怎麼說', href: '/share' },
      ],
    },
    { label: '會員登入', href: 'https://shop.rsg.com.tw/', external: true },
  ] as NavItem[],
  // 頁尾資訊，照舊站頁尾
  company: '如是管理顧問股份有限公司',
  address: '10673 台北市大安區羅斯福路4段119巷34號4樓',
  email: 'Garden@rsg.com.tw',
  line: 'rsg.garden',
  phone: '02-2735-5500',
  fax: '02-2735-5288',
  tagline: '落在地球 — 好好做人，好好生活',
  footerLinks: [
    { label: '體驗與協談', href: '/negotiate-one-to-one' },
    { label: '學員怎麼說', href: '/share' },
    { label: '課程在這兒', href: '/latest-courses' },
    { label: '音檔課程', href: 'https://shop.rsg.com.tw/courses/' },
    { label: '會員登入', href: 'https://shop.rsg.com.tw/wp-login.php/?openExternalBrowser=1' },
  ],
  social: [
    { label: 'Facebook', href: 'https://www.facebook.com/rsg.garden/' },
    { label: 'Instagram', href: 'https://www.instagram.com/rsg.garden/' },
    { label: 'YouTube', href: 'https://www.youtube.com/@relationship_garden' },
    { label: 'LINE', href: 'https://line.me/R/ti/p/@rsg.garden' },
  ],
  postsPerPage: 12,
  // 首頁顯示幾篇最新文章、幾場即將舉辦的活動
  homeLatestPosts: 6,
  homeUpcomingEvents: 3,
  // 全站 JSON-LD 與 llms.txt 用
  foundingDate: org.foundingDate,
};


