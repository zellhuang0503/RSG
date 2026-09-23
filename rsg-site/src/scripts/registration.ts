import { CONSENT_VERSION, datesText, sessionPrice } from '../lib/registration.mjs';

type Session = {id:string; courseTitle:string; label:string; dates:string[]; timeLabel:string; venue:string; price:number; priceNote?:string};
type Turnstile = {render:(el:HTMLElement,options:Record<string,unknown>)=>string; reset:(id:string)=>void};
const turnstileApi = () => (window as unknown as {turnstile?:Turnstile}).turnstile;

document.querySelectorAll<HTMLElement>('[data-registration]').forEach(root=>{
  const form=root.querySelector<HTMLFormElement>('[data-registration-form]');
  if (!form) return;
  const sessions:Session[]=JSON.parse(root.querySelector('[data-registration-sessions]')!.textContent || '[]');
  const select=form.elements.namedItem('sessionId') as HTMLSelectElement;
  const summary=form.querySelector<HTMLElement>('[data-session-summary]')!;
  const error=form.querySelector<HTMLElement>('[data-form-error]')!;
  const submit=form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const success=root.querySelector<HTMLElement>('[data-registration-success]')!;
  let requestId=crypto.randomUUID(), pending=false, widget:string|undefined, token='';
  const node=(tag:string,text:string)=>{const el=document.createElement(tag);el.textContent=text;return el;};
  function updateSummary() {
    const session=sessions.find(s=>s.id===select.value);
    summary.replaceChildren(); summary.hidden=!session;
    if (session) [session.courseTitle+'・'+session.label,datesText(session),session.timeLabel,`地點：${session.venue}　｜　費用：${sessionPrice(session)}`].forEach(text=>summary.append(node('p',text)));
  }
  form.hidden=false;
  root.querySelectorAll<HTMLButtonElement>('[data-select-session]').forEach(button=>button.addEventListener('click',()=>{
    if (pending || !success.hidden) return;
    select.value=button.dataset.selectSession!;updateSummary();
    form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    select.focus({preventScroll:true});
  }));
  select.addEventListener('change',updateSummary);
  // Keep the request identity after a network error; a retry must not create a second application.
  form.addEventListener('input',()=>{
    if (!pending) requestId=crypto.randomUUID();
  });
  if (root.dataset.sitekey) {
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
    script.onload=()=>{
      widget=turnstileApi()?.render(form.querySelector<HTMLElement>('[data-turnstile]')!,{
        sitekey:root.dataset.sitekey,action:'registration',callback:(value:string)=>{token=value;},
        'expired-callback':()=>{token='';},'error-callback':()=>{token='';error.textContent='驗證服務暫時無法載入，請重新整理或聯絡課務。';},
      });
    };
    script.onerror=()=>{error.textContent='驗證服務無法載入，請稍後再試或聯絡課務。';};document.head.append(script);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;
    error.textContent='';
    form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
    form.querySelectorAll('[data-error]').forEach(el=>el.textContent='');
    if (!form.reportValidity()) return;
    if (root.dataset.sitekey && !token) {error.textContent='請先完成人機驗證。';error.focus();return;}
    const input=new FormData(form);
    const payload={...Object.fromEntries(input),requestId,consent:input.get('consent')==='on',consentVersion:CONSENT_VERSION,turnstileToken:token};
    pending=true;submit.disabled=true;submit.textContent='正在送出…';form.setAttribute('aria-busy','true');
    // Lock edited fields during submission so the result always matches the saved payload.
    const controls=[...form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea')];
    controls.forEach(el=>el.disabled=true);
    try {
      const response=await fetch('/api/registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
      const result=await response.json();
      if (!response.ok || !result.ok) {
        error.textContent=result.message || '未能送出，請稍後再試。';
        for (const [name,message] of Object.entries(result.errors || {})) {
          const field=form.elements.namedItem(name) as HTMLElement|null;
          field?.setAttribute('aria-invalid','true');
          const label=form.querySelector<HTMLElement>(`[data-error="${CSS.escape(name)}"]`);if(label)label.textContent=String(message);
        }
        error.focus();return;
      }
      const session=sessions.find(s=>s.id===payload.sessionId)!;
      success.replaceChildren(node('h3',result.mode==='live'?'已收到您的報名申請':'測試申請已保存'));
      const reference=node('p',`申請編號：${result.reference}`);reference.className='registration-reference';success.append(reference);
      [session.courseTitle+'・'+session.label,datesText(session),`地點：${session.venue}　｜　費用：${sessionPrice(session)}`,
        result.mode==='local'?'本地測試不會寄信，也不會產生正式報名。':'通知正在安排寄送。若稍後未收到，請查看垃圾郵件；您的申請已保存，不必重新填寫。',
        '此階段尚未確認名額或付款，請等候課務聯絡。若需更正資料，請提供申請編號聯絡 Garden@rsg.com.tw。'].forEach(text=>success.append(node('p',text)));
      form.hidden=true;success.hidden=false;success.focus();
      root.querySelectorAll<HTMLButtonElement>('[data-select-session]').forEach(button=>button.disabled=true);
    } catch {
      error.textContent='目前無法確認送出結果，請保留此頁並重試。系統會核對同一筆申請，避免重複報名。';error.focus();
    } finally {
      pending=false;controls.forEach(el=>el.disabled=false);submit.disabled=false;submit.innerHTML='送出報名申請 <span aria-hidden="true">→</span>';form.removeAttribute('aria-busy');
      if(widget && !form.hidden){turnstileApi()?.reset(widget);token='';}
    }
  });
});
