// Local one-use setup form. Never log, persist, or put the API key in argv.
// Run only after the owner approves creating/transferring the Flora credential.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const path = '/setup-' + randomBytes(24).toString('hex');
const cwd = fileURLToPath(new URL('../', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
let used = false;
const server = http.createServer(async (req, res) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
  if (req.headers.host !== new URL(origin).host || req.url !== path || used) { res.writeHead(404); return res.end('Not found'); }
  if (req.method === 'GET') return res.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Flora 安全串接設定</title><style>body{font:18px sans-serif;max-width:600px;margin:60px auto;padding:20px}input{display:block;width:100%;padding:12px;margin:16px 0}button{padding:12px}</style><h1>Flora 安全串接設定</h1><p>API 金鑰只會傳送到本機設定程序，再以標準輸入交給 Cloudflare Wrangler。這個頁面不保存或回顯金鑰。</p><form method="post"><label for="key">Flora API 金鑰</label><input id="key" name="key" type="password" autocomplete="off" required><button>驗證並儲存至 Cloudflare</button></form></html>');
  if (req.method !== 'POST' || req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) { res.writeHead(403); return res.end('Forbidden'); }
  let body = '';
  try {
    for await (const chunk of req) { body += chunk; if (body.length > 4096) throw new Error('size'); }
    const secret = new URLSearchParams(body).get('key')?.trim(); body = '';
    if (!/^app-[A-Za-z0-9_-]{10,200}$/.test(secret || '')) { res.writeHead(400); return res.end('金鑰格式不正確，尚未儲存。'); }
    const check = await fetch('https://flora.rsg.com.tw/v1/parameters', { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15000) });
    if (!check.ok) { res.writeHead(400); return res.end('Flora 未接受這把金鑰，尚未儲存。'); }
    await check.body?.cancel();
    used = true;
    const child = spawn(process.execPath, [wrangler, 'secret', 'put', 'DIFY_FLORA_API_KEY', '--config', 'wrangler.jsonc'], { cwd, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    child.stdin.on('error', () => {}); child.stdin.end(secret + '\n');
    const exit = await new Promise(resolve => { child.once('exit', resolve); child.once('error', () => resolve(-1)); });
    if (exit !== 0) { res.writeHead(500); res.end('Cloudflare 設定未完成；請檢查 Wrangler 登入狀態。'); }
    else res.end('<h1>設定完成</h1><p>Flora 金鑰已驗證並存入 Cloudflare 私密設定。金鑰未寫入本機檔案。</p>');
    server.close();
  } catch { res.writeHead(500); res.end('設定未完成，未顯示任何金鑰內容。'); }
});
server.listen(0, '127.0.0.1', () => console.log(`Setup URL: http://127.0.0.1:${server.address().port}${path}`));
setTimeout(() => server.close(), 15 * 60000).unref();
