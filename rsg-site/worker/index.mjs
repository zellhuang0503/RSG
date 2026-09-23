import { CONSENT_VERSION, OFFICE_EMAIL, escapeHtml, validateRegistration, sessionStatus, upcomingSessions, mailPayload, renderRegistration, registrationCourseAtPath, mergeRegistrationEvents } from '../src/lib/registration.mjs';
import { eventRange } from '../src/lib/calendar.mjs';
import seedSessions from '../src/data/registration-sessions.json' with { type: 'json' };

const json = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Robots-Tag':'noindex'}});
const fail = (message, status=400, errors={}) => json({ok:false, message, errors}, status);
const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const localhost = request => ['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname);
export function modeFor(env, request) {
  if (env.REGISTRATION_MODE === 'local') return localhost(request) ? 'local' : 'unavailable';
  if (env.REGISTRATION_MODE === 'test' && env.RESEND_API_KEY && env.TEST_STUDENT_EMAIL && env.TEST_OFFICE_EMAIL && (localhost(request) || (env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY))) return 'test';
  if (env.REGISTRATION_MODE === 'live' && env.RESEND_API_KEY && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.RATE_LIMIT_SALT) return 'live';
  return 'unavailable';
}
export async function getSessions(env, courseId) {
  if (!env.REGISTRATIONS_DB) return [];
  const result = await (courseId ? env.REGISTRATIONS_DB.prepare('SELECT data_json FROM course_sessions WHERE course_id = ?').bind(courseId) : env.REGISTRATIONS_DB.prepare('SELECT data_json FROM course_sessions')).all();
  return result.results.map(row=>JSON.parse(row.data_json));
}
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('type');
  if (Number(request.headers.get('content-length')) > 16384) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  let size=0, chunks=[];
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {await reader.cancel(); throw new Error('size');}
    chunks.push(value);
  }
  const all = new Uint8Array(size); let offset=0;
  for (const part of chunks) {all.set(part,offset);offset+=part.length;}
  return JSON.parse(new TextDecoder().decode(all));
}
async function existingResult(db, requestId, hash) {
  const row = await db.prepare('SELECT request_hash, reference, mode FROM registrations WHERE request_id = ?').bind(requestId).first();
  if (!row) return null;
  return row.request_hash === hash ? json({ok:true, reference:row.reference, mode:row.mode, repeated:true},200) : fail('同一筆申請內容已變更，請重新開啟表單再試。',409);
}

export async function submitRegistration(request, env, ctx, fetcher=fetch) {
  const origin = new URL(request.url).origin;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim());
  if (request.headers.get('origin') !== origin || (!localhost(request) && !allowed.includes(origin))) return fail('請從本站課程頁送出申請。',403);
  const mode = modeFor(env, request);
  if (mode === 'unavailable' || !env.REGISTRATIONS_DB) return fail('線上報名暫未開放，請聯絡課務。',503);
  let input;
  try {input=await readBody(request);} catch {return fail('資料格式不正確或內容過長。',400);}
  const {data,errors} = validateRegistration(input);
  if (Object.keys(errors).length) return fail('請確認標示的欄位。',422,errors);
  if (input.website) return fail('無法送出，請聯絡課務。',422);
  const db=env.REGISTRATIONS_DB, now=Date.now();
  const hash=await digest(JSON.stringify(data));
  const existing=await existingResult(db,data.requestId,hash);
  if (existing) return existing;
  const salt=env.RATE_LIMIT_SALT || (localhost(request)?'local-only':'');
  if (!salt) return fail('報名服務尚未設定完成。',503);
  const ip=request.headers.get('CF-Connecting-IP') || (localhost(request)?'local':null);
  if (!ip) return fail('無法驗證連線來源。',403);
  const bucket=await digest(`${salt}|${ip}|${Math.floor(now/600000)}`);
  const rate=await db.prepare('INSERT INTO registration_rate_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+1200000).first();
  if (rate.count>5) return fail('送出次數較多，請稍候 10 分鐘再試。',429);
  // Test bypass is strictly local. A public test/live deployment must verify Turnstile server-side.
  if (!localhost(request) || mode==='live') {
    if (typeof input.turnstileToken!=='string' || input.turnstileToken.length>2048 || !input.turnstileToken) return fail('請先完成人機驗證。',422);
    let verification;
    try {
      const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:input.turnstileToken,remoteip:ip}),signal:AbortSignal.timeout(10000)});
      verification=await response.json();
    } catch {return fail('驗證服務暫時無法連線，請稍後再試。',503);}
    if (!verification.success || verification.hostname!==new URL(request.url).hostname || verification.action!=='registration') return fail('人機驗證已失效，請重新驗證。',422);
  }
  const sessionRow=await db.prepare('SELECT data_json FROM course_sessions WHERE id = ?').bind(data.sessionId).first();
  const session=sessionRow && JSON.parse(sessionRow.data_json);
  if (!session || sessionStatus(session)!=='open') return fail('此期別已截止或暫停報名，請重新選擇。',409,{sessionId:'此期別目前無法申請。'});
  const id=crypto.randomUUID(), reference=`RSG-${new Date(now).toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const registration={...data,id,reference};
  const snapshot=JSON.stringify(session);
  const jobs=['student','office'].map(kind=>{
    const recipient=mode==='test' ? (kind==='student'?env.TEST_STUDENT_EMAIL:env.TEST_OFFICE_EMAIL) : kind==='student'?data.email:OFFICE_EMAIL;
    return {id:crypto.randomUUID(),kind,payload:JSON.stringify(mailPayload(kind,registration,session,recipient,mode!=='live'))};
  });
  try {
    // One D1 transaction: current-session guard, registration and both notification jobs.
    await db.batch([
      db.prepare(`INSERT INTO registrations (id,request_id,request_hash,reference,session_id,email,data_json,session_snapshot,consent_version,mode,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,? FROM course_sessions WHERE id=? AND data_json=?`).bind(id,data.requestId,hash,reference,data.sessionId,data.email,JSON.stringify(registration),snapshot,CONSENT_VERSION,mode,now,data.sessionId,snapshot),
      ...jobs.map(job=>db.prepare(`INSERT INTO notification_jobs (id,registration_id,kind,payload_json,status,next_attempt_at,created_at) SELECT ?,?,?,?, ?,?,? FROM registrations WHERE id=?`).bind(job.id,id,job.kind,job.payload,mode==='local'?'simulated':'pending',now,now,id)),
    ]);
  } catch {
    const retry=await existingResult(db,data.requestId,hash);
    if (retry) return retry;
    const duplicate=await db.prepare('SELECT id FROM registrations WHERE session_id=? AND email=? AND mode=?').bind(data.sessionId,data.email,mode).first();
    if (duplicate) return fail('此 Email 已送出本期申請。若需確認或更正，請聯絡課務，不必重複報名。',409);
    return fail('目前未能儲存申請，請稍後再試；您填寫的資料會保留在畫面上。',503);
  }
  const saved=await db.prepare('SELECT id FROM registrations WHERE id=?').bind(id).first();
  if (!saved) return fail('課程資訊剛剛更新，請重新整理後再確認。',409);
  if (mode!=='local') ctx.waitUntil(drainNotifications(env,fetcher));
  return json({ok:true,reference,mode},201);
}

export async function drainNotifications(env, fetcher=fetch) {
  if (!env.REGISTRATIONS_DB || !env.RESEND_API_KEY || !['test','live'].includes(env.REGISTRATION_MODE)) return;
  const db=env.REGISTRATIONS_DB, now=Date.now();
  await db.prepare('DELETE FROM registration_rate_limits WHERE expires_at < ?').bind(now).run();
  const {results}=await db.prepare(`SELECT id FROM notification_jobs WHERE ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<?)) ORDER BY created_at LIMIT 2`).bind(now,now).all();
  for (const candidate of results) {
    const token=crypto.randomUUID();
    const job=await db.prepare(`UPDATE notification_jobs SET status='sending',lease_until=?,lease_token=?,attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<?)) RETURNING *`).bind(now+60000,token,now,candidate.id,now,now).first();
    if (!job) continue;
    // Resend retains idempotency keys 24 h. Stop before expiry; uncertain older sends need reconciliation.
    if (now-job.first_attempt_at>=23*3600000 || job.attempts>7) {
      await db.prepare("UPDATE notification_jobs SET status='review',last_error='retry_window_expired',lease_until=NULL WHERE id=? AND lease_token=?").bind(job.id,token).run(); continue;
    }
    let error='network_uncertain', permanent=false;
    try {
      const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`rsg-registration/${job.id}`},body:job.payload_json,signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      if (response.ok && typeof result.id==='string') {
        await db.prepare("UPDATE notification_jobs SET status='accepted',provider_id=?,lease_until=NULL,last_error=NULL WHERE id=? AND lease_token=?").bind(result.id,job.id,token).run();continue;
      }
      error=`resend_http_${response.status}`;
      permanent=response.status>=400 && response.status<500 && ![408,409,429].includes(response.status);
    } catch { /* Keep only a safe error code, never provider payload or personal data. */ }
    await db.prepare('UPDATE notification_jobs SET status=?,last_error=?,next_attempt_at=?,lease_until=NULL WHERE id=? AND lease_token=?').bind(permanent?'review':'pending',error,now+Math.min(3600000,60000*2**job.attempts),job.id,token).run();
  }
}

export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url), path=url.pathname.replace(/\/$/,'');
    try {
      if (path==='/api/registrations') return request.method==='POST' ? await submitRegistration(request,env,ctx) : fail('不支援此操作。',405);
      if (path==='/api/registration/sessions' && request.method==='GET') {
        const courseId=url.searchParams.get('course');
        if (!courseId || !/^\d+$/.test(courseId)) return fail('缺少課程代碼。');
        return json({sessions:upcomingSessions(await getSessions(env,courseId)), mode:modeFor(env,request)});
      }
      if (path.startsWith('/api/')) return fail('找不到此功能。',404);
      const asset=await env.ASSETS.fetch(request);
      if (!asset.headers.get('content-type')?.includes('text/html')) return asset;
      // Match both clean and .html aliases so static files cannot show stale session data.
      const course=registrationCourseAtPath(path);
      if (course) {
        const sessions=env.REGISTRATIONS_DB ? await getSessions(env,course.id) : seedSessions.filter(s=>s.courseId===course.id);
        const content=renderRegistration(course.id,sessions,{mode:env.REGISTRATIONS_DB?modeFor(env,request):'unavailable',sitekey:env.TURNSTILE_SITE_KEY || ''});
        const response=new HTMLRewriter().on('[data-registration-root]',{element(el){el.setInnerContent(content,{html:true});}}).transform(asset);
        response.headers.set('Cache-Control','no-store'); return response;
      }
      if (path==='/events' || path==='/events.html') {
        const sessions=await getSessions(env);
        if (!env.REGISTRATIONS_DB) return asset;
        let buffer='', events=[];
        const rewriter=new HTMLRewriter().on('[data-events]',{text(chunk){
          buffer+=chunk.text;
          if (!chunk.lastInTextNode) {chunk.remove();return;}
          events=mergeRegistrationEvents(JSON.parse(buffer),sessions);
          chunk.replace(JSON.stringify(events).replace(/</g,'\\u003c'),{html:true});
        }}).on('.calendar-fallback',{element(el){
          el.setInnerContent(`<h2>即將舉辦的課程</h2><p>開啟 JavaScript 可使用月曆與月份切換。</p><ul>${events.map(e=>`<li><time datetime="${e.start}">${escapeHtml(eventRange(e))}</time>　${e.href?`<a href="${escapeHtml(e.href)}">${escapeHtml(e.title)}</a>`:escapeHtml(e.title)}</li>`).join('')}</ul>`,{html:true});
        }});
        const response=rewriter.transform(asset);response.headers.set('Cache-Control','no-store');return response;
      }
      return asset;
    } catch {
      if (path.startsWith('/api/')) return fail('服務暫時忙碌，請稍後再試。',503);
      // Never show an actionable stale form if the database is unavailable.
      return new Response('報名服務暫時忙碌，請稍後重試或聯絡 Garden@rsg.com.tw。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    }
  },
  async scheduled(_event,env,ctx) {
    ctx.waitUntil(drainNotifications(env));
    if (env.REGISTRATIONS_DB) ctx.waitUntil(env.REGISTRATIONS_DB.prepare('DELETE FROM registration_rate_limits WHERE expires_at < ?').bind(Date.now()).run());
  },
};
