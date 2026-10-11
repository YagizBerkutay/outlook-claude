import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { BridgeError } from './claude.mjs';
const staticFiles=new Map([['/','taskpane.html'],['/taskpane.html','taskpane.html'],['/app.js','app.js'],['/app.css','app.css'],['/commands.html','commands.html'],...[16,32,64,80,128].map(size=>[`/assets/icon-${size}.png`,`assets/icon-${size}.png`])]);
async function body(req) {
  if(req.headers['content-type']?.split(';')[0]!=='application/json') throw new BridgeError('JSON gerekli.',415);
  let size=0; const chunks=[];
  for await(const chunk of req) { size+=chunk.length; if(size>100000) throw new BridgeError('İstek çok büyük.',413); chunks.push(chunk); }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new BridgeError('İstek okunamadı.',400);}
}
export function createAgentHandler({root,runner,backend,origin='https://localhost:3447',token=randomBytes(32).toString('hex')}) {
  const host=new URL(origin).host; let busy=false; let messages=[]; const pending=new Map();
  const visiblePlans=()=>[...pending.values()].map(({id,preview,status,error})=>({id,preview,status,error}));
  const state=()=>({messages,pending:visiblePlans(),busy});
  const lock=()=>{if(busy)throw new BridgeError('Bir görev çalışıyor. Bitmesini bekleyin.',429);busy=true;};
  return async(req,res)=>{
    const controller=new AbortController(); res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors https://*.office.com https://*.office365.com https://*.outlook.com https://*.live.com https://*.microsoft.com; object-src 'none'; base-uri 'none'");
    const send=(status,value)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}};
    try{
      if(req.headers.host!==host)throw new BridgeError('Geçersiz sunucu adresi.',403);
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/')){
        if(req.method!=='POST')throw new BridgeError('POST gerekli.',405);
        const supplied=req.headers['x-local-token'];
        if(req.headers.origin!==origin||typeof supplied!=='string'||Buffer.byteLength(supplied)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))throw new BridgeError('Paneli yenileyin. Yerel bağlantı doğrulanamadı.',403);
        const value=await body(req);
        if(url.pathname==='/api/status'){
          const [auth,mailbox]=await Promise.allSettled([runner.checkAuth(controller.signal),backend.execute('status',{},controller.signal)]);
          send(200,{auth:auth.status==='fulfilled',outlook:mailbox.status==='fulfilled',stores:mailbox.status==='fulfilled'?mailbox.value.stores:0,authError:auth.status==='rejected'?auth.reason.message:null,outlookError:mailbox.status==='rejected'?mailbox.reason.message:null});return;
        }
        if(url.pathname==='/api/state'){send(200,state());return;}
        if(url.pathname==='/api/chat'){
          if(typeof value.message!=='string'||!value.message.trim()||value.message.length>8000)throw new BridgeError('İstek 1–8000 karakter olmalı.',400);
          lock();
          try{
            const result=await runner.generate(value.message.trim(),controller.signal);
            pending.clear();for(const operation of result.pending)pending.set(operation.id,operation);
            messages.push({role:'user',text:value.message.trim()},{role:'assistant',text:result.text,tools:result.toolCalls});messages=messages.slice(-24);
            send(200,{...state(),busy:false});
          }finally{busy=false;}
          return;
        }
        if(url.pathname==='/api/apply'){
          if(!Array.isArray(value.ids)||!value.ids.length||value.ids.length>100||new Set(value.ids).size!==value.ids.length||value.ids.some(id=>!pending.has(id)||pending.get(id).status!=='pending'))throw new BridgeError('İşlem seçimi geçersiz veya daha önce uygulanmış.',400);
          lock();
          try{
            const results=[];
            for(const id of value.ids){
              if(controller.signal.aborted)break;
              const operation=pending.get(id);operation.status='applying';
              try{
                const result=await backend.execute('apply',operation.args,controller.signal);operation.status='applied';
                runner.recordApplied(operation.preview,result);results.push({id,ok:true,result});
              }catch(error){operation.status='failed';operation.error=error.message;results.push({id,ok:false,error:error.message});break;}
            }
            messages.push({role:'application',text:results.map(item=>item.ok?'İşlem Outlook’a uygulandı.':'İşlem tamamlanamadı: '+item.error).join('\n')});messages=messages.slice(-24);
            send(200,{...state(),busy:false,results});
          }finally{busy=false;}
          return;
        }
        if(url.pathname==='/api/reset'){if(busy)throw new BridgeError('Önce görevi bitirin veya iptal edin.',429);runner.reset();messages=[];pending.clear();send(200,state());return;}
        throw new BridgeError('Adres bulunamadı.',404);
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw new BridgeError('GET gerekli.',405);
      const file=staticFiles.get(url.pathname);if(!file)throw new BridgeError('Adres bulunamadı.',404);
      let content=await readFile(path.join(root,'public',file));if(file==='taskpane.html')content=Buffer.from(content.toString('utf8').replace('__LOCAL_TOKEN__',token));
      const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'image/png';
      res.writeHead(200,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){send(error instanceof BridgeError?error.status:500,{error:error instanceof BridgeError?error.message:'Yerel ajan bağlantısında hata oluştu.'});}
  };
}
