import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { findClaude, runProcess, parseAuth, BridgeError } from './claude.mjs';
import { tools, MailboxEngine } from './mailbox.mjs';
const toolNames=tools.map(tool=>'mcp__outlook__'+tool.name);
export function agentArgs({root,mcpPath}) {
 // Safe mode disables MCP, so the mailbox agent uses restricted mode instead.
 // Built-in tools are disabled; only our explicit staging/read MCP tools are allowed.
 return ['--restricted','-p','--output-format','stream-json','--verbose',
  '--tools','','--allowedTools',toolNames.join(','),
  '--strict-mcp-config','--mcp-config',mcpPath,'--setting-sources','',
  '--settings',JSON.stringify({disableAllHooks:true,disableAutoMemory:true,disableClaudeAiMcpServers:true}),
  '--disable-slash-commands','--permission-mode','dontAsk','--no-chrome',
  '--no-session-persistence','--max-turns','40','--system-prompt-file',path.join(root,'system-prompt.txt')];
}
export function parseAgentOutput(response) {
 if(response.code!==0)throw new BridgeError('Claude görevi tamamlayamadı. Abonelik oturumu, limit ve Outlook bağlantısını kontrol edin.');
 let events;try{events=response.output.split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line));}catch{throw new BridgeError('Claude yanıtı okunamadı. Claude Code uygulamasını güncelleyin.');}
 const init=events.find(event=>event.type==='system'&&event.subtype==='init');
 const finish=events.filter(event=>event.type==='result').at(-1);
 if(!init||!finish||finish.is_error||finish.subtype!=='success'||events.some(event=>event.type==='error'))throw new BridgeError('Claude görevi tamamlanmadı. CLI sürümünü ve bağlantıyı kontrol edin.');
 if(init.mcp_server_errors?.length||!init.mcp_servers?.some(server=>server.name==='outlook'&&server.status==='connected'))throw new BridgeError('Claude, Outlook araçlarına bağlanamadı. 4-TANI.cmd dosyasını çalıştırın.');
 if(init.mcp_servers.some(server=>server.name!=='outlook'))throw new BridgeError('Beklenmeyen MCP bağlantısı tespit edildi. Sonuç kullanılmadı.');
 // EndConversation is a harmless built-in ending tool that current CLI keeps with MCP.
 if(!Array.isArray(init.tools)||init.tools.some(name=>!toolNames.includes(name)&&name!=='EndConversation'))throw new BridgeError('Posta araçları dışında bir araç açıldı. Sonuç kullanılmadı.');
 if(finish.permission_denials?.length)throw new BridgeError('Claude araç izni alamadı. CLI sürümünü ve kurum politikasını kontrol edin.');
 const calls=new Map();
 for(const event of events){
  for(const block of event.message?.content||[]){
   if(block.type==='tool_use'){
    if(block.name==='EndConversation')continue;
    if(!toolNames.includes(block.name))throw new BridgeError('Posta araçları dışında bir işlem tespit edildi. Sonuç kullanılmadı.');
    calls.set(block.id,{name:block.name.slice('mcp__outlook__'.length),status:'completed'});
   }
   if(block.type==='tool_result'&&block.is_error&&calls.has(block.tool_use_id))calls.get(block.tool_use_id).status='failed';
  }
 }
 if(typeof finish.result!=='string'||!finish.result.trim())throw new BridgeError('Claude boş yanıt verdi.');
 return {text:finish.result.trim(),toolCalls:[...calls.values()]};
}
export class AgentRunner {
 constructor({root,config,processRunner=runProcess}){this.root=root;this.config=config;this.executable=findClaude(config);this.processRunner=processRunner;this.known=[];this.history=[];this.jobs=new Set();this.runtimeDir=path.join(root,'.local/runtime');mkdirSync(this.runtimeDir,{recursive:true});}
 async checkAuth(signal){return parseAuth(await this.processRunner(this.executable,['auth','status'],{cwd:this.runtimeDir,signal,timeoutMs:20000}));}
 async generate(instruction,signal){
  await this.checkAuth(signal);
  const jobDir=path.join(this.root,'.local/jobs',randomUUID());mkdirSync(jobDir,{recursive:true});this.jobs.add(jobDir);
  const seed=this.known.map(({body,attachments,recipients,...item})=>({...item,fullRead:false}));
  writeFileSync(path.join(jobDir,'known.json'),JSON.stringify(seed));writeFileSync(path.join(jobDir,'pending.json'),'[]');
  const mcpPath=path.join(jobDir,'mcp.json');
  const outlook={type:'stdio',command:this.config.nodeExecutable||process.execPath,args:[path.join(this.root,'mcp-server.mjs'),jobDir]};
  if(process.env.OUTLOOK_AGENT_TEST_FIXTURE)outlook.env={OUTLOOK_AGENT_TEST_FIXTURE:process.env.OUTLOOK_AGENT_TEST_FIXTURE};
  writeFileSync(mcpPath,JSON.stringify({mcpServers:{outlook}}));
  const input=JSON.stringify({current_human_request:instruction,local_time:new Date().toISOString(),conversation_history:this.history.slice(-12),untrusted_known_items:seed.slice(-100).map(({nativeId,nativeStoreId,...item})=>item)});
  try{
   const output=await this.processRunner(this.executable,agentArgs({root:this.root,mcpPath}),{cwd:this.runtimeDir,input,signal,timeoutMs:480000});
   const result=parseAgentOutput(output);
   this.known=JSON.parse(readFileSync(path.join(jobDir,'known.json'),'utf8')).slice(-600);
   const pending=JSON.parse(readFileSync(path.join(jobDir,'pending.json'),'utf8'));
   this.history.push({role:'user',text:instruction},{role:'assistant',text:result.text.slice(0,12000)});this.history=this.history.slice(-12);
   return {...result,pending};
  }finally{
   const jobsRoot=path.resolve(this.root,'.local/jobs');
   if(path.dirname(path.resolve(jobDir))===jobsRoot)rmSync(jobDir,{recursive:true,force:true});
   this.jobs.delete(jobDir);
  }
 }
 recordApplied(preview,result){let visible=result;if(result.id&&result.storeId){const engine=new MailboxEngine({known:this.known});visible=engine.register({messages:[result]},'list_messages');this.known=[...engine.known.values()];}else{const {id,storeId,...safe}=result;visible=safe;}this.history.push({role:'application',text:JSON.stringify({approved_operation:preview,result:visible})});this.history=this.history.slice(-12);}
 reset(){this.known=[];this.history=[];}
}
