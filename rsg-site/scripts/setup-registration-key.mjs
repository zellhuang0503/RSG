// One-use loopback form: transfers an explicitly approved Resend key without printing it.
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const host='127.0.0.1:4325', token=randomBytes(32).toString('hex');
const lifetimeMs=60*60*1000;
const expiresLabel=new Date(Date.now()+lifetimeMs).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
let saved=false;
const server=createServer(async(req,res)=>{
  // Same-origin form POSTs need their Origin header for the strict check below.
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'",'Referrer-Policy':'same-origin'};
  if(req.headers.host!==host){res.writeHead(403,headers);res.end('Forbidden');return;}
  if(req.method==='GET' && req.url==='/'){
    res.writeHead(200,headers);res.end(`<h1>RSG 寄信測試密鑰設定</h1><p>只寫入本機 .dev.vars，不上傳到 Git，不部署正式站。</p><p>此設定頁可使用至 ${expiresLabel}（台灣時間）；成功保存後會自動關閉服務。</p><form action="/save" method="post"><input type="hidden" name="token" value="${token}"><label for="key">Resend API Key</label><input id="key" name="key" type="password" autocomplete="new-password" required><button type="submit">安全保存到本機</button></form>`);return;
  }
  if(req.method!=='POST' || req.url!=='/save' || req.headers.origin!==`http://${host}` || saved){res.writeHead(403,headers);res.end('<h1>未保存密鑰</h1><p>這次請求未通過來源驗證，或此設定頁已失效。</p><p><a href="/">回到設定頁重新輸入</a></p>');return;}
  try {
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw new Error('oversize');}
    const data=new URLSearchParams(body), key=data.get('key') || '';
    if(data.get('token')!==token || !/^re_[A-Za-z0-9_-]{20,200}$/.test(key))throw new Error('invalid');
    const value=`REGISTRATION_MODE=test\nRESEND_API_KEY=${key}\nTEST_STUDENT_EMAIL=zell.huang@gmail.com\nTEST_OFFICE_EMAIL=Garden@rsg.com.tw\nRATE_LIMIT_SALT=${randomBytes(32).toString('hex')}\n`;
    await writeFile(new URL('../.dev.vars',import.meta.url),value,{flag:'wx',mode:0o600});
    saved=true;res.writeHead(200,headers);res.end('<h1>已安全保存</h1><p>密鑰沒有顯示在頁面或記錄中。可以關閉此頁。</p>');
    console.log('RSG test secret saved (value hidden).');server.close();
  }catch{res.writeHead(400,headers);res.end('<h1>未寫入</h1><p>資料格式不符，或設定檔已存在；請勿重複建立金鑰。</p>');}
});
server.listen(4325,'127.0.0.1',()=>console.log('One-use key setup: http://127.0.0.1:4325/'));
setTimeout(()=>{console.log('Key setup expired after 60 minutes.');server.close();},lifetimeMs).unref();
