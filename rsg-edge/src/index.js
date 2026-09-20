/**
 * rsg-edge：關係花園 Cloudflare Worker
 *
 * 兩種部署模式（由 wrangler.jsonc 的 vars.DEPLOY_MODE 決定）：
 *
 *  subdir    主站 rsg.com.tw 走橘色雲，Worker 掛在 rsg.com.tw/* 路由上。
 *            - www.rsg.com.tw → 301 到 rsg.com.tw
 *            - /ask/*、/llms.txt → 由本 Worker 的靜態資產回應（rsg-ask/dist）
 *            - /robots.txt → 取 WordPress 原本內容，追加 /ask/sitemap.xml
 *            - 其他路徑 → 原封不動轉給 WordPress；若 INJECT_ORG_SCHEMA=true，
 *              在 HTML <head> 末端加入 Organization JSON-LD（對訪客不可見）
 *
 *  subdomain 主站維持灰色雲不變，Worker 綁在 ask.rsg.com.tw 自訂網域上，
 *            只提供靜態資產，不碰 WordPress。
 */
import site from "../../rsg-ask/site.config.json";

// /.well-known/ 必須直通：cPanel AutoSSL（Let's Encrypt）續約靠 /.well-known/acme-challenge/ 驗證
const PASSTHROUGH_PREFIXES = ["/.well-known", "/wp-admin", "/wp-login.php", "/wp-json", "/wp-cron.php", "/xmlrpc.php", "/wp-content", "/wp-includes"];

function orgJsonLd() {
  const o = site.organization;
  return {
    "@context": "https://schema.org",
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
const ORG_SCRIPT = `<script type="application/ld+json">${JSON.stringify(orgJsonLd())}</script>`;

function withHeaders(res, extra) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
  return r;
}

async function handleSubdir(request, env) {
  const url = new URL(request.url);
  const base = site.basePath.replace(/\/$/, "");

  // 1. www → 非 www（301，保留路徑與查詢字串）
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }

  const p = url.pathname;

  // 1b. 憑證驗證與 WordPress 系統路徑：完全不處理，直接給原站
  if (PASSTHROUGH_PREFIXES.some((x) => p.startsWith(x))) return fetch(request);

  // 2. 子目錄站與 llms.txt：由靜態資產回應
  if (p === "/llms.txt" || p === base || p.startsWith(base + "/")) {
    const res = await env.ASSETS.fetch(request);
    return withHeaders(res, { "x-rsg-edge": "assets" });
  }

  // 3. robots.txt：保留 WordPress 原本內容，追加子目錄站 sitemap
  if (p === "/robots.txt") {
    const origin = await fetch(request);
    let text = origin.ok ? await origin.text() : "User-agent: *\nAllow: /\n";
    const sitemapLine = `Sitemap: ${site.siteUrl}${base}/sitemap.xml`;
    if (!text.includes(sitemapLine)) text = text.trimEnd() + "\n\n# rsg-edge\n" + sitemapLine + "\n";
    return new Response(text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600", "x-rsg-edge": "robots" },
    });
  }

  // 4. 其他一律轉給 WordPress
  const res = await fetch(request);
  const inject = String(env.INJECT_ORG_SCHEMA).toLowerCase() === "true";
  const isHtml = (res.headers.get("content-type") || "").includes("text/html");
  const skip = PASSTHROUGH_PREFIXES.some((x) => p.startsWith(x)) || request.method !== "GET";
  if (!inject || !isHtml || skip || res.status !== 200) return res;

  // 5. 只加不改：在 <head> 末端附加 Organization JSON-LD
  return new HTMLRewriter()
    .on("head", { element(el) { el.append(ORG_SCRIPT, { html: true }); } })
    .transform(withHeaders(res, { "x-rsg-edge": "schema" }));
}

async function handleSubdomain(request, env) {
  const res = await env.ASSETS.fetch(request);
  return withHeaders(res, { "x-rsg-edge": "assets" });
}

export default {
  async fetch(request, env) {
    try {
      return env.DEPLOY_MODE === "subdomain" ? await handleSubdomain(request, env) : await handleSubdir(request, env);
    } catch (err) {
      // Worker 出錯時絕不能讓官網掛掉：直接透傳給原站
      return fetch(request);
    }
  },
};
