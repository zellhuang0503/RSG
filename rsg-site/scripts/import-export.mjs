#!/usr/bin/env node
// 把 rsg-export 匯出的舊站內容搬進新站：
//   node scripts/import-export.mjs [匯出資料夾，預設 ../rsg-export/out]
//
// 做的事：
//   1. 刪除 content/**/sample-*.md（骨架附的範例）
//   2. 複製 pages / posts / events 的 Markdown 到 content/
//   3. 複製 taxonomy.json、urls.csv 到 content/
//   4. 複製 media/ 到 public/media/
//   5. 依 urls.csv 產生 public/_redirects（固定規則在 scripts/_redirects.base）
//   6. 列出舊站 sitemap 裡有、但新站沒有對應內容的網址，供人工決定要不要補轉址
// 不需要任何 npm 套件。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? path.join(root, '..', 'rsg-export', 'out'));

if (!fs.existsSync(src)) {
  console.error(`找不到匯出資料夾：${src}\n先在 rsg-export/ 執行 python export_wp.py，或把資料夾路徑當參數傳入。`);
  process.exit(1);
}

const stats = { pages: 0, posts: 0, events: 0, media: 0, redirects: 0, unmatched: 0 };

// 1 + 2：內容
for (const kind of ['pages', 'posts', 'events']) {
  const dest = path.join(root, 'content', kind);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(dest)) if (f.startsWith('sample-')) fs.rmSync(path.join(dest, f));
  const from = path.join(src, kind);
  if (!fs.existsSync(from)) { console.warn(`（匯出裡沒有 ${kind}/，略過）`); continue; }
  for (const f of fs.readdirSync(from)) {
    if (!f.endsWith('.md')) continue;
    fs.copyFileSync(path.join(from, f), path.join(dest, f));
    stats[kind]++;
  }
}

// 3：分類與網址表
for (const f of ['taxonomy.json', 'urls.csv']) {
  const p = path.join(src, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(root, 'content', f));
  else console.warn(`（匯出裡沒有 ${f}）`);
}

// 4：媒體
const mediaFrom = path.join(src, 'media');
if (fs.existsSync(mediaFrom)) {
  const mediaTo = path.join(root, 'public', 'media');
  fs.cpSync(mediaFrom, mediaTo, { recursive: true, force: false, errorOnExist: false });
  const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
  stats.media = count(mediaTo);
}

// 5 + 6：轉址與比對
const contentPaths = new Set();
for (const kind of ['pages', 'posts', 'events']) {
  const dir = path.join(root, 'content', kind);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const m = fs.readFileSync(path.join(dir, f), 'utf8').match(/^original_path:\s*"?([^"\n]+)"?/m);
    if (m) contentPaths.add(m[1].replace(/\/+$/, '') || '/');
  }
}
const builtIn = ['/', '/posts', '/events', '/search', '/feed.xml', '/llms.txt', '/robots.txt'];

const csvPath = path.join(root, 'content', 'urls.csv');
const generated = [];
const unmatched = [];
if (fs.existsSync(csvPath)) {
  for (const row of parseCsv(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, ''))) {
    const from = (row.path || '').replace(/\/+$/, '') || '/';
    const to = (row.new_path || '').replace(/\/+$/, '') || '/';
    if (row.type === 'media') continue;
    if (to !== from) { generated.push(`${from}  ${to}  301`); continue; }
    const covered = contentPaths.has(from) || builtIn.includes(from) || /^\/(category|tag)\//.test(from);
    if (!covered) unmatched.push(`${from}\t${row.type}\t${row.title || ''}`);
  }
}
stats.redirects = generated.length;
stats.unmatched = unmatched.length;

const base = fs.readFileSync(path.join(root, 'scripts', '_redirects.base'), 'utf8').trimEnd();
const out = [base, '', '# ---- 以下由 scripts/import-export.mjs 依 content/urls.csv 的 new_path 產生 ----', ...generated, ''].join('\n');
fs.writeFileSync(path.join(root, 'public', '_redirects'), out);
fs.writeFileSync(path.join(root, 'content', 'unmatched-paths.txt'),
  ['# 舊站 sitemap 有、新站目前沒有對應頁面的網址（多半是分類/標籤/分頁/作者頁）。', '# 要保留的，在 content/urls.csv 的 new_path 填新路徑後重跑 npm run import；不管它們就會 404。', ...unmatched, ''].join('\n'));

// 結尾斜線檢查：新站設定為「沒有結尾斜線」，若舊站網址多數有斜線，提醒改 astro.config.mjs
if (fs.existsSync(csvPath)) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '')).filter((r) => r.type !== 'media' && r.url);
  const withSlash = rows.filter((r) => /\/$/.test(r.url) && new URL(r.url).pathname !== '/').length;
  if (withSlash > rows.length / 2) console.warn(`\n注意：舊站 ${withSlash}/${rows.length} 個網址有結尾斜線，請把 astro.config.mjs 改成 trailingSlash: 'always' 與 build.format: 'directory'。`);
}

console.log(`
匯入完成
  頁面 ${stats.pages}、文章 ${stats.posts}、活動 ${stats.events}
  媒體檔案 ${stats.media}（public/media/）
  轉址規則 ${stats.redirects}（public/_redirects）
  待確認網址 ${stats.unmatched}（content/unmatched-paths.txt）
接著：npm run dev 預覽，npm run build 建置。`);

function parseCsv(text) {
  const rows = [];
  let field = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}
