import https from 'node:https';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRunner } from './lib/agent.mjs';
import { OutlookBackend } from './lib/mailbox.mjs';
import { createAgentHandler } from './lib/http.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try{
  const local=path.join(root,'.local');const config=JSON.parse(readFileSync(path.join(local,'config.json'),'utf8').replace(/^\uFEFF/,''));
  const server=https.createServer({pfx:readFileSync(path.join(local,'localhost.pfx')),passphrase:config.pfxPassword},createAgentHandler({root,runner:new AgentRunner({root,config}),backend:new OutlookBackend(root)}));
  server.requestTimeout=30000;server.headersTimeout=15000;
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'3447 portu kullanımda. Önce eski test sunucusunu kapatın.':'Ajan başlatılamadı.');process.exitCode=1;});
  server.listen(3447,'127.0.0.1',()=>console.log('Outlook posta kutusu ajanı: https://localhost:3447\nKlasik Outlook ve bu pencere açık kalmalı. Durdurmak için Ctrl+C.'));
}catch(error){console.error(error.status?error.message:'Önce 1-KURULUM.cmd dosyasını çalıştırın.');process.exitCode=1;}
