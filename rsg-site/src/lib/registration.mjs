import { calendarEvent, todayInTaipei, visibleEvents } from './calendar.mjs';
import registrationCourses from '../data/registration-courses.json' with { type: 'json' };
import seedSessions from '../data/registration-sessions.json' with { type: 'json' };

export const registrationCourse = id => registrationCourses.find(course => course.id === id);
export const registrationCourseAtPath = path => {
  try { return registrationCourses.find(course => course.path === decodeURI(path).replace(/\/$/, '').replace(/\.html$/, '')); }
  catch { return undefined; }
};

export const CONSENT_VERSION = 'registration-2026-09-23';
export const MAIL_FROM = '關係花園｜課程報名 <registration@notify.rsg.com.tw>';
export const OFFICE_EMAIL = 'Garden@rsg.com.tw';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const money = value => typeof value === 'number' && Number.isFinite(value) ? `NT$${new Intl.NumberFormat('zh-TW', {maximumFractionDigits:0}).format(value)}` : '待課務確認';
export const sessionPrice = session => money(session.price) + (session.priceNote ? `（${session.priceNote}）` : '');
export const dateText = day => new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei', year:'numeric', month:'numeric', day:'numeric', weekday:'short'}).format(new Date(day + 'T00:00:00+08:00'));
export const datesText = session => session.dates.map(dateText).join('、');
export function sessionStatus(session, now = new Date()) {
  if (session.status && session.status !== 'open') return session.status;
  // 公布的課程日期仍有效就可申請；不另設一份提前截止時間。
  const lastDay = session.dates?.slice().sort().at(-1);
  return lastDay && lastDay >= todayInTaipei(now) ? 'open' : 'closed';
}
export function upcomingSessions(sessions, now = new Date()) {
  return sessions.filter(s => sessionStatus(s, now) === 'open').sort((a,b) => a.dates[0].localeCompare(b.dates[0]));
}
export function registrationEvents(sessions, now = new Date()) {
  return upcomingSessions(sessions, now).flatMap(s => s.dates.map(day => calendarEvent({
    title: `${s.courseTitle}・${s.label}`, href: `${s.coursePath}#course-registration`, start: day, end: day,
    allDay:true, venue:s.venue,
  })));
}

// Static calendar and Worker response share the same mapping; a cancelled or
// removed session must never reappear via the old WordPress event.
export function mergeRegistrationEvents(events, sessions, now=new Date()) {
  const replaced = new Set([...seedSessions,...sessions].flatMap(s => [s.legacyEventPath,`${s.coursePath}#course-registration`]).filter(Boolean));
  const normalized = href => { try { return decodeURI(href); } catch { return href; } };
  const legacy = events.filter(e => e && !replaced.has(normalized(e.href))).map(e => e.title === '企業外訓' ? {...e,href:'',noticeOnly:true} : e);
  return visibleEvents([...legacy,...registrationEvents(sessions,now)],now);
}

export function validateRegistration(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {errors:{form:'請重新填寫報名表。'}};
  const limits = {name:80, phone:30, email:254, line:100, referral:100, note:800};
  const data = {};
  for (const [key,max] of Object.entries(limits)) {
    data[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    if (data[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data[key])) errors[key] = '內容太長或包含不支援的字元。';
  }
  if (!data.name || /[\r\n]/.test(data.name)) errors.name = '請填寫姓名。';
  if (!/^[+\d][\d ()-]{6,29}$/.test(data.phone)) errors.phone = '請填寫有效的手機或聯絡電話。';
  data.email = data.email.toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) errors.email = '請填寫有效的 Email。';
  if (input.consent !== true || input.consentVersion !== CONSENT_VERSION) errors.consent = '請閱讀並勾選資料用途與報名說明。';
  if (typeof input.sessionId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(input.sessionId)) errors.sessionId = '請選擇課程期別。';
  if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) errors.form = '表單識別碼失效，請重新整理後再試。';
  return {data:{...data, sessionId:input.sessionId, requestId:input.requestId, consentVersion:CONSENT_VERSION}, errors};
}

// Shared HTML is used by Astro's static fallback and the Worker's D1-backed first response.
export function renderRegistration(courseId, sessions, {mode='unavailable', sitekey='', now=new Date()}={}) {
  const list = upcomingSessions(sessions.filter(s => s.courseId === courseId), now);
  const open = list.filter(s => sessionStatus(s, now) === 'open');
  const ready = ['local','test','live'].includes(mode) && open.length > 0;
  const e = escapeHtml;
  const labels = {open:'開放申請', full:'額滿', closed:'已截止', draft:'籌備中'};
  const rows = list.map(s => `<tr><th scope="row" data-label="級別／期別">${e(s.label)}<small>${e(s.level)}</small></th><td data-label="日期與時間">${s.dates.map(d=>`<time datetime="${d}">${dateText(d)}</time>`).join('')}<small>${e(s.timeLabel)}</small></td><td data-label="地點">${e(s.venue)}</td><td data-label="費用">${money(s.price)}${s.priceNote?`<small>${e(s.priceNote)}</small>`:""}</td><td data-label="報名">${sessionStatus(s,now)==='open' && ready ? `<button type="button" data-select-session="${e(s.id)}" class="registration-button">我要報名</button>` : e(sessionStatus(s,now)==='open' ? '線上報名準備中' : labels[sessionStatus(s,now)] || '暫停報名')}</td></tr>`).join('');
  const field = (name,label,type='text',required=false,max=100,autocomplete='off') => `<div class="registration-field"><label for="reg-${name}">${label}${required?' <span>（必填）</span>':' <span>（選填）</span>'}</label><input id="reg-${name}" name="${name}" type="${type}" ${required?'required':''} maxlength="${max}" autocomplete="${autocomplete}" aria-describedby="error-${name}" /><small id="error-${name}" data-error="${name}" class="registration-field-error"></small></div>`;
  return `<div data-registration data-course-id="${e(courseId)}" data-mode="${e(mode)}" data-sitekey="${e(sitekey)}">
  <section class="registration-sessions" aria-labelledby="registration-dates-title"><h2 id="registration-dates-title">課程期別與日期</h2>
  ${list.length ? `<table class="registration-table"><caption class="visually-hidden">課程期別、日期、地點與費用</caption><thead><tr><th>級別／期別</th><th>日期與時間</th><th>地點</th><th>費用</th><th>報名</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="registration-empty">新一期籌備中，歡迎聯絡課務了解後續安排。</p>'}</section>
  <section id="course-registration" class="course-registration registration-panel" aria-labelledby="registration-title" data-pagefind-ignore>
  <h2 id="registration-title">課程報名</h2><p>${open.length ? "選擇期別，留下聯絡方式，我們會與您確認後續安排。" : "新一期確認後，將在此開放報名。"}</p>
  ${mode === 'local' || mode === 'test' ? `<p class="registration-test">${mode==='local'?'本地測試｜資料只存於本機，不會寄出郵件。':'試寄模式｜資料不列入正式報名，通知只寄至指定測試信箱。'}</p>` : ''}
  ${!ready ? `<p class="registration-empty">${open.length ? '線上報名準備中，請先聯絡課務。' : '目前沒有開放申請的期別，請聯絡課務。'}</p><a href="mailto:${OFFICE_EMAIL}">${OFFICE_EMAIL}</a>` : `
  <noscript><p>請開啟 JavaScript 使用線上表單，或來信 <a href="mailto:${OFFICE_EMAIL}">${OFFICE_EMAIL}</a>。</p></noscript>
  <form data-registration-form hidden novalidate>
    <div class="registration-field"><label for="reg-session">課程期別 <span>（必填）</span></label><select id="reg-session" name="sessionId" required aria-describedby="error-sessionId"><option value="">請選擇期別</option>${open.map(s=>`<option value="${e(s.id)}">${e(s.courseTitle)}・${e(s.label)}</option>`).join('')}</select><small id="error-sessionId" data-error="sessionId" class="registration-field-error"></small></div>
    <div data-session-summary class="registration-summary" hidden></div>
    <div class="registration-fields">${field('name','姓名','text',true,80,'name')}${field('phone','手機／聯絡電話','tel',true,30,'tel')}${field('email','Email','email',true,254,'email')}${field('line','LINE ID')}${field('referral','推薦人')}</div>
    <div class="registration-field"><label for="reg-note">備註 <span>（選填）</span></label><textarea id="reg-note" name="note" rows="3" maxlength="800" aria-describedby="reg-note-help error-note"></textarea><small id="reg-note-help">可填聯絡時間等事項，請勿填寫健康、療癒議題或其他私密資料。</small><small id="error-note" data-error="note" class="registration-field-error"></small></div>
    <div class="registration-honey" aria-hidden="true"><label>公司網站<input name="website" tabindex="-1" autocomplete="off" /></label></div>
    <div class="registration-consent"><label><input name="consent" type="checkbox" required aria-describedby="error-consent" />我已閱讀並同意：以上資料僅供課程報名、聯絡及通知使用。送出代表提出申請，名額、付款方式與正式報名結果由課務另行確認。</label><small id="error-consent" data-error="consent" class="registration-field-error"></small></div>
    <div data-turnstile></div><p data-form-error class="registration-form-error" role="alert" tabindex="-1"></p>
    <button class="registration-button registration-submit" type="submit">送出報名申請 <span aria-hidden="true">→</span></button><p class="registration-help">需要協助？<a href="mailto:${OFFICE_EMAIL}">${OFFICE_EMAIL}</a> · <a href="tel:0227355500">02-2735-5500</a></p>
  </form><div data-registration-success class="registration-success" role="status" tabindex="-1" hidden></div>`}
  <script type="application/json" data-registration-sessions>${JSON.stringify(open).replace(/</g,'\\u003c')}</script>
  </section></div>`;
}

export function mailPayload(kind, registration, session, recipient, test=false) {
  const title = kind === 'student' ? '已收到您的報名申請' : '新課程報名申請';
  const body = `${test?'【測試通知，非正式報名】\n\n':''}${title}\n\n申請編號：${registration.reference}\n課程：${session.courseTitle}・${session.label}\n日期：${datesText(session)}\n時間：${session.timeLabel}\n地點：${session.venue}\n課程費用：${sessionPrice(session)}\n姓名：${registration.name}\n${kind==='office'?`電話：${registration.phone}\nEmail：${registration.email}\nLINE ID：${registration.line || '未提供'}\n推薦人：${registration.referral || '未提供'}\n`:''}\n我們已保存您的申請。此通知不代表名額或付款已確認，請等候課務與您聯絡。\n如需更正或詢問，請回覆此信並提供申請編號。\n\n關係花園\n${OFFICE_EMAIL}\n02-2735-5500`;
  return {from:MAIL_FROM, to:[recipient], reply_to:OFFICE_EMAIL, subject:`${test?'【測試】':''}${title}｜${session.courseTitle}｜${registration.reference}`, text:body,
    html:`<div style="font-family:Arial,'Microsoft JhengHei',sans-serif;max-width:620px;margin:auto;color:#2b2f56"><h1 style="font-size:24px;border-bottom:3px solid #85e1ef;padding-bottom:20px">關係花園｜${escapeHtml(title)}</h1><div style="white-space:pre-wrap;line-height:1.9">${escapeHtml(body)}</div></div>`};
}
