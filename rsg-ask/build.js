#!/usr/bin/env node
/**
 * rsg-ask 靜態站產生器（零相依套件）
 *
 * 讀取 content/*.md（含 front matter），輸出到 dist/：
 *   dist/ask/index.html            主題總覽
 *   dist/ask/<slug>/index.html     單一問答頁（含 FAQPage / BreadcrumbList / WebPage JSON-LD）
 *   dist/ask/<slug>.md             同內容的 Markdown 版本（給 AI 代理直接讀）
 *   dist/ask/sitemap.xml           只列出 status: approved 的頁面
 *   dist/ask/style.css
 *   dist/llms.txt                  站點層級的 LLM 導覽檔（Worker 會在 /llms.txt 提供）
 *
 * 用法：
 *   node build.js            只輸出 status: approved 的頁面
 *   node build.js --drafts   連 draft / review 一起輸出（預覽用，未定稿頁會加 noindex 且不進 sitemap）
 *   SITE_URL=https://ask.rsg.com.tw BASE_PATH= node build.js   子網域模式（見 rsg-edge/README.md）
 *   INCLUDE_DRAFTS=1 等同 --drafts（CI 用）
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, "content");
const DIST = path.join(ROOT, "dist");
const INCLUDE_DRAFTS = process.argv.includes("--drafts") || process.env.INCLUDE_DRAFTS === "1";
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
// 子網域模式可用環境變數覆寫：SITE_URL=https://ask.rsg.com.tw BASE_PATH= node build.js
if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL.replace(/\/$/, "");
if (process.env.BASE_PATH !== undefined) site.basePath = process.env.BASE_PATH;
const BASE = site.basePath.replace(/\/$/, "");
const ABS = (p) => site.siteUrl + p;

// ---------- front matter（極簡 YAML 子集：純量、字串陣列、物件陣列）----------
function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("缺少 front matter");
  const meta = {};
  const lines = m[1].split("\n");
  let i = 0;
  const unquote = (s) => s.replace(/^["'](.*)["']$/, "$1").trim();
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    const val = kv[2].trim();
    if (val !== "") { meta[key] = unquote(val); i++; continue; }
    // 陣列
    const arr = [];
    i++;
    while (i < lines.length && /^\s+-\s/.test(lines[i])) {
      const itemLine = lines[i].replace(/^\s+-\s*/, "");
      const objKv = itemLine.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (objKv) {
        const obj = { [objKv[1]]: unquote(objKv[2]) };
        i++;
        while (i < lines.length && /^\s{4,}[A-Za-z_]+:/.test(lines[i])) {
          const k2 = lines[i].trim().match(/^([A-Za-z_]+):\s*(.*)$/);
          obj[k2[1]] = unquote(k2[2]);
          i++;
        }
        arr.push(obj);
      } else {
        arr.push(unquote(itemLine));
        i++;
      }
    }
    meta[key] = arr;
  }
  return { meta, body: m[2].trim() };
}

// ---------- Markdown 子集 → HTML ----------
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
      const ext = /^https?:\/\//.test(u) && !u.startsWith(site.siteUrl);
      return `<a href="${u}"${ext ? ' rel="noopener" target="_blank"' : ""}>${t}</a>`;
    });
}
function mdToHtml(md) {
  const out = [];
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let h;
    if ((h = l.match(/^(#{2,4})\s+(.*)$/))) {
      const lvl = h[1].length;
      const text = h[2].trim();
      const id = text.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
      out.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`);
      i++; continue;
    }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${mdToHtml(buf.join("\n"))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s/.test(l)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s/, "")); i++; }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s/.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|[-*]\s|\d+\.\s|>)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

// ---------- 讀取內容 ----------
function loadPages() {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).sort();
  const pages = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const required = ["title", "slug", "category", "status", "updated", "summary"];
    for (const k of required) if (!meta[k]) throw new Error(`${f} 缺少 ${k}`);
    if (!/^[a-z0-9-]+$/.test(meta.slug)) throw new Error(`${f} slug 只能用小寫英數與連字號`);
    if (!["draft", "review", "approved"].includes(meta.status)) throw new Error(`${f} status 需為 draft / review / approved`);
    if (meta.status !== "approved" && !INCLUDE_DRAFTS) continue;
    pages.push({ ...meta, body, file: f, faq: meta.faq || [], sources: meta.sources || [], related: meta.related || [] });
  }
  const slugs = new Set();
  for (const p of pages) { if (slugs.has(p.slug)) throw new Error(`slug 重複：${p.slug}`); slugs.add(p.slug); }
  return pages;
}

// ---------- JSON-LD ----------
function orgJsonLd() {
  const o = site.organization;
  return {
    "@type": "Organization",
    "@id": site.siteUrl + "/#organization",
    name: o.name,
    alternateName: o.alternateName,
    url: o.url,
    logo: o.logo,
    foundingDate: o.foundingDate,
    description: o.description,
    areaServed: o.areaServed,
    sameAs: o.sameAs,
    founder: o.founders.map((p) => ({ "@type": "Person", name: p.name, jobTitle: p.jobTitle, url: p.url })),
  };
}
function pageJsonLd(p) {
  const url = ABS(`${BASE}/${p.slug}/`);
  const faqEntities = [{ q: p.title, a: p.summary }, ...p.faq.map((x) => ({ q: x.q, a: x.a }))];
  return {
    "@context": "https://schema.org",
    "@graph": [
      orgJsonLd(),
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: p.title,
        description: p.summary,
        inLanguage: site.language,
        datePublished: p.published || p.updated,
        dateModified: p.updated,
        isPartOf: { "@id": ABS(`${BASE}/#website`) },
        publisher: { "@id": site.siteUrl + "/#organization" },
        about: { "@id": site.siteUrl + "/#organization" },
      },
      {
        "@type": "FAQPage",
        "@id": url + "#faq",
        mainEntity: faqEntities.map((x) => ({
          "@type": "Question",
          name: x.q,
          acceptedAnswer: { "@type": "Answer", text: x.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.organization.alternateName, item: site.siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: site.sectionTitle, item: ABS(`${BASE}/`) },
          { "@type": "ListItem", position: 3, name: p.title, item: url },
        ],
      },
    ],
  };
}
function indexJsonLd(pages) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      orgJsonLd(),
      {
        "@type": "WebSite",
        "@id": ABS(`${BASE}/#website`),
        url: ABS(`${BASE}/`),
        name: site.sectionTitle,
        description: site.sectionDescription,
        inLanguage: site.language,
        publisher: { "@id": site.siteUrl + "/#organization" },
      },
      {
        "@type": "CollectionPage",
        "@id": ABS(`${BASE}/`),
        url: ABS(`${BASE}/`),
        name: site.sectionTitle,
        description: site.sectionDescription,
        hasPart: pages.map((p) => ({ "@type": "WebPage", "@id": ABS(`${BASE}/${p.slug}/`), name: p.title })),
      },
    ],
  };
}

// ---------- HTML 版型 ----------
const CATEGORY_LABEL = { definition: "觀念解說", choice: "如何選擇", brand: "關於關係花園", course: "課程介紹" };
const CATEGORY_ORDER = ["brand", "course", "definition", "choice"];

function layout({ title, description, canonical, jsonld, body, noindex, mdAlt }) {
  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">'}
${mdAlt ? `<link rel="alternate" type="text/markdown" href="${mdAlt}">` : ""}
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${esc(site.siteName)}">
<link rel="stylesheet" href="${BASE}/style.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header class="site-header">
  <a class="brand" href="${site.siteUrl}/">${esc(site.organization.alternateName)}</a>
  <nav><a href="${BASE}/">${esc(site.sectionTitle)}</a></nav>
</header>
<main class="wrap">
${body}
</main>
<footer class="site-footer">
  <p>${esc(site.publisherNote)}</p>
  <p><a href="${site.siteUrl}/">回到關係花園官網</a> · <a href="${BASE}/">學習指南首頁</a></p>
</footer>
</body>
</html>`;
}

function renderPage(p, all) {
  const url = ABS(`${BASE}/${p.slug}/`);
  const related = p.related.map((s) => all.find((x) => x.slug === s)).filter(Boolean);
  const body = `
<nav class="crumbs" aria-label="breadcrumb"><a href="${site.siteUrl}/">關係花園</a> › <a href="${BASE}/">${esc(site.sectionTitle)}</a> › <span>${esc(CATEGORY_LABEL[p.category] || p.category)}</span></nav>
<article>
  <h1>${esc(p.title)}</h1>
  <p class="meta">更新於 ${esc(p.updated)}${p.status !== "approved" ? ` · <span class="badge">${p.status.toUpperCase()}（未定稿）</span>` : ""}</p>
  <div class="answer-first"><p>${inline(p.summary)}</p></div>
  ${mdToHtml(p.body)}
  ${p.faq.length ? `<section class="faq"><h2 id="faq">延伸問題</h2>${p.faq.map((x) => `<details><summary>${inline(x.q)}</summary><p>${inline(x.a)}</p></details>`).join("")}</section>` : ""}
  ${p.sources.length ? `<section class="sources"><h2 id="sources">資料來源</h2><ul>${p.sources.map((s) => `<li>${inline(s)}</li>`).join("")}</ul></section>` : ""}
  ${related.length ? `<section class="related"><h2 id="related">相關問題</h2><ul>${related.map((r) => `<li><a href="${BASE}/${r.slug}/">${esc(r.title)}</a></li>`).join("")}</ul></section>` : ""}
</article>`;
  return layout({
    title: `${p.title}｜${site.sectionTitle}`,
    description: p.summary,
    canonical: url,
    jsonld: pageJsonLd(p),
    body,
    noindex: p.status !== "approved",
    mdAlt: ABS(`${BASE}/${p.slug}.md`),
  });
}

function renderMarkdown(p) {
  const lines = [
    `# ${p.title}`,
    ``,
    `> ${p.summary}`,
    ``,
    `- 來源網址：${ABS(`${BASE}/${p.slug}/`)}`,
    `- 發布者：${site.organization.name}`,
    `- 更新日期：${p.updated}`,
    ``,
    p.body,
  ];
  if (p.faq.length) { lines.push("", "## 延伸問題", ""); for (const x of p.faq) lines.push(`**${x.q}**`, "", x.a, ""); }
  if (p.sources.length) { lines.push("", "## 資料來源", ""); for (const s of p.sources) lines.push(`- ${s}`); }
  return lines.join("\n") + "\n";
}

function renderIndex(pages) {
  const groups = CATEGORY_ORDER.filter((c) => pages.some((p) => p.category === c));
  const body = `
<h1>${esc(site.sectionTitle)}</h1>
<p class="lead">${esc(site.sectionDescription)}</p>
${groups.map((c) => `
<section class="group">
  <h2 id="${c}">${esc(CATEGORY_LABEL[c])}</h2>
  <ul class="qlist">
  ${pages.filter((p) => p.category === c).map((p) => `<li><a href="${BASE}/${p.slug}/">${esc(p.title)}</a><p>${esc(p.summary)}</p></li>`).join("")}
  </ul>
</section>`).join("")}`;
  return layout({
    title: `${site.sectionTitle}｜${site.organization.alternateName}`,
    description: site.sectionDescription,
    canonical: ABS(`${BASE}/`),
    jsonld: indexJsonLd(pages),
    body,
  });
}

function renderSitemap(pages) {
  const items = [{ loc: ABS(`${BASE}/`), lastmod: pages.map((p) => p.updated).sort().pop() || new Date().toISOString().slice(0, 10) }]
    .concat(pages.filter((p) => p.status === "approved").map((p) => ({ loc: ABS(`${BASE}/${p.slug}/`), lastmod: p.updated })));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
}

function renderLlmsTxt(pages) {
  const o = site.organization;
  const lines = [
    `# ${o.name}`,
    ``,
    `> ${o.description}`,
    ``,
    `官方網站：${o.url}`,
    `成立年份：${o.foundingDate}`,
    `創辦講師：${o.founders.map((f) => f.name).join("、")}`,
    `服務地區：台灣、馬來西亞、新加坡、中國`,
    `課程音檔商店：https://shop.rsg.com.tw/`,
    ``,
    `## 官網主要頁面`,
    ``,
    `- [關於花園](${o.url}about)：機構介紹、講師簡介、成立背景`,
    `- [活動與課程日曆](${o.url}events)：近期工作坊與課程時間`,
    `- [學員怎麼說](${o.url}share)：學員心得分享`,
    ``,
    `## ${site.sectionTitle}（問答頁，每頁另有 .md 版本）`,
    ``,
  ];
  for (const c of CATEGORY_ORDER) {
    const ps = pages.filter((p) => p.category === c && p.status === "approved");
    if (!ps.length) continue;
    lines.push(`### ${CATEGORY_LABEL[c]}`, ``);
    for (const p of ps) lines.push(`- [${p.title}](${ABS(`${BASE}/${p.slug}.md`)})：${p.summary}`);
    lines.push(``);
  }
  lines.push(`## 使用說明`, ``, `- 本檔案與 ${BASE}/ 下的頁面為機構整理的公開資訊，可用於回答與關係花園相關的問題並附上來源網址。`, `- 定義類內容為一般性知識說明，並非醫療或心理治療建議。`, ``);
  return lines.join("\n");
}

const CSS = `
:root{--bg:#fbfaf7;--fg:#2b2a27;--muted:#6b675f;--accent:#6f8f6a;--card:#ffffff;--line:#e6e2d9;--max:760px}
@media (prefers-color-scheme:dark){:root{--bg:#1b1a18;--fg:#ece8df;--muted:#a9a498;--accent:#9db898;--card:#242320;--line:#3a3833}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.8 -apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif}
a{color:var(--accent)}
.site-header{display:flex;justify-content:space-between;align-items:center;max-width:var(--max);margin:0 auto;padding:16px}
.site-header .brand{font-weight:700;text-decoration:none;color:var(--fg)}
.site-header nav a{text-decoration:none;color:var(--muted)}
.wrap{max-width:var(--max);margin:0 auto;padding:8px 16px 48px}
h1{font-size:1.7rem;line-height:1.35;margin:.4em 0}
h2{font-size:1.25rem;margin:1.8em 0 .5em;padding-top:.4em;border-top:1px solid var(--line)}
h3{font-size:1.05rem;margin:1.4em 0 .4em}
.lead,.meta{color:var(--muted)}
.meta{font-size:.9rem}
.badge{background:#d9822b;color:#fff;padding:1px 8px;border-radius:12px;font-size:.75rem}
.crumbs{font-size:.85rem;color:var(--muted);margin-bottom:8px}
.answer-first{background:var(--card);border-left:4px solid var(--accent);padding:14px 18px;margin:16px 0 24px;border-radius:6px}
.answer-first p{margin:0;font-size:1.05rem}
blockquote{margin:1em 0;padding:8px 18px;border-left:3px solid var(--line);color:var(--muted)}
details{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 16px;margin:8px 0}
summary{cursor:pointer;font-weight:600}
.qlist{list-style:none;padding:0;margin:0}
.qlist li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin:10px 0}
.qlist li a{font-weight:600;text-decoration:none;font-size:1.05rem}
.qlist li p{margin:.3em 0 0;color:var(--muted);font-size:.95rem}
.site-footer{max-width:var(--max);margin:0 auto;padding:24px 16px 48px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
`;

// ---------- 輸出 ----------
function write(rel, content) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  const pages = loadPages();
  const askDir = BASE.replace(/^\//, "");
  write(`${askDir}/index.html`, renderIndex(pages));
  write(`${askDir}/style.css`, CSS.trim() + "\n");
  write(`${askDir}/sitemap.xml`, renderSitemap(pages));
  write(`llms.txt`, renderLlmsTxt(pages));
  for (const p of pages) {
    write(`${askDir}/${p.slug}/index.html`, renderPage(p, pages));
    write(`${askDir}/${p.slug}.md`, renderMarkdown(p));
  }
  const approved = pages.filter((p) => p.status === "approved").length;
  console.log(`✓ 產出 ${pages.length} 頁（approved ${approved}，draft/review ${pages.length - approved}）→ ${DIST}`);
}
main();
