'use strict';
const $=id=>document.getElementById(id);
const token=document.querySelector('meta[name="local-token"]').content;
const labels={mark_read:'Okundu durumunu değiştir',set_flag:'Takip işaretini değiştir',set_categories:'Kategorileri değiştir',move_message:'Klasöre taşı',delete_message:'Silinmiş Öğeler’e taşı',create_folder:'Klasör oluştur',create_draft:'Yeni taslak oluştur',reply:'Yanıt taslağı oluştur',reply_all:'Tümüne yanıt taslağı oluştur',forward:'İletme taslağı oluştur',send_draft:'E-postayı gönder',create_event:'Takvime etkinlik ekle',create_task:'Görev oluştur',complete_task:'Görevi tamamla'};
let controller=null,busy=false,currentPlans=[];
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
async function api(route,data={},signal){const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':token},body:JSON.stringify(data),signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'İşlem tamamlanamadı.');return result;}
function setBusy(value){busy=value;for(const id of ['send','reset','check'])$(id).disabled=value;$('cancel').hidden=!value;updateApply();}
function updateApply(){const chosen=[...document.querySelectorAll('[data-plan]:checked')];const sends=chosen.filter(input=>currentPlans.find(plan=>plan.id===input.dataset.plan)?.preview.action==='send_draft').length;$('apply').disabled=busy||!chosen.length;$('apply').textContent=sends?`Seçilenleri onayla ve uygula (${sends} gönderim)`:'Seçilenleri onayla ve uygula';document.querySelectorAll('[data-plan]').forEach(input=>input.disabled=busy||currentPlans.find(plan=>plan.id===input.dataset.plan)?.status!=='pending');}
function render(state){
  $('messages').replaceChildren();if(!state.messages.length){const p=document.createElement('p');p.className='empty';p.textContent='Bir mail açmana gerek yok. Ne yapılmasını istediğini yaz.';$('messages').append(p);}
  for(const message of state.messages){const card=document.createElement('div');card.className='message '+message.role;const role=document.createElement('div');role.className='role';role.textContent=message.role==='user'?'SEN':message.role==='application'?'OUTLOOK':'ASİSTAN';const text=document.createElement('pre');text.textContent=message.text;card.append(role,text);if(message.tools?.length){const tools=document.createElement('div');tools.className='tools';tools.textContent=`${message.tools.length} posta aracı çağrısı`;card.append(tools);}$('messages').append(card);}
  $('messages').scrollTop=$('messages').scrollHeight;
  currentPlans=state.pending;$('plans').replaceChildren();
  if(!currentPlans.length){const p=document.createElement('p');p.className='empty';p.textContent='Henüz önerilen bir işlem yok.';$('plans').append(p);}
  for(const plan of currentPlans){
    const card=document.createElement('div');card.className='plan'+(plan.preview.action==='send_draft'?' send':'');const label=document.createElement('label');label.className='plan-label';const input=document.createElement('input');input.type='checkbox';input.dataset.plan=plan.id;input.disabled=plan.status!=='pending';input.addEventListener('change',updateApply);const title=document.createElement('span');title.textContent=(labels[plan.preview.action]||plan.preview.action)+': '+(plan.preview.subject||'');label.append(input,title);card.append(label);
    const meta=document.createElement('div');meta.className='meta';const p=plan.preview;const lines=[];
    for(const [key,label] of [['fromFolder','Mevcut klasör'],['toFolder','Hedef klasör'],['to','Alıcı'],['cc','Bilgi'],['bcc','Gizli'],['sendingAccount','Gönderen hesap'],['categories','Kategoriler'],['start','Başlangıç'],['end','Bitiş'],['due','Son tarih'],['location','Konum']]){if(p[key])lines.push(label+': '+p[key]);}
    if(p.read!==undefined)lines.push(p.read?'Okundu olarak işaretle':'Okunmadı olarak işaretle');if(p.flagStatus!==undefined)lines.push('Takip: '+({0:'Temizle',1:'Tamamlandı',2:'İşaretle'}[p.flagStatus]));
    if(p.recipients?.length)lines.push('Çözümlenen alıcılar: '+p.recipients.map(entry=>entry.address+' ('+entry.name+')').join('; '));
    if(p.attachments?.length)lines.push('Ekler: '+p.attachments.map(entry=>entry.name).join(', '));
    if(plan.status!=='pending')lines.push(plan.status==='applied'?'Uygulandı':plan.status==='failed'?'Başarısız: '+plan.error:plan.status);
    meta.textContent=lines.join('\n');card.append(meta);
    if(p.body){const details=document.createElement('details');details.open=p.action==='send_draft';const summary=document.createElement('summary');summary.textContent='Metni incele';const body=document.createElement('pre');body.className='preview-body';body.textContent=p.body;details.append(summary,body);card.append(details);}
    $('plans').append(card);
  }
  updateApply();
}
async function check(){try{const value=await api('/api/status');$('connection').textContent=(value.outlook?'Klasik Outlook bağlı':'Outlook bağlantısı yok')+' · '+(value.auth?'Claude bağlı':'Claude oturumu yok');if(!value.outlook||!value.auth)status([value.outlookError,value.authError].filter(Boolean).join('\n'),true);}catch(error){status(error.message,true);}}
$('check').addEventListener('click',check);
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{$('instruction').value=button.dataset.prompt;$('instruction').focus();}));
$('send').addEventListener('click',async()=>{const message=$('instruction').value.trim();if(!message)return status('Ne yapılmasını istediğini yaz.',true);controller=new AbortController();setBusy(true);status('Ajan posta kutusunu inceliyor… Birkaç dakika sürebilir.');try{render(await api('/api/chat',{message},controller.signal));$('instruction').value='';status('İnceleme tamamlandı. Önerilen işlemler varsa seçip uygulayabilirsin.');}catch(error){status(error.name==='AbortError'?'Görev iptal edildi.':error.message,error.name!=='AbortError');}finally{controller=null;setBusy(false);}});
$('cancel').addEventListener('click',()=>controller?.abort());
$('apply').addEventListener('click',async()=>{const ids=[...document.querySelectorAll('[data-plan]:checked')].map(input=>input.dataset.plan);setBusy(true);$('cancel').hidden=true;status('Seçtiğin işlemler Outlook’a uygulanıyor…');try{const result=await api('/api/apply',{ids});render(result);const failed=result.results.some(item=>!item.ok);status(failed?'Bazı işlemler tamamlanamadı. İşlem kartını ve Outlook’u kontrol et.':'Seçtiğin işlemler Outlook’a uygulandı.',failed);}catch(error){status(error.message+' Sonucu Outlook’ta kontrol et; işlemi körlemesine tekrarlama.',true);try{render(await api('/api/state'));}catch{}}finally{setBusy(false);}});
$('reset').addEventListener('click',async()=>{try{render(await api('/api/reset'));status('Yeni sohbet hazır.');}catch(error){status(error.message,true);}});
Promise.all([check(),api('/api/state').then(render)]).catch(error=>status(error.message,true));
