import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleFlora } from '../worker/flora.mjs';
import worker from '../worker/index.mjs';
import { readEvents } from '../src/lib/flora-stream.mjs';
let mf, db, env, cookie;
const origin = 'https://rsg.cloundflare1.workers.dev';
const conversation = '2e8436dc-c3b9-4df3-ad5d-4faf1fceb0cc';
const req = (data, overrides = {}) => new Request(origin + '/api/flora/chat', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...overrides }, body: JSON.stringify(data) });
const events = (items, split = false) => {
  const bytes = new TextEncoder().encode(items.map(item => `data: ${JSON.stringify(item)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream({ start(c) { if (split) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); } else c.enqueue(bytes); c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
};
const complete = () => events([{ event: 'message', answer: '您好🌸', conversation_id: conversation }, { event: 'message_end', conversation_id: conversation }]);
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'flora-tests', modules: true, script: 'export default {fetch(){return new Response("test");}}', compatibilityDate: '2026-09-01', d1Databases: ['DB'] }] }));
  db = await mf.getD1Database('DB');
  await db.exec('CREATE TABLE registration_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
});
beforeEach(async () => {
  await db.exec('DELETE FROM registration_rate_limits');
  env = { DIFY_FLORA_API_KEY: 'test-only-never-real', RATE_LIMIT_SALT: 'test-session-signing-secret', REGISTRATIONS_DB: db, ALLOWED_ORIGINS: origin };
  const session = await handleFlora(new Request(origin + '/api/flora/session'), env);
  assert.equal(session.status, 200); cookie = session.headers.get('set-cookie').split(';')[0];
  assert.match(session.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.match(session.headers.get('set-cookie'), /Secure/);
});
after(async () => { await mf.dispose(); });

test('SSE preserves Chinese and emoji split at every byte with CRLF boundaries', async () => {
  const items = [{ event: 'message', answer: '您好🌸' }, { event: 'message_end' }];
  assert.deepEqual(await Array.fromAsync(readEvents(events(items, true).body)), items);
});
test('server credentials and signed anonymous identity stay server-side; filters metadata', async () => {
  let sent;
  const response = await handleFlora(req({ query: '課程', user: 'spoofed', inputs: { admin: true }, conversationId: conversation }), env, async (url, options) => {
    assert.equal(url, 'https://flora.rsg.com.tw/v1/chat-messages'); sent = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer test-only-never-real');
    return events([{ event: 'agent_thought', thought: 'private reasoning' }, { event: 'message', answer: '您好🌸', conversation_id: conversation }, { event: 'message_end', conversation_id: conversation, metadata: { private: 'secret sources' } }], true);
  });
  const text = await response.text();
  assert.equal(sent.user, 'rsg-web-' + cookie.split('=')[1].split('.')[0]);
  assert.equal(sent.conversation_id, conversation); assert.deepEqual(sent.inputs, { User_name: '' });
  assert.match(text, /您好🌸/); assert.match(text, /"event":"done"/);
  assert.doesNotMatch(text, /private reasoning|secret sources|test-only-never-real|metadata/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('forged cookie, missing cookie and foreign origin cannot invoke model', async () => {
  const forbidden = () => { throw new Error('must not call model'); };
  for (const Cookie of ['', cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a')]) assert.equal((await handleFlora(req({ query: 'hello' }, { Cookie }), env, forbidden)).status, 401);
  assert.equal((await handleFlora(req({ query: 'hello' }, { Origin: 'https://other.example' }), env, forbidden)).status, 403);
});
test('validates message and conversation id; rejects oversized streamed body', async () => {
  for (const data of [{}, { query: '' }, { query: 'a'.repeat(4001) }, { query: 'ok', conversationId: '../../other' }, null]) assert.equal((await handleFlora(req(data), env)).status, 422);
  assert.equal((await handleFlora(req({ query: 'a'.repeat(21000) }), env)).status, 400);
});
test('rate limit counts persist in D1 and do not reach model after threshold', async () => {
  let calls = 0;
  for (let n = 0; n < 13; n++) {
    const r = await handleFlora(req({ query: 'test' }), env, async () => { calls++; return complete(); });
    assert.equal(r.status, n < 12 ? 200 : 429); await r.text();
  }
  assert.equal(calls, 12);
});
test('upstream failures and incomplete streams are errors, never false success or leaked secrets', async () => {
  const failed = await handleFlora(req({ query: 'test' }), env, async () => new Response('internal API key and stack', { status: 500 }));
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /API key|stack/);
  const partial = await handleFlora(req({ query: 'test' }), env, async () => events([{ event: 'message', answer: '部分' }]));
  const text = await partial.text(); assert.match(text, /"event":"error"/); assert.doesNotMatch(text, /"event":"done"/);
  const remoteError = await handleFlora(req({ query: 'test' }), env, async () => events([{ event: 'error', message: 'secret provider info' }]));
  assert.doesNotMatch(await remoteError.text(), /secret provider info/);
});
test('worker route fails safely without API key; unrelated API still retains original behavior', async () => {
  const noKey = { ...env }; delete noKey.DIFY_FLORA_API_KEY;
  assert.equal((await worker.fetch(new Request(origin + '/api/flora/session'), noKey, {})).status, 503);
  assert.equal((await worker.fetch(new Request(origin + '/api/unknown'), noKey, {})).status, 404);
});
