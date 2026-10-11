'use strict';
const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="local-token"]').content;
let officeReady = false, controller = null, currentItemKey = '', generatedItemKey = '';

function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function itemKey() {
  const item = officeReady ? Office.context.mailbox.item : null;
  return item ? item.itemId || String(item) + (typeof item.subject === 'string' ? item.subject : '') : '';
}
function resetResult() { $('result').value = ''; generatedItemKey = ''; $('insert').disabled = true; $('copy').disabled = true; }
function busy(value) {
  $('generate').disabled = value;
  $('cancel').hidden = !value;
  $('read').disabled = value || !officeReady;
  $('insert').disabled = value || !officeReady || !$('result').value;
}
async function callApi(endpoint, data, signal) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Local-Token': token }, body: JSON.stringify(data), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Bağlantı başarısız.');
  return result;
}
async function check() {
  $('check').disabled = true;
  try { await callApi('/api/status', {}); $('connection').textContent = 'Claude aboneliği bağlı'; }
  catch (error) { $('connection').textContent = 'Claude bağlantısı hazır değil'; status(error.message, true); }
  finally { $('check').disabled = false; }
}
function officeAsync(start) {
  return new Promise((resolve, reject) => start(result => result.status === Office.AsyncResultStatus.Succeeded ? resolve(result.value) : reject(new Error(result.error?.message || 'Outlook işlemi tamamlanamadı.'))));
}
async function readItem() {
  if (!officeReady) return;
  try {
    const item = Office.context.mailbox.item;
    if (!item) throw new Error('Önce Outlook’ta bir e-posta açın.');
    const key = itemKey();
    const subject = typeof item.subject === 'string' ? item.subject : await officeAsync(cb => item.subject.getAsync(cb));
    const body = await officeAsync(cb => item.body.getAsync(Office.CoercionType.Text, cb));
    if (key !== itemKey()) throw new Error('E-posta değişti. Yeniden getirin.');
    if (String(body).length > 40000) throw new Error('E-posta 40000 karakterden uzun. İlgili bölümü elle yapıştırın.');
    $('subject').value = String(subject || '').slice(0, 1000);
    $('body').value = body || '';
    currentItemKey = key;
    resetResult();
    status('E-posta getirildi. Göndermeden önce metni ve isteğini kontrol et.');
  } catch (error) { status(error.message, true); }
}
$('check').addEventListener('click', check);
$('read').addEventListener('click', readItem);
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { $('instruction').value = button.dataset.prompt; $('instruction').focus(); }));
$('generate').addEventListener('click', async () => {
  const instruction = $('instruction').value.trim();
  if (!instruction) { status('Önce ne istediğini yaz veya bir seçenek seç.', true); return; }
  resetResult();
  const requestItemKey = officeReady ? itemKey() : '';
  if (officeReady && currentItemKey && currentItemKey !== requestItemKey) { status('E-posta değişti. Önce açık e-postayı yeniden getir.', true); return; }
  controller = new AbortController();
  busy(true); status('Claude hazırlıyor… Bu işlem birkaç dakika sürebilir.');
  try {
    const reply = await callApi('/api/generate', { instruction, email: { subject: $('subject').value, body: $('body').value } }, controller.signal);
    if (officeReady && requestItemKey !== itemKey()) throw new Error('İstek sırasında e-posta değişti. Açık e-postayı yeniden getirip tekrar dene.');
    $('result').value = reply.result;
    generatedItemKey = requestItemKey;
    $('copy').disabled = false;
    status('Metin hazır. Outlook’a eklemeden önce kontrol et.');
  } catch (error) { status(error.name === 'AbortError' ? 'İstek iptal edildi.' : error.message, error.name !== 'AbortError'); }
  finally { controller = null; busy(false); }
});
$('cancel').addEventListener('click', () => controller?.abort());
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('result').value); status('Kopyalandı.'); }
  catch { $('result').focus(); $('result').select(); status('Metin seçildi. Ctrl+C ile kopyala.'); }
});
function escapeHtml(value) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('insert').addEventListener('click', async () => {
  if (!officeReady || !$('result').value) return;
  try {
    if (generatedItemKey !== itemKey()) throw new Error('E-posta değişti. Önce bu e-posta için yeni yanıt hazırla.');
    const item = Office.context.mailbox.item;
    if (typeof item.subject === 'string') {
      const html = escapeHtml($('result').value).replace(/\r?\n/g, '<br>');
      item.displayReplyForm({ htmlBody: `<div>${html}</div>` });
      status('Outlook yanıt penceresi açıldı. Kontrol edip kendin gönder.');
    } else {
      await officeAsync(cb => item.body.setSelectedDataAsync($('result').value, { coercionType: Office.CoercionType.Text }, cb));
      status('Metin taslağın imleç konumuna eklendi. Kontrol edip kendin gönder.');
    }
  } catch (error) { status(error.message, true); }
});
if (typeof Office !== 'undefined') {
  Office.onReady(info => {
    officeReady = info.host === Office.HostType.Outlook;
    $('read').disabled = !officeReady;
    if (officeReady) {
      currentItemKey = itemKey();
      if (Office.context.mailbox.addHandlerAsync) Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, () => {
        controller?.abort(); currentItemKey = itemKey(); $('subject').value = ''; $('body').value = ''; resetResult(); status('E-posta değişti. Açık e-postayı yeniden getir.');
      });
    } else { $('context-note').textContent = 'Tarayıcı önizlemesi: Metni elle yapıştır. Outlook’a ekleme, eklenti içinden kullanılabilir. Ekler okunmaz.'; }
  });
} else { $('context-note').textContent = 'Outlook bağlantısı yüklenemedi. Tarayıcıdan metin yapıştırarak kullanabilirsin.'; }
check();
