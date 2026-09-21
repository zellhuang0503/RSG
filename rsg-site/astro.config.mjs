// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 網址規則：舊 WordPress 的連結沒有結尾斜線（/archives/6311、/about-2），
// 新站用 build.format 'file' + trailingSlash 'never' 產生 /archives/6311.html，
// Cloudflare Pages 會以 /archives/6311 提供，舊網址一個都不變。
export default defineConfig({
  site: 'https://rsg.com.tw',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(search|404)(\.html)?$/.test(page),
    }),
  ],
  vite: {
    // site.ts 會讀 ../rsg-ask/site.config.json（機構資料只維護一份）
    server: { fs: { allow: ['..'] } },
  },
});
