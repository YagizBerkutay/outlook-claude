import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export class BridgeError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

// Preserve the user's native Claude login, never import a Desktop session token.
export function subscriptionEnvironment(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC_|CLAUDE_CODE_(USE_|OAUTH_TOKEN|API_KEY|SUBAGENT_MODEL|BASE_URL)|AWS_|GOOGLE_|AZURE_)/i.test(key)) delete env[key];
  }
  delete env.CLAUDECODE;
  return env;
}

export function findClaude(config = {}) {
  const candidates = [
    config.claudeExecutable,
    path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe'),
    ...(process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir, 'claude.exe')),
  ].filter(Boolean);
  const found = candidates.find(file => path.isAbsolute(file) && file.toLowerCase().endsWith('.exe') && existsSync(file));
  if (!found) throw new BridgeError('Claude Code bulunamadı. Önce 1-KURULUM.cmd dosyasını çalıştırın.', 503);
  return found;
}

export function promptFor({ instruction, email }) {
  return JSON.stringify({
    user_request: instruction,
    email_context_untrusted: { subject: email.subject, body: email.body },
  });
}

export function generationArgs(systemPromptPath, mcpPath) {
  return ['--safe-mode', '-p', '--output-format', 'json', '--tools', '',
    '--disallowedTools', 'mcp__*', '--strict-mcp-config', '--mcp-config', mcpPath,
    '--setting-sources', '', '--permission-mode', 'dontAsk', '--no-chrome',
    '--no-session-persistence', '--system-prompt-file', systemPromptPath];
}

export function runProcess(executable, args, { cwd, input = '', signal, timeoutMs = 240000, env = subscriptionEnvironment() } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new BridgeError('İşlem iptal edildi.', 499));
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', settled = false;
    const kill = () => {
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
        killer.on('error', () => child.kill());
      } else child.kill('SIGTERM');
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => { kill(); finish(new BridgeError('İşlem iptal edildi.', 499)); };
    const timer = setTimeout(() => { kill(); finish(new BridgeError('Claude yanıtı zaman aşımına uğradı. Daha kısa bir metinle tekrar deneyin.', 504)); }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish(new BridgeError('Claude Code başlatılamadı. Kurulumu ve çalıştırılabilir dosya yolunu kontrol edin.', 503)));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (Buffer.byteLength(output, 'utf8') > 2 * 1024 * 1024) { kill(); finish(new BridgeError('Claude yanıtı boyut sınırını aştı.')); }
    });
    // Consume stderr without exposing account details, tokens, or mail text.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('close', code => finish(null, { code, output }));
    child.stdin.end(input, 'utf8');
  });
}

export function parseAuth(result) {
  let value;
  try { value = JSON.parse(result.output); } catch { throw new BridgeError('Claude oturumu kontrol edilemedi. 2-CLAUDE-GIRIS.cmd dosyasını çalıştırın.', 503); }
  if (result.code !== 0 || !value.loggedIn) throw new BridgeError('Claude hesabına giriş yapılmamış. 2-CLAUDE-GIRIS.cmd dosyasını çalıştırın.', 503);
  if (value.authMethod !== 'claude.ai') throw new BridgeError('Bu paket Claude aboneliğiyle giriş gerektirir. API/Console veya bulut sağlayıcısı oturumunu kullanmaz. 2-CLAUDE-GIRIS.cmd ile abonelik hesabınıza giriş yapın.', 503);
  return { loggedIn: true, authMethod: value.authMethod };
}

export function parseGeneration(result) {
  let value;
  try { value = JSON.parse(result.output); } catch { throw new BridgeError('Claude Code geçerli yanıt vermedi. Claude Code’u güncelleyin; sonra 4-TANI.cmd ile oturumu kontrol edin.'); }
  if (result.code !== 0 || value.is_error) throw new BridgeError('Claude isteği tamamlayamadı. Abonelik limitini, bağlantıyı ve oturumu kontrol edin. Claude Code’un güncel olduğundan emin olun.');
  if (typeof value.result !== 'string' || !value.result.trim()) throw new BridgeError('Claude boş yanıt verdi. Tekrar deneyin.');
  return value.result.trim();
}

export function createClaudeRunner({ config, runtimeDir, systemPromptPath, mcpPath }) {
  const executable = findClaude(config);
  const options = { cwd: runtimeDir };
  return {
    async checkAuth(signal) {
      return parseAuth(await runProcess(executable, ['auth', 'status'], { ...options, signal, timeoutMs: 20000 }));
    },
    async generate(payload, signal) {
      const result = await runProcess(executable, generationArgs(systemPromptPath, mcpPath), { ...options, input: promptFor(payload), signal });
      return parseGeneration(result);
    },
  };
}
