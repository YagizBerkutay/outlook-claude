import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
export function openMcp(config){
 const child=spawn(config.command,config.args,{env:{...process.env,...config.env},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stderr.resume();let next=0;const pending=new Map();
 createInterface({input:child.stdout,crlfDelay:Infinity}).on('line',line=>{let response;try{response=JSON.parse(line);}catch{return;}const promise=pending.get(response.id);if(!promise)return;pending.delete(response.id);clearTimeout(promise.timer);response.error?promise.reject(new Error(response.error.message)):promise.resolve(response.result);});
 const rejectAll=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();};
 child.on('error',rejectAll);child.on('close',()=>rejectAll(new Error('MCP closed')));child.stdin.on('error',rejectAll);
 const request=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP timeout'));},15000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const close=()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);child.stdin.end();});
 return {request,close,child};
}
