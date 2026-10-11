import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRunner } from '../lib/agent.mjs';
import { OutlookBackend } from '../lib/mailbox.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
 const config=JSON.parse(readFileSync(path.join(root,'.local/config.json'),'utf8').replace(/^\uFEFF/,''));
 const runner=new AgentRunner({root,config}); await runner.checkAuth();
 console.log('Claude abonelik oturumu bağlı.');
 const status=await new OutlookBackend(root).execute('status');
 console.log('Klasik Outlook bağlı: '+status.stores+' posta deposu. Posta içerikleri gösterilmez.');
}catch(error){console.error(error.message);process.exitCode=1;}
