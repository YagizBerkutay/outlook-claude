import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {AgentRunner,agentArgs,parseAgentOutput} from '../lib/agent.mjs';import {parseAuth,subscriptionEnvironment} from '../lib/claude.mjs';import {tools} from '../lib/mailbox.mjs';import {openMcp} from './mcp-client.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const names=tools.map(tool=>'mcp__outlook__'+tool.name);
const init=()=>({type:'system',subtype:'init',tools:[...names,'EndConversation'],mcp_servers:[{name:'outlook',status:'connected'}]});
const result=()=>({type:'result',subtype:'success',is_error:false,result:'Taslak hazır; onay bekliyor.',permission_denials:[]});
const response=events=>({code:0,output:events.map(event=>JSON.stringify(event)).join('\n')});
test('CLI disables built-ins, isolates MCP and uses permission-approved mailbox tools only',()=>{
 const args=agentArgs({root,mcpPath:'C:/private/mcp.json'});assert.ok(args.includes('--restricted'));assert.ok(!args.includes('--safe-mode'));assert.equal(args[args.indexOf('--tools')+1],'');assert.equal(args[args.indexOf('--permission-mode')+1],'dontAsk');assert.equal(args[args.indexOf('--allowedTools')+1],names.join(','));assert.ok(args.includes('--no-session-persistence'));assert.ok(args.includes('--strict-mcp-config'));
});
test('authentication requires native subscription rather than API, Console, injected token or provider',()=>{
 assert.equal(parseAuth({code:0,output:JSON.stringify({loggedIn:true,authMethod:'claude.ai'})}).authMethod,'claude.ai');
 for(const authMethod of ['api_key','api_key_helper','third_party','oauth_token','none'])assert.throws(()=>parseAuth({code:0,output:JSON.stringify({loggedIn:true,authMethod})}),/aboneliğiyle/);
 assert.throws(()=>parseAuth({code:1,output:'{}'}),/giriş/);
 const before={ANTHROPIC_API_KEY:'not-a-real-key',CLAUDE_CODE_OAUTH_TOKEN:'fake',CLAUDE_CODE_SAFE_MODE:'1',CLAUDE_CODE_SIMPLE:'1',PATH:'keep',SystemRoot:'C:/Windows'};
 const env=subscriptionEnvironment(before);assert.equal(env.ANTHROPIC_API_KEY,undefined);assert.equal(env.CLAUDE_CODE_SAFE_MODE,undefined);assert.equal(env.CLAUDE_CODE_SIMPLE,undefined);assert.equal(env.ENABLE_TOOL_SEARCH,'false');assert.equal(env.PATH,'keep');assert.equal(before.ANTHROPIC_API_KEY,'not-a-real-key');
});
test('stream parser preserves tool results and refuses unexpected tools or servers',()=>{
 const assistant={type:'assistant',message:{content:[{type:'tool_use',id:'t1',name:'mcp__outlook__list_messages',input:{}}]}};
 const parsed=parseAgentOutput(response([init(),assistant,{type:'user',message:{content:[{type:'tool_result',tool_use_id:'t1',is_error:true,content:'Example error'}]}},result()]));assert.equal(parsed.toolCalls[0].status,'failed');
 const bad=init();bad.tools.push('Bash');assert.throws(()=>parseAgentOutput(response([bad,result()])),/araç açıldı/);
 const other=init();other.mcp_servers.push({name:'other',status:'connected'});assert.throws(()=>parseAgentOutput(response([other,result()])),/Beklenmeyen/);
 const call=structuredClone(assistant);call.message.content[0].name='mcp__other__apply';assert.throws(()=>parseAgentOutput(response([init(),call,result()])),/işlem tespit/);
});
test('failed, incomplete, denied and malformed streams cannot expose pending changes',()=>{
 assert.throws(()=>parseAgentOutput({code:1,output:''}),/tamamlayamadı/);
 assert.throws(()=>parseAgentOutput({code:0,output:'broken'}),/okunamadı/);
 assert.throws(()=>parseAgentOutput(response([init()])),/tamamlanmadı/);
 const denied=result();denied.permission_denials=[{tool_name:'mcp__outlook__list_messages'}];assert.throws(()=>parseAgentOutput(response([init(),denied])),/araç izni/);
 const disconnected=init();disconnected.mcp_servers[0].status='failed';assert.throws(()=>parseAgentOutput(response([disconnected,result()])),/bağlanamadı/);
});
test('simulated Claude process exercises real stdio MCP, stages changes without applying, and cleans private jobs',async()=>{
 const qa=path.join(root,'.qa');mkdirSync(qa,{recursive:true});const temporaryRoot=mkdtempSync(path.join(qa,'runner-'));
 let generationCalls=0;let jobDir;
 const processRunner=async(exe,args,options)=>{
  assert.equal(exe,process.execPath);
  if(args[0]==='auth')return {code:0,output:JSON.stringify({loggedIn:true,authMethod:'claude.ai'})};
  generationCalls++;const mcpFile=args[args.indexOf('--mcp-config')+1];const config=JSON.parse(readFileSync(mcpFile,'utf8')).mcpServers.outlook;jobDir=config.args[1];
  assert.equal(JSON.parse(options.input).current_human_request,'Teklif mailine cuma için yanıt taslağı hazırla.');assert.ok(!args.includes('Teklif mailine cuma için yanıt taslağı hazırla.'));
  assert.equal(config.command,process.execPath);assert.equal(config.args[0],path.join(temporaryRoot,'mcp-server.mjs'));
  // Use real source server with the generated private job files; no real Outlook backend is used.
  config.args[0]=path.join(root,'mcp-server.mjs');config.env={OUTLOOK_AGENT_TEST_FIXTURE:path.join(root,'tests/fixture.json')};const client=openMcp(config);
  try{
   const started=await client.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});assert.equal(started.serverInfo.name,'classic-outlook-mailbox');
   const listed=await client.request('tools/list');assert.deepEqual(listed.tools.map(tool=>tool.name),tools.map(tool=>tool.name));assert.ok(!listed.tools.some(tool=>tool.name==='apply'));
   const tool=async(name,arguments_={})=>{const value=await client.request('tools/call',{name,arguments:arguments_});assert.equal(value.isError,undefined);return JSON.parse(value.content[0].text);};
   const mails=await tool('list_messages');const mail=mails.messages[0];await tool('get_message',{id:mail.id,storeId:mail.storeId});const prepared=await tool('prepare_operations',{operations:[{action:'reply',id:mail.id,storeId:mail.storeId,body:'Cuma günü dönüş yapacağım.'}]});assert.equal(prepared.executed,false);
   const forbidden=await client.request('tools/call',{name:'apply',arguments:{action:'send_draft'}});assert.equal(forbidden.isError,true);
  }finally{await client.close();}
  return response([init(),{type:'assistant',message:{content:[{type:'tool_use',id:'t1',name:'mcp__outlook__prepare_operations',input:{}}]}},result()]);
 };
 const runner=new AgentRunner({root:temporaryRoot,config:{claudeExecutable:process.execPath,nodeExecutable:process.execPath},processRunner});
 const output=await runner.generate('Teklif mailine cuma için yanıt taslağı hazırla.');assert.equal(generationCalls,1);assert.equal(output.pending.length,1);assert.equal(output.pending[0].args.action,'reply');assert.equal(output.pending[0].status,'pending');assert.equal(output.pending[0].args.id,'mail-offer');assert.equal(existsSync(jobDir),false);assert.equal(runner.jobs.size,0);assert.equal(runner.history.length,2);
 runner.reset();assert.equal(runner.known.length,0);assert.equal(runner.history.length,0);
});
test('failed generation removes only its generated private job and does not add conversation history',async()=>{
 const qa=path.join(root,'.qa');mkdirSync(qa,{recursive:true});const temporaryRoot=mkdtempSync(path.join(qa,'failure-'));const sentinel=path.join(temporaryRoot,'keep.txt');writeFileSync(sentinel,'keep');let jobDir;
 const processRunner=async(exe,args)=>{if(args[0]==='auth')return {code:0,output:JSON.stringify({loggedIn:true,authMethod:'claude.ai'})};jobDir=path.dirname(args[args.indexOf('--mcp-config')+1]);return {code:1,output:''};};
 const runner=new AgentRunner({root:temporaryRoot,config:{claudeExecutable:process.execPath},processRunner});await assert.rejects(runner.generate('Test'),/tamamlayamadı/);assert.equal(existsSync(jobDir),false);assert.equal(readFileSync(sentinel,'utf8'),'keep');assert.equal(runner.history.length,0);
});
