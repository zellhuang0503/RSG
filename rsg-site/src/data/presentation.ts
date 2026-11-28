// 與原站比對的素材；更換海報只需編輯此清單。
export const banners = ['1-1.jpg','2-1.jpg','3-1.jpg','4.jpg','5.jpg','6.jpg'].map((file,i) => ({
  src: '/media/2025/11/'+file, alt: '關係花園生命覺醒之花・首頁橫幅 '+(i+1),
}));
export const announcements = [
  {src:'/media/2026/08/關係花園_課程-115-0810-2-2.png',alt:'意識能量工作坊',href:'/archives/7586'},
  {src:'/media/2026/06/關係花園_課程_生命專車-53.png',alt:'生命專車工作坊',href:'/archives/2061'},
  {src:'/media/2026/08/關係花園_課程-115-0810-2-1.png',alt:'意識能量工作坊課程資訊',href:'/archives/7586'},
  {src:'/media/2026/01/推薦好友上課2.png',alt:'推薦好友上課'},
  {src:'/media/2025/11/20251128_03_企業一對一_0.jpg',alt:'企業1-1教練',href:'/one-on-one-corporate-coaching'},
  {src:'/media/2025/11/20251128_01_一對一催眠_0.jpg',alt:'一對一催眠',href:'/one-on-one-hypnosis'},
];
export const pagePresentation: Record<string,{hero:string;kind:string}> = {
 '/about-2':{hero:'/media/2022/08/img關於花園banner.png',kind:'about-page'},
 '/one-on-one-hypnosis':{hero:'/media/2022/08/png_一對一催眠_main-banner.png',kind:'service-page'},
 '/one-on-one-corporate-coaching':{hero:'/media/2023/06/企業1-1教練_網頁主圖.png',kind:'service-page'},
 '/latest-courses':{hero:'/media/2025/08/最新課程主圖.jpg',kind:'latest-page'},
};
