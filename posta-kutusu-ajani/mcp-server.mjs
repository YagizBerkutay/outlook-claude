import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tools, MailboxEngine, OutlookBackend, fixtureFromEnvironment } from './lib/mailbox.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const jobDir=process.argv[2];
if(!jobDir||!path.isAbsolute(jobDir)) throw new Error('Private job directory required');
const known=JSON.parse(readFileSync(path.join(jobDir,'known.json'),'utf8'));
const engine=new MailboxEngine({backend:fixtureFromEnvironment()||new OutlookBackend(root),jobDir,known});
const write=value=>process.stdout.write(JSON.stringify(value)+'\n');
let chain=Promise.resolve();
createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{
  chain=chain.then(async()=>{
    let message; try{message=JSON.parse(line);}catch{return write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
    if(message.id===undefined)return;
    const reply=result=>write({jsonrpc:'2.0',id:message.id,result});
    if(message.method==='initialize')return reply({protocolVersion:message.params?.protocolVersion||'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'classic-outlook-mailbox',version:'1.0.0'}});
    if(message.method==='ping')return reply({});
    if(message.method==='tools/list')return reply({tools});
    if(message.method==='tools/call'){
      try{const result=await engine.call(message.params.name,message.params.arguments||{});return reply({content:[{type:'text',text:JSON.stringify(result)}]});}
      catch(error){return reply({isError:true,content:[{type:'text',text:error.message}]});}
    }
    write({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found'}});
  }).catch(()=>write({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Internal error'}}));
});
