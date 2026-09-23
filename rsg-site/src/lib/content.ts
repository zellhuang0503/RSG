// 內容查詢與網址對應的共用工具
import { getCollection, type CollectionEntry } from 'astro:content';
import taxonomy from '../../content/taxonomy.json';

export type AnyEntry = CollectionEntry<'pages'> | CollectionEntry<'posts'> | CollectionEntry<'events'>;

// 這些路徑由專屬頁面產生（首頁、清單、搜尋…），舊站若有同路徑的內容會被跳過並在建置時提示。
// 注意 /events/xxx 與 /posts/xxx 是內容頁的合法路徑，只有清單頁本身與分頁（/posts/2）保留。
export const RESERVED_EXACT = ['/', '/posts', '/events', '/search', '/404', '/feed.xml', '/llms.txt', '/robots.txt', '/心靈捕夢網'];
export const RESERVED_PREFIXES = ['/archives/category/', '/archives/tag/', '/pagefind/', '/_astro/'];

export function isReserved(path: string) {
  return RESERVED_EXACT.includes(path) || RESERVED_PREFIXES.some((p) => path.startsWith(p)) || /^\/posts\/\d+$/.test(path);
}

export function routeOf(entry: AnyEntry): string {
  let p = entry.data.original_path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

const published = (e: AnyEntry) => e.data.status === 'publish';

export async function getPages() {
  return (await getCollection('pages')).filter(published);
}

export async function getPosts() {
  const posts = (await getCollection('posts')).filter(published);
  return posts.sort((a, b) => toTime(b.data.date) - toTime(a.data.date));
}

export async function getEvents() {
  const events = (await getCollection('events')).filter(published);
  return events.sort((a, b) => toTime(b.data.start_date || b.data.date) - toTime(a.data.start_date || a.data.date));
}

/** 所有由 [...path].astro 產生的內容：頁面、文章、活動，排除保留路徑與重複路徑 */
export async function getRoutable(): Promise<AnyEntry[]> {
  const all: AnyEntry[] = [...(await getPages()), ...(await getPosts()), ...(await getEvents())];
  const seen = new Map<string, AnyEntry>();
  for (const e of all) {
    const path = routeOf(e);
    if (isReserved(path)) {
      if (path !== '/') console.warn(`[rsg-site] 跳過 ${e.collection}/${e.id}：路徑 ${path} 由專屬頁面產生`);
      continue;
    }
    if (seen.has(path)) {
      console.warn(`[rsg-site] 路徑重複：${path}（${seen.get(path)!.collection}/${seen.get(path)!.id} 與 ${e.collection}/${e.id}），保留前者`);
      continue;
    }
    seen.set(path, e);
  }
  return [...seen.values()];
}

/** 舊站首頁（original_path 為 /）的頁面內容，給 index.astro 用；沒有就回 undefined */
export async function getHomePage() {
  return (await getPages()).find((p) => routeOf(p) === '/');
}

// ---------- 分類 / 標籤 ----------
type Term = { id?: number; name: string; slug: string; description?: string };
const cats: Term[] = (taxonomy as any).categories ?? [];
const tags: Term[] = (taxonomy as any).tags ?? [];

export function slugify(name: string) {
  return decodeURIComponent(name)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-');
}

export function termSlug(kind: 'category' | 'tag', name: string) {
  const list = kind === 'category' ? cats : tags;
  const hit = list.find((t) => t.name === name);
  return hit ? decodeURIComponent(hit.slug) : slugify(name);
}

export function termHref(kind: 'category' | 'tag', name: string) {
  // 舊站的分類網址是 /archives/category/<名稱>，標籤是 /archives/tag/<名稱>，維持不變
  return `/archives/${kind}/${encodeURIComponent(termSlug(kind, name))}`;
}

export function termDescription(kind: 'category' | 'tag', name: string) {
  const list = kind === 'category' ? cats : tags;
  return list.find((t) => t.name === name)?.description ?? '';
}

/** 依分類或標籤把文章分組：Map<名稱, 文章[]> */
export function groupByTerm(posts: CollectionEntry<'posts'>[], kind: 'category' | 'tag') {
  const key = kind === 'category' ? 'categories' : 'tags';
  const map = new Map<string, CollectionEntry<'posts'>[]>();
  for (const p of posts) {
    for (const name of p.data[key]) {
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    }
  }
  return map;
}

// ---------- 日期與摘要 ----------
/** WordPress 與 The Events Calendar 的日期沒有時區（"2026-09-01T10:00:00" 或 "2027-01-16 09:30:00"），一律視為台灣時間 */
export function parseWpDate(s?: string): Date | null {
  if (!s) return null;
  let v = s.trim().replace(' ', 'T');
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) v += '+08:00';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toTime(s?: string) {
  return parseWpDate(s)?.getTime() ?? 0;
}

export function formatDate(s?: string, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }) {
  const t = toTime(s);
  if (!t) return '';
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', ...opts }).format(new Date(t));
}

export function formatDateTime(s?: string) {
  return formatDate(s, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** WordPress 的日期沒有時區，視為台灣時間並轉成 ISO 8601（給 JSON-LD、RSS 用） */
export function toIso(s?: string) {
  return parseWpDate(s)?.toISOString();
}

export function stripMarkdown(md: string) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** WordPress 摘要常帶 HTML 實體與「…read more」尾巴，清掉；太短就改用內文 */
export function cleanExcerpt(s: string) {
  return s
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/…?\s*read more\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summaryOf(entry: AnyEntry, max = 120) {
  const ex = cleanExcerpt(entry.data.excerpt || '');
  const d = entry.data.description || (ex.length >= 20 ? ex : stripMarkdown(entry.body ?? ''));
  return d.length > max ? d.slice(0, max).trimEnd() + '…' : d;
}

/** 卡片縮圖：精選圖優先，沒有就抓內文第一張 /media 圖片 */
export function thumbnailOf(entry: AnyEntry): string {
  if (entry.data.featured_image) return entry.data.featured_image;
  const m = (entry.body ?? '').match(/!\[[^\]]*\]\((\/media\/[^)\s"]+)/);
  return m ? m[1] : '';
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * perPage, current * perPage),
    current,
    totalPages,
    total: items.length,
  };
}

// ---------- 活動 ----------
export function isUpcoming(e: CollectionEntry<'events'>, now = Date.now()) {
  const end = toTime(e.data.end_date) || toTime(e.data.start_date);
  return end >= now - 24 * 3600 * 1000; // 當天結束的活動仍算進行中
}
