import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runProcess, BridgeError } from './claude.mjs';

const objectSchema = properties => ({ type: 'object', properties, additionalProperties: false });
const str = { type: 'string' }, integer = { type: 'integer' }, bool = { type: 'boolean' };
const identifiers = { id: str, storeId: str };
const operationNames = ['mark_read','set_flag','set_categories','move_message','delete_message','create_folder','create_draft','reply','reply_all','forward','send_draft','create_event','create_task','complete_task'];
const fields = { action: { type: 'string', enum: operationNames }, ...identifiers, read: bool, flagStatus: { type: 'integer', enum: [0,1,2] }, categories: str, destinationId: str, destinationStoreId: str, parentId: str, parentStoreId: str, name: str, to: str, cc: str, subject: str, body: str, start: str, end: str, location: str, due: str };
export const tools = [
  ['mailbox_status','Check the running CLASSIC Outlook profile and mailbox connection.',{}],
  ['list_folders','List mail folders across configured classic Outlook stores. Includes stable item identifiers.',{}],
  ['list_messages','Read paginated message metadata in a folder. Without folder identifiers, uses the default Inbox. Use get_message for full content. Respect hasMore and scan limits.',{...identifiers,limit:integer,offset:integer,unreadOnly:bool,since:str}],
  ['search_messages','Case-insensitive literal search in subjects and senders; includeBody optionally searches truncated bodies. Searches all mail folders unless folder identifiers are given. Results are bounded; never claim exhaustive results if truncated.',{...identifiers,query:str,limit:integer,unreadOnly:bool,since:str,includeBody:bool}],
  ['get_message','Get the full text, recipients, modification time and attachment metadata of a previously listed message.',identifiers],
  ['read_text_attachment','Read a previously listed TXT/CSV/MD/JSON/LOG/ICS attachment under 1 MB. PDF and Office attachment parsing is unsupported.',{...identifiers,index:integer}],
  ['list_calendar','Read calendar appointments between ISO start/end dates. Maximum interval: 366 days.',{start:str,end:str}],
  ['list_tasks','Read Outlook tasks and completion status.',{}],
  ['prepare_operations','Stage exact Outlook modifications for user review. Does NOT execute them. At most one operation per existing item per request. Read message content before replying, forwarding or sending. Reply/forward actions create drafts only; sending a saved draft requires its own later reviewed send_draft operation. Permanent deletion and meeting invitations are unsupported.',{operations:{type:'array',minItems:1,maxItems:100,items:{...objectSchema(fields),required:['action']}}}],
].map(([name,description,properties]) => ({name,description,inputSchema:objectSchema(properties),annotations:{readOnlyHint:name!=='prepare_operations',destructiveHint:false,openWorldHint:false}}));

export class OutlookBackend {
  constructor(root) { this.root = root; }
  async execute(op, args = {}, signal) {
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    const response = await runProcess(exe,['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(this.root,'scripts/outlook.ps1')],{cwd:this.root,input:JSON.stringify({op,args}),signal,timeoutMs:90000});
    let parsed;
    try { parsed = JSON.parse(response.output.replace(/^\uFEFF/,'')); } catch { throw new BridgeError('Outlook bağlantısı yanıt vermedi. Klasik Outlook açık mı? Bir hesap veya güvenlik penceresi bekliyor mu?',503); }
    if (!parsed.ok) throw new BridgeError(parsed.error || 'Outlook işlemi tamamlanamadı.',503);
    return parsed.result;
  }
}
export class FixtureBackend {
  constructor(data) { this.data = data; this.applied = []; }
  async execute(op,args={}) {
    if(op==='status') return {connected:true,stores:1,profile:'SENTETİK TEST'};
    if(op==='list_folders') return {folders:this.data.folders,truncated:false};
    if(op==='list_messages'||op==='search_messages') {
      const messages = this.data.messages.filter(item=>!args.id||item.folderId===args.id).filter(item=>op!=='search_messages'||(item.subject+' '+item.body).toLowerCase().includes(args.query.toLowerCase()));
      return {messages:messages.map(({body,...metadata})=>metadata),hasMore:false,truncated:false};
    }
    if(op==='get_message') { const item=this.data.messages.find(item=>item.id===args.id&&item.storeId===args.storeId); if(!item) throw new BridgeError('E-posta bulunamadı.'); return structuredClone(item); }
    if(op==='list_tasks') return {tasks:[],truncated:false};
    if(op==='list_calendar') return {events:[],truncated:false,timezone:'Turkey Standard Time'};
    if(op==='apply') { this.applied.push(structuredClone(args)); return {applied:true,synthetic:true}; }
    throw new BridgeError('Testte desteklenmeyen işlem.');
  }
}

const key = item => `${item.storeId}|${item.id}`;
export class MailboxEngine {
  constructor({backend,jobDir,known=[]}) { this.backend=backend; this.jobDir=jobDir; this.known=new Map(known.map(item=>[key(item),item])); this.pending=[]; }
  save() { if(this.jobDir) { writeFileSync(path.join(this.jobDir,'known.json'),JSON.stringify([...this.known.values()])); writeFileSync(path.join(this.jobDir,'pending.json'),JSON.stringify(this.pending)); } }
  requireItem(args,kind='message') { const item=this.known.get(key(args)); if(!item||item.kind!==kind) throw new BridgeError('Önce ilgili öğeyi araçlarla listeleyin. Bilinmeyen öğe kimliği reddedildi.',400); return item; }
  register(result,op) {
    const expose=(item,kind,fullRead=false)=>{
      const existing=[...this.known.values()].find(entry=>entry.nativeId===item.id&&entry.nativeStoreId===item.storeId);
      const entries=[...this.known.values()];
      const store=entries.find(entry=>entry.nativeStoreId===item.storeId)?.storeId||'s'+(Math.max(0,...entries.map(entry=>Number(entry.storeId.slice(1))||0))+1);
      const record={...(existing?.modified===item.modified?existing:{}),...item,id:existing?.id||'i'+(Math.max(0,...entries.map(entry=>Number(entry.id.slice(1))||0))+1),storeId:store,nativeId:item.id,nativeStoreId:item.storeId,kind,fullRead};
      this.known.set(key(record),record);
      const {nativeId,nativeStoreId,...visible}=record; return visible;
    };
    for(const [field,kind] of [['folders','folder'],['messages','message'],['tasks','task']]) {
      if(result[field]) result[field]=result[field].map(item=>item.id&&item.storeId?expose(item,kind):item);
    }
    if(op==='get_message') result=expose(result,'message',true);
    if(op==='status') delete result.defaultStoreId;
    this.save(); return result;
  }
  async call(name,args={},signal) {
    const spec=tools.find(tool=>tool.name===name);
    if(!spec) throw new BridgeError('Bilinmeyen araç.',400);
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(field=>!Object.hasOwn(spec.inputSchema.properties,field))) throw new BridgeError('Araç girdisi geçersiz.',400);
    if(name==='prepare_operations') return this.prepare(args.operations);
    if(['get_message','read_text_attachment'].includes(name)) this.requireItem(args);
    if(['list_messages','search_messages'].includes(name)&&args.id) this.requireItem(args,'folder');
    for(const dateField of ['since','start','end']) { if(args[dateField]&&(typeof args[dateField]!=='string'||!Number.isFinite(Date.parse(args[dateField])))) throw new BridgeError('Tarih ISO biçiminde olmalı.',400); }
    if(name==='list_calendar'&&(!args.start||!args.end)) throw new BridgeError('Başlangıç ve bitiş gerekli.',400);
    if(name==='search_messages'&&(typeof args.query!=='string'||!args.query||args.query.length>200)) throw new BridgeError('Arama metni 1–200 karakter olmalı.',400);
    for(const field of ['limit','offset','index']) { if(args[field]!==undefined&&(!Number.isInteger(args[field])||args[field]<0)) throw new BridgeError('Sayısal araç parametresi geçersiz.',400); }
    for(const field of ['unreadOnly','includeBody']) { if(args[field]!==undefined&&typeof args[field]!=='boolean') throw new BridgeError('Araç seçeneği geçersiz.',400); }
    if(name==='read_text_attachment') { const item=this.requireItem(args); if(!item.fullRead||!item.attachments?.some(entry=>entry.index===args.index)) throw new BridgeError('Önce eki get_message ile listeleyin.',400); }
    const op=name==='mailbox_status'?'status':name;
    const nativeArgs={...args};
    if(args.id) { const record=this.known.get(key(args)); nativeArgs.id=record.nativeId; nativeArgs.storeId=record.nativeStoreId; }
    const result=this.register(await this.backend.execute(op,nativeArgs,signal),op);
    if(this.jobDir) appendFileSync(path.join(this.jobDir,'events.jsonl'),JSON.stringify({tool:name,time:new Date().toISOString()})+'\n');
    return result;
  }
  prepare(operations) {
    if(!Array.isArray(operations)||!operations.length||operations.length>100||this.pending.length+operations.length>100) throw new BridgeError('1–100 işlem hazırlayın.',400);
    const staged=[]; const touched=new Set(this.pending.map(item=>item.targetKey).filter(Boolean));
    for(const raw of operations) {
      if(!raw||!operationNames.includes(raw.action)||Object.keys(raw).some(field=>!Object.hasOwn(fields,field))) throw new BridgeError('Geçersiz işlem.',400);
      const args={}; for(const [field,value] of Object.entries(raw)) {
        if(fields[field].type==='string'&&(typeof value!=='string'||value.length>(field==='body'?40000:field==='id'||field==='storeId'||field.endsWith('Id')?4096:2000))) throw new BridgeError('İşlem metni geçersiz veya çok uzun.',400);
        args[field]=value;
      }
      let target;
      const itemActions=['mark_read','set_flag','set_categories','move_message','delete_message','reply','reply_all','forward','send_draft','complete_task'];
      if(itemActions.includes(args.action)) {
        target=this.requireItem(args,args.action==='complete_task'?'task':'message');
        if(touched.has(key(args))) throw new BridgeError('Aynı öğe için bir seferde tek işlem hazırlayın.',400);
        touched.add(key(args)); args.expectedModified=target.modified;
        if(!args.expectedModified) throw new BridgeError('Öğe sürümü okunamadı.',400);
      }
      if(['reply','reply_all','forward','send_draft'].includes(args.action)&&!target.fullRead) throw new BridgeError('Önce e-postanın tam metnini okuyun.',400);
      if(args.action==='send_draft'&&!target.isDraft) throw new BridgeError('Yalnızca kaydedilmiş taslak gönderilebilir.',400);
      if(args.action==='send_draft'&&target.bodyTruncated) throw new BridgeError('Taslak metni çok uzun; tam olarak incelenemedi. Outlook içinden gönderin.',400);
      if(args.action==='mark_read'&&typeof args.read!=='boolean') throw new BridgeError('Okundu seçimi gerekli.',400);
      if(args.action==='set_flag'&&![0,1,2].includes(args.flagStatus)) throw new BridgeError('İşaret değeri geçersiz.',400);
      if(args.action==='set_categories'&&typeof args.categories!=='string') throw new BridgeError('Kategori metni gerekli.',400);
      let destination;
      if(args.action==='move_message') destination=this.requireItem({id:args.destinationId,storeId:args.destinationStoreId},'folder');
      if(args.action==='create_folder') { destination=this.requireItem({id:args.parentId,storeId:args.parentStoreId},'folder'); if(!args.name?.trim()||args.name.length>80||/[\\/\x00-\x1f]/.test(args.name)) throw new BridgeError('Klasör adı geçersiz.',400); }
      if(['create_draft','forward'].includes(args.action)&&(!args.to?.trim()||/[\r\n]/.test(args.to+args.cc))) throw new BridgeError('Alıcı adreslerini belirtin.',400);
      if(['create_draft','reply','reply_all','forward'].includes(args.action)&&!args.body?.trim()) throw new BridgeError('Tam taslak metni gerekli.',400);
      if(['create_draft','create_event','create_task'].includes(args.action)&&!args.subject?.trim()) throw new BridgeError('Konu gerekli.',400);
      if(args.action==='create_event'&&(!Number.isFinite(Date.parse(args.start))||!Number.isFinite(Date.parse(args.end))||Date.parse(args.end)<=Date.parse(args.start))) throw new BridgeError('Takvim tarihleri geçersiz.',400);
      if(args.due&&!Number.isFinite(Date.parse(args.due))) throw new BridgeError('Görev tarihi geçersiz.',400);
      const preview={action:args.action,subject:target?.subject||args.subject||args.name,fromFolder:target?.folder,toFolder:destination?.path||destination?.name,to:args.to||(['reply','reply_all'].includes(args.action)?target?.senderAddress:target?.to),cc:args.cc||target?.cc,bcc:args.action==='send_draft'?target?.bcc:undefined,body:args.action==='send_draft'?target?.body:args.body,recipients:args.action==='send_draft'?target?.recipients:undefined,attachments:args.action==='send_draft'?target?.attachments:undefined,sendingAccount:args.action==='send_draft'?target?.sendingAccount:undefined,read:args.read,categories:args.categories,flagStatus:args.flagStatus,start:args.start,end:args.end,due:args.due,location:args.location};
      const targetKey=target?key(target):null;
      if(target) { args.id=target.nativeId; args.storeId=target.nativeStoreId; }
      if(args.action==='move_message') { args.destinationId=destination.nativeId; args.destinationStoreId=destination.nativeStoreId; }
      if(args.action==='create_folder') { args.parentId=destination.nativeId; args.parentStoreId=destination.nativeStoreId; }
      staged.push({id:randomUUID(),args,preview,targetKey,status:'pending'});
    }
    this.pending.push(...staged); this.save();
    return {executed:false,requiresUserApproval:true,operations:staged.map(item=>({id:item.id,...item.preview})),message:'İşlemler yalnızca panelde kullanıcı Onayla ve uygula düğmesine bastığında gerçekleşir.'};
  }
}
export function fixtureFromEnvironment() { const file=process.env.OUTLOOK_AGENT_TEST_FIXTURE; return file?new FixtureBackend(JSON.parse(readFileSync(file,'utf8'))):null; }
