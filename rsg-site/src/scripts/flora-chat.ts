import { readEvents } from '../lib/flora-stream.mjs';
type Message = { role: 'user' | 'assistant'; text: string; incomplete?: boolean };
class ChatError extends Error {}
async function responseError(response: Response) {
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = await response.json();
    if (typeof body.message === 'string') return new ChatError(body.message);
  }
  return new ChatError('Flora 暫時無法連線，請稍後再試。');
}
const root = document.querySelector<HTMLElement>('[data-flora]');
if (root) {
  const launcher = root.querySelector<HTMLButtonElement>('.flora-launcher')!;
  const panel = root.querySelector<HTMLElement>('.flora-panel')!;
  const expand = root.querySelector<HTMLButtonElement>('[data-expand]')!;
  const close = root.querySelector<HTMLButtonElement>('[data-close]')!;
  const reset = root.querySelector<HTMLButtonElement>('[data-new]')!;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const input = root.querySelector<HTMLTextAreaElement>('textarea')!;
  const sendButton = form.querySelector<HTMLButtonElement>('button')!;
  const log = root.querySelector<HTMLElement>('.flora-messages')!;
  const status = root.querySelector<HTMLElement>('.flora-status')!;
  const suggestions = root.querySelector<HTMLElement>('.flora-suggestions')!;
  const storeKey = 'rsg-flora-chat-v1';
  let messages: Message[] = [], conversationId = '', busy = false;
  function save() { try { sessionStorage.setItem(storeKey, JSON.stringify({ conversationId, messages: messages.slice(-40) })); } catch { /* Storage is optional. */ } }
  // Model output stays plain text; only HTTP(S) links become DOM elements.
  function renderText(target: HTMLElement, text: string) {
    target.replaceChildren();
    const links = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>\u3000，。；！？）]+)/g;
    let cursor = 0;
    for (const match of text.matchAll(links)) {
      target.append(document.createTextNode(text.slice(cursor, match.index)));
      const a = document.createElement('a');
      a.textContent = match[1] || match[3]; a.href = match[2] || match[3]; a.target = '_blank'; a.rel = 'noopener noreferrer';
      target.append(a); cursor = match.index! + match[0].length;
    }
    target.append(document.createTextNode(text.slice(cursor)));
  }
  function append(message: Message) {
    const node = document.createElement('div'); node.className = `flora-message flora-message--${message.role}`;
    const speaker = document.createElement('span'); speaker.className = 'flora-speaker'; speaker.textContent = message.role === 'user' ? '您' : 'Flora';
    const text = document.createElement('div'); text.className = 'flora-message-text'; renderText(text, message.text);
    node.append(speaker, text); node.dataset.incomplete = String(!!message.incomplete); log.append(node); return { node, text };
  }
  function announce(text: string, error = false) { status.textContent = text; status.dataset.error = String(error); }
  function bottom() { log.scrollTop = log.scrollHeight; }
  function toggle(open: boolean) {
    panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? '關閉 Flora 小幫手' : '開啟 Flora 小幫手');
    if (open) { input.focus({ preventScroll: true }); bottom(); } else launcher.focus({ preventScroll: true });
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
    if (saved && Array.isArray(saved.messages) && saved.messages.length <= 40) {
      messages = saved.messages.filter((m: Message) => m && ['user', 'assistant'].includes(m.role) && typeof m.text === 'string' && m.text.length <= 100000);
      conversationId = typeof saved.conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(saved.conversationId) ? saved.conversationId : '';
      messages.forEach(append); suggestions.hidden = messages.length > 0;
    }
  } catch { /* Ignore invalid tab storage. */ }
  launcher.addEventListener('click', () => toggle(panel.hidden)); close.addEventListener('click', () => toggle(false));
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); toggle(false); } });
  expand.addEventListener('click', () => {
    const expanded = panel.dataset.expanded !== 'true'; panel.dataset.expanded = String(expanded);
    expand.setAttribute('aria-pressed', String(expanded)); expand.setAttribute('aria-label', expanded ? '收合聊天視窗' : '展開聊天視窗');
    expand.title = expanded ? '收合聊天視窗' : '展開聊天視窗'; expand.textContent = expanded ? '⤡' : '⤢';
  });
  reset.addEventListener('click', () => {
    if (busy) return;
    messages = []; conversationId = ''; log.replaceChildren(); save();
    append({ role: 'assistant', text: '新的對話開始了，今天想聊些什麼？' });
    suggestions.hidden = false; announce('已開始新對話；先前紀錄仍依 Flora 服務的保存設定處理。'); input.focus();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); form.requestSubmit(); }
  });
  suggestions.querySelectorAll<HTMLButtonElement>('[data-question]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.question!; form.requestSubmit(); }));
  form.addEventListener('submit', async event => {
    event.preventDefault(); const query = input.value.trim(); if (busy || !query) return;
    if (query.length > 4000) { announce('請將訊息縮短至 4000 字以內。', true); return; }
    busy = true; sendButton.disabled = true; reset.disabled = true; suggestions.querySelectorAll('button').forEach(button => button.disabled = true);
    announce('Flora 正在思考…');
    let answer: Message | null = null, view: ReturnType<typeof append> | null = null, completed = false;
    try {
      const session = await fetch('/api/flora/session', { credentials: 'same-origin', cache: 'no-store' });
      if (!session.ok) throw await responseError(session);
      const response = await fetch('/api/flora/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, conversationId }) });
      if (!response.ok) throw await responseError(response);
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new ChatError('回覆格式異常，請稍後再試。');
      const question: Message = { role: 'user', text: query }; messages.push(question); append(question);
      answer = { role: 'assistant', text: '', incomplete: true }; messages.push(answer); view = append(answer);
      input.value = ''; suggestions.hidden = true; save(); bottom();
      for await (const data of readEvents(response.body)) {
        if (data.conversationId) conversationId = data.conversationId;
        if (data.event === 'message' || data.event === 'replace') {
          const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
          answer.text = data.event === 'replace' ? data.answer : answer.text + data.answer;
          renderText(view.text, answer.text); if (atBottom) bottom(); announce('Flora 正在回覆…'); save();
        }
        if (data.event === 'error') throw new ChatError(data.message);
        if (data.event === 'done') { completed = true; answer.incomplete = false; view.node.dataset.incomplete = 'false'; save(); }
      }
      if (!completed) throw new ChatError('回覆中斷，請稍後再試。');
      if (!answer.text) { answer.text = '這次沒有收到完整回答，請換個方式再問一次。'; renderText(view.text, answer.text); save(); }
      announce('回覆完成。');
    } catch (error) {
      announce(error instanceof ChatError ? error.message : '連線中斷，請稍後再試。', true);
      if (answer && view) { answer.text += '\n（此回覆未完成）'; renderText(view.text, answer.text); save(); if (!input.value) input.value = query; }
    } finally {
      busy = false; sendButton.disabled = false; reset.disabled = false; suggestions.querySelectorAll('button').forEach(button => button.disabled = false);
    }
  });
}
