// PostToolUse (Edit|Write): formata e verifica só o arquivo editado com o Biome.
// Devolve ao Claude apenas as últimas linhas do erro, para gastar poucos tokens.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let entrada = '';
for await (const pedaco of process.stdin) entrada += pedaco;

let arquivo = '';
try {
  arquivo = JSON.parse(entrada || '{}')?.tool_input?.file_path ?? '';
} catch {
  process.exit(0);
}

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const biome = join(raiz, 'node_modules', '.bin', process.platform === 'win32' ? 'biome.cmd' : 'biome');

if (!arquivo || !/\.(ts|tsx|js|mjs|cjs|json|jsonc|css)$/i.test(arquivo)) process.exit(0);
if (/node_modules|graphify-out|[/\\]dist[/\\]/.test(arquivo)) process.exit(0);
if (!existsSync(biome)) process.exit(0); // repositório ainda sem Biome instalado

try {
  execFileSync(biome, ['check', '--write', '--no-errors-on-unmatched', arquivo], {
    cwd: raiz,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
} catch (erro) {
  const saida = `${erro.stdout ?? ''}${erro.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
  process.stderr.write(`Biome encontrou problemas em ${arquivo}:\n${saida}`);
  process.exit(2);
}
process.exit(0);
