import https from 'node:https';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './lib/bridge.mjs';
import { createClaudeRunner } from './lib/claude.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
try {
  const localDir = path.join(root, '.local');
  const config = JSON.parse(readFileSync(path.join(localDir, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
  const runtimeDir = path.join(localDir, 'runtime');
  mkdirSync(runtimeDir, { recursive: true });
  const runner = createClaudeRunner({ config, runtimeDir, systemPromptPath: path.join(root, 'system-prompt.txt'), mcpPath: path.join(root, 'empty-mcp.json') });
  const server = https.createServer({ pfx: readFileSync(path.join(localDir, 'localhost.pfx')), passphrase: config.pfxPassword }, createHandler({ publicDir: path.join(root, 'public'), runner }));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? '3443 portu kullanımda. Daha önce açılmış 3-BASLAT.cmd penceresini kontrol edin.' : `Sunucu başlatılamadı (${error.code || 'bilinmeyen hata'}).`);
    process.exitCode = 1;
  });
  server.listen(3443, '127.0.0.1', () => console.log('Outlook yerel asistan çalışıyor: https://localhost:3443\nBu pencereyi açık tutun. Durdurmak için Ctrl+C.'));
} catch (error) {
  console.error(error.status ? error.message : 'Yerel kurulum bulunamadı veya sertifika okunamadı. Önce 1-KURULUM.cmd dosyasını çalıştırın.');
  process.exitCode = 1;
}
