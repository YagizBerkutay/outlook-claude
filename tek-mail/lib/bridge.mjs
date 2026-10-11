import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { BridgeError } from './claude.mjs';

const staticFiles = new Map([
  ['/', ['taskpane.html', 'text/html; charset=utf-8']],
  ['/taskpane.html', ['taskpane.html', 'text/html; charset=utf-8']],
  ['/taskpane.js', ['taskpane.js', 'text/javascript; charset=utf-8']],
  ['/taskpane.css', ['taskpane.css', 'text/css; charset=utf-8']],
  ['/commands.html', ['commands.html', 'text/html; charset=utf-8']],
  ...[16, 32, 64, 80, 128].map(size => [`/assets/icon-${size}.png`, [`assets/icon-${size}.png`, 'image/png']]),
]);

export function validatePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.instruction !== 'string' || !value.instruction.trim() || value.instruction.length > 4000) throw new BridgeError('İstek 1–4000 karakter olmalıdır.', 400);
  if (!value.email || typeof value.email !== 'object' || typeof value.email.subject !== 'string' || typeof value.email.body !== 'string') throw new BridgeError('E-posta bağlamı geçersiz.', 400);
  if (value.email.subject.length > 1000 || value.email.body.length > 40000) throw new BridgeError('E-posta çok uzun. Konu en fazla 1000, metin en fazla 40000 karakter olabilir.', 400);
  return { instruction: value.instruction.trim(), email: { subject: value.email.subject, body: value.email.body } };
}

async function jsonBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new BridgeError('JSON isteği gerekli.', 415);
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 256 * 1024) throw new BridgeError('İstek boyut sınırını aştı.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new BridgeError('JSON okunamadı.', 400); }
}

export function createHandler({ publicDir, runner, origin = 'https://localhost:3443', token = randomBytes(32).toString('hex') }) {
  let busy = false;
  const host = new URL(origin).host;
  const matchesToken = value => typeof value === 'string' && Buffer.byteLength(value) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(value), Buffer.from(token));
  return async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://appsforoffice.microsoft.com; style-src 'self'; img-src 'self'; connect-src 'self' https://*.office.com https://*.office365.com https://*.outlook.com https://*.live.com https://*.microsoft.com; frame-ancestors https://*.office.com https://*.office365.com https://*.outlook.com https://*.live.com https://*.microsoft.com; object-src 'none'; base-uri 'none'");
    const json = (status, data) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); } };
    try {
      if (req.headers.host !== host) throw new BridgeError('Geçersiz sunucu adresi.', 403);
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'POST') throw new BridgeError('POST isteği gerekli.', 405);
        if (req.headers.origin !== origin || !matchesToken(req.headers['x-local-token'])) throw new BridgeError('Geçersiz yerel bağlantı. Paneli yenileyin.', 403);
        if (url.pathname === '/api/status') { json(200, await runner.checkAuth(controller.signal)); return; }
        if (url.pathname !== '/api/generate') throw new BridgeError('Adres bulunamadı.', 404);
        if (busy) throw new BridgeError('Bir istek zaten çalışıyor. Bitmesini bekleyin.', 429);
        const payload = validatePayload(await jsonBody(req));
        // Another request could have acquired the slot while this body was being read.
        if (busy) throw new BridgeError('Bir istek zaten çalışıyor. Bitmesini bekleyin.', 429);
        busy = true;
        try {
          await runner.checkAuth(controller.signal);
          const result = await runner.generate(payload, controller.signal);
          json(200, { result });
        } finally { busy = false; }
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new BridgeError('GET isteği gerekli.', 405);
      const entry = staticFiles.get(url.pathname);
      if (!entry) throw new BridgeError('Adres bulunamadı.', 404);
      let content = await readFile(path.join(publicDir, entry[0]));
      if (entry[0] === 'taskpane.html') content = Buffer.from(content.toString('utf8').replace('__LOCAL_TOKEN__', token));
      res.writeHead(200, { 'Content-Type': entry[1] });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      json(error instanceof BridgeError ? error.status : 500, { error: error instanceof BridgeError ? error.message : 'Yerel bağlantıda hata oluştu. 4-TANI.cmd dosyasını çalıştırın.' });
    }
  };
}
