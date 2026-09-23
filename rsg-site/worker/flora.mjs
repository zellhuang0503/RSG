import { readEvents } from '../src/lib/flora-stream.mjs';

const BASE = 'https://flora.rsg.com.tw/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOKIE = 'rsg_flora';
const encoder = new TextEncoder();
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
const error = (message, status = 400) => json({ message }, status);
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const local = req => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname);
async function key(secret) { return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function sign(value, secret) { return hex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(value))); }
async function session(req, secret) {
  const cookie = req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  const [id, expiry, signature] = (cookie || '').split('.');
  if (!UUID.test(id || '') || !/^\d+$/.test(expiry || '') || Number(expiry) < Date.now() || !/^[0-9a-f]{64}$/.test(signature || '')) return null;
  const bytes = Uint8Array.from(signature.match(/../g), v => parseInt(v, 16));
  return await crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(`${id}.${expiry}`)) ? id : null;
}
async function readInput(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new Error('type');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('body');
  const parts = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 20000) { await reader.cancel(); throw new Error('size'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleFlora(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (!local(request) && !allowed.includes(url.origin)) return error('請從關係花園網站開啟 Flora。', 403);
  if (!env.DIFY_FLORA_API_KEY || !env.RATE_LIMIT_SALT || !env.REGISTRATIONS_DB) return error('Flora 暫時無法連線，請稍後再試。', 503);
  const path = url.pathname.replace(/\/$/, '');
  const id = await session(request, env.RATE_LIMIT_SALT);
  if (path === '/api/flora/session' && request.method === 'GET') {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return error('請從本站開啟 Flora。', 403);
    if (id) return json({ ready: true });
    const value = `${crypto.randomUUID()}.${Date.now() + 30 * 86400000}`;
    const cookie = `${COOKIE}=${value}.${await sign(value, env.RATE_LIMIT_SALT)}; Path=/api/flora; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol === 'https:' ? '; Secure' : ''}`;
    return json({ ready: true }, 200, { 'Set-Cookie': cookie });
  }
  if (path !== '/api/flora/chat') return error('找不到此功能。', 404);
  if (request.method !== 'POST') return error('不支援此操作。', 405);
  if (request.headers.get('origin') !== url.origin) return error('請從本站送出訊息。', 403);
  if (!id) return error('連線已過期，請重新送出訊息。', 401);
  let input;
  try { input = await readInput(request); } catch { return error('訊息格式不正確或過長。'); }
  if (!input || typeof input !== 'object' || typeof input.query !== 'string' || !input.query.trim() || input.query.length > 4000 || (input.conversationId && !UUID.test(input.conversationId))) return error('請輸入 1–4000 字的訊息。', 422);
  const ip = request.headers.get('CF-Connecting-IP') || (local(request) ? 'local' : null);
  if (!ip) return error('無法驗證連線來源。', 403);
  const now = Date.now();
  // Separate prefix from registration counters; existing expiry cleanup applies.
  for (const [window, limit] of [[60000, 12], [86400000, 120]]) {
    const bucket = 'flora:' + await sign(`${ip}|${window}|${Math.floor(now / window)}`, env.RATE_LIMIT_SALT);
    const result = await env.REGISTRATIONS_DB.prepare('INSERT INTO registration_rate_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket, now + window * 2).first();
    if (result.count > limit) return error(window === 60000 ? '訊息送出較頻繁，請稍候一分鐘再試。' : '今天的對話次數較多，請明天再試或聯絡花園。', 429);
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 90000);
  let upstream;
  try {
    upstream = await fetcher(`${BASE}/chat-messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.DIFY_FLORA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input.query.trim(), inputs: { User_name: '' }, user: `rsg-web-${id}`, conversation_id: input.conversationId || '', response_mode: 'streaming', auto_generate_name: false }),
      signal: abort.signal,
    });
  } catch { clearTimeout(timer); return error('Flora 連線暫時中斷，請稍後再試。', 503); }
  if (!upstream.ok || !upstream.body || !upstream.headers.get('content-type')?.includes('text/event-stream')) {
    clearTimeout(timer); await upstream.body?.cancel();
    return error(upstream.status === 404 ? '這段對話已失效，請按「新對話」重新開始。' : 'Flora 暫時無法回覆，請稍後再試。', upstream.status === 404 ? 409 : 503);
  }
  const iterator = readEvents(upstream.body)[Symbol.asyncIterator]();
  let done = false;
  const cleanup = () => { clearTimeout(timer); abort.abort(); };
  const stream = new ReadableStream({
    async pull(controller) {
      const emit = payload => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      try {
        while (!done) {
          const next = await iterator.next();
          if (next.done) { emit({ event: 'error', message: '回覆中斷，請重新提問或稍後再試。' }); done = true; break; }
          const data = next.value;
          const conversationId = UUID.test(data.conversation_id || '') ? data.conversation_id : undefined;
          if (['message', 'agent_message', 'message_replace'].includes(data.event) && typeof data.answer === 'string') {
            emit({ event: data.event === 'message_replace' ? 'replace' : 'message', answer: data.answer, conversationId }); return;
          }
          if (data.event === 'message_end') { emit({ event: 'done', conversationId }); done = true; }
          if (data.event === 'error') { emit({ event: 'error', message: 'Flora 暫時無法完成回覆，請稍後再試。' }); done = true; }
        }
        cleanup(); await iterator.return(); controller.close();
      } catch { cleanup(); if (!done) emit({ event: 'error', message: '連線中斷，請稍後再試。' }); controller.close(); }
    },
    async cancel() { done = true; cleanup(); await iterator.return(); },
  });
  return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' } });
}
