import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClaudeRunner } from '../lib/claude.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  const config = JSON.parse(readFileSync(path.join(root, '.local/config.json'), 'utf8').replace(/^\uFEFF/, ''));
  const runtimeDir = path.join(root, '.local/runtime');
  mkdirSync(runtimeDir, { recursive: true });
  const runner = createClaudeRunner({ config, runtimeDir, systemPromptPath: path.join(root, 'system-prompt.txt'), mcpPath: path.join(root, 'empty-mcp.json') });
  const auth = await runner.checkAuth();
  console.log(`Abonelik oturumu: ${auth.loggedIn ? 'bağlı' : 'bağlı değil'} (${auth.authMethod}). E-posta veya anahtar bilgisi gösterilmez.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
