// Optional browser smoke test. Uses mock responses, never a Claude account.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHandler } from '../lib/bridge.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const qaDir = path.join(root, '.qa');
await mkdir(qaDir, { recursive: true });
const browserPath = [process.env.BROWSER_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
if (!browserPath) throw new Error('Chrome veya Edge bulunamadı. BROWSER_EXE ile yol belirleyin.');
const profile = await mkdtemp(path.join(qaDir, 'browser-'));
let received;
const expected = 'Merhaba, cuma günü size dönüş yapacağım.\nİyi çalışmalar.';
let replyText = expected;
const server = http.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://localhost:${server.address().port}`;
server.on('request', createHandler({ publicDir: path.join(root, 'public'), origin, runner: { checkAuth: async () => ({ loggedIn: true, authMethod: 'claude.ai' }), generate: async payload => { received = payload; return replyText; } } }));
const browser = spawn(browserPath, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const result = await check(); if (result) return result; await delay(100); }
  throw new Error('Browser smoke test timed out');
}
try {
  const port = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return null; } });
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = pages.find(page => page.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  let officeShim = null;
  const waiting = new Map();
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.method === 'Fetch.requestPaused') {
      command('Fetch.fulfillRequest', { requestId: data.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(officeShim || '').toString('base64') }).catch(error => console.error(error.message));
    }
    const pending = waiting.get(data.id);
    if (pending) { waiting.delete(data.id); clearTimeout(pending.timer); data.error ? pending.reject(new Error(data.error.message)) : pending.resolve(data.result); }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    waiting.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 1240, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: origin });
  await until(() => evaluate("document.getElementById('connection')?.textContent === 'Claude aboneliği bağlı'"));
  await evaluate("document.getElementById('subject').value='Teklif';document.getElementById('body').value='Ne zaman dönüş yapabilirsiniz?';document.querySelector('[data-prompt]').click();document.getElementById('generate').click();");
  await until(() => evaluate("document.getElementById('result')?.value.length > 0"));
  assert.equal(await evaluate("document.getElementById('result').value"), expected);
  assert.equal(await evaluate("document.getElementById('copy').disabled"), false);
  assert.equal(await evaluate("document.getElementById('insert').disabled"), true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Panel should fit a narrow Outlook sidebar');
  assert.equal(received.email.subject, 'Teklif'); assert.match(received.instruction, /taslağı/);
  const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(qaDir, 'panel-mobile.png'), Buffer.from(screenshot.data, 'base64'));
  await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1300, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: pathToFileURL(path.join(root, 'KURULUM-TR.html')).href });
  await until(() => evaluate("document.title.includes('Kurulum')"));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  const guide = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(qaDir, 'guide.png'), Buffer.from(guide.data, 'base64'));
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Fetch.enable', { patterns: [{ urlPattern: '*appsforoffice.microsoft.com/*' }] });
  const commonOffice = "HostType:{Outlook:'Outlook'},AsyncResultStatus:{Succeeded:'ok'},CoercionType:{Text:'text'},EventType:{ItemChanged:'changed'},onReady:cb=>Promise.resolve().then(()=>cb({host:'Outlook'}))";
  officeShim = `window.Office={${commonOffice},context:{mailbox:{item:{itemId:'mail-1',subject:'Orijinal konu',body:{getAsync:(type,cb)=>cb({status:'ok',value:'Orijinal e-posta'})},displayReplyForm:data=>window.mockReply=data},addHandlerAsync:(type,cb)=>window.mockItemChanged=cb}}};`;
  await command('Page.navigate', { url: origin });
  await until(() => evaluate("document.getElementById('read')?.disabled === false"));
  await evaluate("document.getElementById('read').click();");
  await until(() => evaluate("document.getElementById('body').value === 'Orijinal e-posta'"));
  replyText = '<script>bad()</script> & Merhaba';
  await evaluate("document.querySelector('[data-prompt]').click();document.getElementById('generate').click();");
  await until(() => evaluate("document.getElementById('insert').disabled === false"));
  await evaluate("document.getElementById('insert').click();");
  assert.equal(await evaluate('window.mockReply.htmlBody'), '<div>&lt;script&gt;bad()&lt;/script&gt; &amp; Merhaba</div>');
  await evaluate("Office.context.mailbox.item.itemId='mail-2';window.mockItemChanged();");
  assert.equal(await evaluate("document.getElementById('result').value"), '');
  assert.equal(await evaluate("document.getElementById('insert').disabled"), true);
  officeShim = `window.Office={${commonOffice},context:{mailbox:{item:{subject:{getAsync:cb=>cb({status:'ok',value:'Taslak konu'})},body:{getAsync:(type,cb)=>cb({status:'ok',value:'Taslak metin'}),setSelectedDataAsync:(text,options,cb)=>{window.mockInserted={text,options};cb({status:'ok'});}}},addHandlerAsync:(type,cb)=>window.mockItemChanged=cb}}};`;
  await command('Page.navigate', { url: origin });
  await until(() => evaluate("document.getElementById('read')?.disabled === false"));
  await evaluate("document.getElementById('read').click();");
  await until(() => evaluate("document.getElementById('body').value === 'Taslak metin'"));
  replyText = expected;
  await evaluate("document.querySelector('[data-prompt]').click();document.getElementById('generate').click();");
  await until(() => evaluate("document.getElementById('insert').disabled === false"));
  await evaluate("document.getElementById('insert').click();");
  assert.equal(await evaluate('window.mockInserted.text'), expected);
  assert.equal(await evaluate('window.mockInserted.options.coercionType'), 'text');
  console.log('Browser smoke test passed: mock generation, Turkish text, narrow panel, guide, mocked Outlook read/compose insertion, HTML escaping and changed-mail reset. No account or API used.');
} finally {
  socket?.close();
  if (browser.pid) {
    const killer = spawn(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/taskkill.exe'), ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    killer.on('error', () => browser.kill());
  }
  server.closeAllConnections(); server.close();
}
