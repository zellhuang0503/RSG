import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {submitRegistration,drainNotifications,modeFor} from '../worker/index.mjs';
import {validateRegistration,CONSENT_VERSION,renderRegistration,mailPayload,sessionStatus,mergeRegistrationEvents,registrationCourseAtPath,money} from '../src/lib/registration.mjs';
import {calendarEvent} from '../src/lib/calendar.mjs';
import seedSessions from '../src/data/registration-sessions.json' with {type:'json'};

let mf,db,env,session;
const pending=[];
const ctx={waitUntil:p=>pending.push(p)};
const body=(overrides={})=>({requestId:crypto.randomUUID(),sessionId:'fixture-session',name:'報名測試',phone:'0912345678',email:'student@example.com',line:'',referral:'',note:'',consent:true,consentVersion:CONSENT_VERSION,...overrides});
const request=(data,origin='http://localhost:4324')=>new Request(`${origin}/api/registrations`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
const count=async table=>(await db.prepare(`SELECT count(*) AS count FROM ${table}`).first()).count;
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'registration-tests',modules:true,script:'export default {fetch(){return new Response("fixture");}}',compatibilityDate:'2026-09-01',d1Databases:['DB']}]}));
  db=await mf.getD1Database('DB');
  for (const sql of (await readFile(new URL('../migrations/0001_registration.sql',import.meta.url),'utf8')).split(';').filter(s=>s.trim())) await db.prepare(sql).run();
});
after(async()=>{await Promise.all(pending);await mf?.dispose();});
beforeEach(async()=>{
  await Promise.all(pending);pending.length=0;
  await db.batch(['notification_jobs','registrations','course_sessions','registration_rate_limits'].map(t=>db.prepare(`DELETE FROM ${t}`)));
  session={id:'fixture-session',courseId:'7586',courseTitle:'課程 <測試>',coursePath:'/archives/7586',label:'第三期',level:'不需基礎',dates:['2099-10-17','2099-10-18'],closesAt:'2099-10-17T00:00:00+08:00',status:'open',venue:'測試地點',price:18800,timeLabel:'課務通知'};
  await db.prepare('INSERT INTO course_sessions(id,course_id,data_json) VALUES(?,?,?)').bind(session.id,session.courseId,JSON.stringify(session)).run();
  env={REGISTRATIONS_DB:db,REGISTRATION_MODE:'local'};
});
test('validates consent, phone, email and field limits; keeps leading zero',()=>{
  assert.equal(validateRegistration(body()).data.phone,'0912345678');
  const result=validateRegistration(body({consent:false,email:'bad',phone:'123',note:'a'.repeat(801)}));
  for(const field of ['consent','email','phone','note']) assert.ok(result.errors[field]);
});

test('each course displays only its own sessions; expired dates do not create forms',()=>{
  const now=new Date('2026-09-23T00:00:00+08:00');
  const html=renderRegistration('7182',seedSessions,{mode:'local',now});
  assert.match(html,/第五期（工作事業）/);assert.match(html,/NT\$14,400/);assert.match(html,/不含食宿/);
  assert.doesNotMatch(html,/意識能量工作坊/);
  const empty=renderRegistration('2059',[{...session,courseId:'2059',dates:['2025-05-17'],closesAt:'2025-05-17T00:00:00+08:00'}],{mode:'local',now});
  assert.match(empty,/新一期籌備中/);assert.doesNotMatch(empty,/<form|2025-05-17|wpcf7/);
  assert.doesNotMatch(renderRegistration('7182',seedSessions,{now}),/<form/);
});

test('calendar replaces old events without duplicates and removes cancelled/draft sessions',()=>{
  const now=new Date('2026-09-23T00:00:00+08:00'), s=seedSessions.find(s=>s.courseId==='7182');
  const legacy=calendarEvent({title:'舊活動',href:encodeURI(s.legacyEventPath),start:s.dates[0],end:s.dates[1],allDay:true});
  const other=calendarEvent({title:'其他活動',href:'/events/other',start:'2026-12-01',allDay:true});
  const events=mergeRegistrationEvents([legacy,other],[s],now);
  assert.equal(events.length,3);assert.equal(events.filter(e=>e.href===s.coursePath+'#course-registration').length,2);
  const twice=mergeRegistrationEvents(events,[s],now);assert.deepEqual(twice,events);
  for(const status of ['cancelled','draft'])assert.deepEqual(mergeRegistrationEvents([legacy,other],[{...s,status}],now),[other]);
});

test('same applicant can register for two different courses with independent snapshots',async()=>{
  const second={...session,id:'fixture-other-course',courseId:'7182',coursePath:'/archives/7182',courseTitle:'主題整合系統排列工作坊',price:14400,priceNote:'不含食宿'};
  await db.prepare('INSERT INTO course_sessions(id,course_id,data_json) VALUES(?,?,?)').bind(second.id,second.courseId,JSON.stringify(second)).run();
  assert.equal((await submitRegistration(request(body()),env,ctx)).status,201);
  assert.equal((await submitRegistration(request(body({sessionId:second.id,price:1})),env,ctx)).status,201);
  assert.equal(await count('registrations'),2);assert.equal(await count('notification_jobs'),4);
  const row=await db.prepare('SELECT session_snapshot FROM registrations WHERE session_id=?').bind(second.id).first();
  assert.equal(JSON.parse(row.session_snapshot).price,14400);
  const payload=await db.prepare("SELECT payload_json FROM notification_jobs j JOIN registrations r ON r.id=j.registration_id WHERE r.session_id=? AND j.kind='student'").bind(second.id).first();
  assert.match(JSON.parse(payload.payload_json).text,/NT\$14,400（不含食宿）/);
});
test('registration and both notification jobs commit together, using server price',async()=>{
  const res=await submitRegistration(request(body({price:1})),env,ctx);
  assert.equal(res.status,201);assert.equal(await count('registrations'),1);assert.equal(await count('notification_jobs'),2);
  const saved=await db.prepare('SELECT * FROM registrations').first();
  assert.equal(JSON.parse(saved.session_snapshot).price,18800);assert.equal(JSON.parse(saved.data_json).phone,'0912345678');
  assert.equal((await db.prepare('SELECT status FROM notification_jobs').first()).status,'simulated');
});
test('same request and concurrent retries make one registration only',async()=>{
  const data=body();
  const replies=await Promise.all(Array.from({length:3},()=>submitRegistration(request(data),env,ctx)));
  assert.deepEqual(replies.map(r=>r.status).sort(),[200,200,201]);
  const references=await Promise.all(replies.map(async r=>(await r.json()).reference));
  assert.equal(new Set(references).size,1);assert.equal(await count('registrations'),1);assert.equal(await count('notification_jobs'),2);
});
test('a notification write failure rolls back the registration transaction',async()=>{
  await db.prepare("CREATE TRIGGER fail_fixture_job BEFORE INSERT ON notification_jobs BEGIN SELECT RAISE(ABORT, 'fixture failure'); END").run();
  try {
    assert.equal((await submitRegistration(request(body()),env,ctx)).status,503);
    assert.equal(await count('registrations'),0);assert.equal(await count('notification_jobs'),0);
  } finally {await db.prepare('DROP TRIGGER fail_fixture_job').run();}
});
test('a session changed between validation and save cannot produce a stale application',async()=>{
  const guarded={...env,REGISTRATIONS_DB:{prepare:sql=>db.prepare(sql),batch:async statements=>{
    await db.prepare('UPDATE course_sessions SET data_json=?').bind(JSON.stringify({...session,status:'closed'})).run();return db.batch(statements);
  }}};
  assert.equal((await submitRegistration(request(body()),guarded,ctx)).status,409);
  assert.equal(await count('registrations'),0);
});
test('duplicate email in a new request rejected; mismatched idempotency body rejected',async()=>{
  const data=body();await submitRegistration(request(data),env,ctx);
  assert.equal((await submitRegistration(request(body()),env,ctx)).status,409);
  assert.equal((await submitRegistration(request({...data,name:'變更姓名'}),env,ctx)).status,409);
});
test('closed, cancelled, full, missing sessions cannot register',async()=>{
  for (const status of ['closed','cancelled','full']) {
    await db.prepare('UPDATE course_sessions SET data_json=?').bind(JSON.stringify({...session,status})).run();
    assert.equal((await submitRegistration(request(body()),env,ctx)).status,409);
  }
  assert.equal((await submitRegistration(request(body({sessionId:'missing'})),env,ctx)).status,409);
  assert.equal(await count('registrations'),0);
});
test('published dates remain open through the last Taipei day, without a separate deadline',()=>{
  const s={...session,dates:['2026-10-17','2026-10-18'],closesAt:'2026-10-17T00:00:00+08:00'};
  assert.equal(sessionStatus(s,new Date('2026-10-17T00:00:00+08:00')),'open');
  assert.equal(sessionStatus(s,new Date('2026-10-18T23:59:59+08:00')),'open');
  assert.equal(sessionStatus(s,new Date('2026-10-19T00:00:00+08:00')),'closed');
  const html=renderRegistration('7586',[{...session,dates:['2020-01-01']}],{mode:'local'});
  assert.ok(!html.includes('data-select-session'));assert.ok(html.includes('新一期籌備中'));
});

test('calendar and date table use the same published sessions; corporate notices have no link',()=>{
  const now=new Date('2026-09-23T00:00:00+08:00');
  const notice=calendarEvent({title:'企業外訓',href:'/events/企業外訓-37',start:'2026-11-02',end:'2026-11-04',allDay:true});
  const events=mergeRegistrationEvents([notice],seedSessions,now);
  assert.equal(events.find(e=>e.title==='企業外訓').href,'');
  for(const s of seedSessions){
    assert.ok(events.some(e=>e.href===s.coursePath+'#course-registration'));
    assert.ok(renderRegistration(s.courseId,seedSessions,{mode:'local',now}).includes(`data-select-session="${s.id}"`));
  }
  for(const status of ['draft','cancelled','full','closed']){
    assert.equal(mergeRegistrationEvents([],[{...session,status}],now).length,0);
    assert.doesNotMatch(renderRegistration(session.courseId,[{...session,status}],{mode:'local',now}),/<form|data-select-session=/);
  }
  const december=seedSessions.find(s=>s.courseId==='7579');
  assert.equal(registrationCourseAtPath(encodeURI(december.coursePath)+'.html').id,'7579');
  assert.equal(money(null),'待課務確認');
  assert.doesNotMatch(renderRegistration('7579',seedSessions,{mode:'local',now}),/NT\$0/);
});

test('server rejects past sessions even when an old record says open',async()=>{
  await db.prepare('UPDATE course_sessions SET data_json=?').bind(JSON.stringify({...session,dates:['2020-01-01']})).run();
  assert.equal((await submitRegistration(request(body()),env,ctx)).status,409);
  assert.equal(await count('registrations'),0);
});
test('local mode cannot run at public hostname; unknown origin and oversized body rejected',async()=>{
  assert.equal(modeFor(env,request(body(),'https://rsg.com.tw')),'unavailable');
  const forged=request(body());forged.headers.set('Origin','https://attacker.example');
  assert.equal((await submitRegistration(forged,env,ctx)).status,403);
  assert.equal((await submitRegistration(request(body({note:'x'.repeat(17000)})),env,ctx)).status,400);
});
test('public test mode validates Turnstile hostname/action and fails closed',async()=>{
  const pub={...env,REGISTRATION_MODE:'test',RESEND_API_KEY:'fixture',TEST_STUDENT_EMAIL:'test@example.com',TEST_OFFICE_EMAIL:'office@example.com',TURNSTILE_SECRET_KEY:'fixture',TURNSTILE_SITE_KEY:'fixture',RATE_LIMIT_SALT:'fixture',ALLOWED_ORIGINS:'https://rsg.com.tw'};
  const req=request(body({turnstileToken:'fixture'}),'https://rsg.com.tw');req.headers.set('CF-Connecting-IP','192.0.2.1');
  const res=await submitRegistration(req,pub,ctx,async()=>Response.json({success:true,hostname:'attacker.example',action:'registration'}));
  assert.equal(res.status,422);assert.equal(await count('registrations'),0);
});
test('rate limit rejects repeated new attempts',async()=>{
  for(let i=0;i<5;i++) await submitRegistration(request(body({sessionId:'missing'})),env,ctx);
  assert.equal((await submitRegistration(request(body({email:'next@example.com'})),env,ctx)).status,429);
});
test('mail failure retains registration, retries same payload/idempotency and records accepted only',async()=>{
  await submitRegistration(request(body()),env,ctx);
  await db.prepare("UPDATE notification_jobs SET status='pending'").run();
  const sendEnv={...env,REGISTRATION_MODE:'test',RESEND_API_KEY:'fixture'};
  const attempts=[];
  await drainNotifications(sendEnv,async(url,options)=>{attempts.push(options);throw new Error('timeout');});
  assert.equal(await count('registrations'),1);assert.equal(attempts.length,2);
  assert.equal((await db.prepare('SELECT status FROM notification_jobs').first()).status,'pending');
  await db.prepare('UPDATE notification_jobs SET next_attempt_at=0').run();
  await drainNotifications(sendEnv,async(url,options)=>{attempts.push(options);return Response.json({id:'provider-fixture'});});
  assert.equal(attempts[0].body,attempts[2].body);assert.equal(attempts[0].headers['Idempotency-Key'],attempts[2].headers['Idempotency-Key']);
  assert.equal((await db.prepare('SELECT status FROM notification_jobs').first()).status,'accepted');
});
test('stale uncertain mail jobs stop before 24-hour idempotency expiry',async()=>{
  await submitRegistration(request(body()),env,ctx);
  await db.prepare("UPDATE notification_jobs SET status='pending',first_attempt_at=?,next_attempt_at=0").bind(Date.now()-24*3600000).run();
  let sent=0;await drainNotifications({...env,REGISTRATION_MODE:'test',RESEND_API_KEY:'fixture'},async()=>{sent++;return Response.json({id:'never'});});
  assert.equal(sent,0);assert.equal((await db.prepare('SELECT status FROM notification_jobs').first()).status,'review');
});
test('concurrent notification drains claim each job once',async()=>{
  await submitRegistration(request(body()),env,ctx);
  await db.prepare("UPDATE notification_jobs SET status='pending'").run();
  let sent=0;const mock=async()=>{sent++;return Response.json({id:crypto.randomUUID()});};
  const config={...env,REGISTRATION_MODE:'test',RESEND_API_KEY:'fixture'};
  await Promise.all([drainNotifications(config,mock),drainNotifications(config,mock)]);assert.equal(sent,2);
});
test('test recipient override applies to both jobs; HTML escapes user input',async()=>{
  const data=body({name:'<img src=x onerror=alert(1)>'});
  const testEnv={...env,REGISTRATION_MODE:'test',RESEND_API_KEY:'fixture',TEST_STUDENT_EMAIL:'approved@example.com',TEST_OFFICE_EMAIL:'office@example.com'};
  const res=await submitRegistration(request(data),testEnv,ctx,async()=>Response.json({id:'fixture'}));
  assert.equal(res.status,201);await Promise.all(pending);
  const {results}=await db.prepare('SELECT payload_json FROM notification_jobs ORDER BY kind').all();
  assert.deepEqual(results.map(r=>JSON.parse(r.payload_json).to[0]),['office@example.com','approved@example.com']);
  assert.ok(results.every(r=>!JSON.parse(r.payload_json).html.includes('<img')));
  const mail=mailPayload('student',{...data,reference:'RSG-TEST'},session,'approved@example.com',true);
  assert.equal(mail.reply_to,'Garden@rsg.com.tw');assert.ok(mail.subject.startsWith('【測試】'));
});
