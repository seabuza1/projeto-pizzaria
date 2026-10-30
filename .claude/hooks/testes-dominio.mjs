// Stop: se algo em packages/dominio mudou, roda os testes do domínio antes de o Claude encerrar.
// Se falharem, devolve só o fim da saída e o Claude continua corrigindo.
// Para não entrar em ciclo, desiste depois de 2 bloqueios seguidos na mesma sessão.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let entrada = '';
for await (const pedaco of process.stdin) entrada += pedaco;

let dados = {};
try {
  dados = JSON.parse(entrada || '{}');
} catch {
  process.exit(0);
}

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!existsSync(join(raiz, 'packages', 'dominio', 'package.json'))) process.exit(0);

const contador = join(tmpdir(), `mel-stop-${dados.session_id ?? 'sessao'}.txt`);
const tentativas = existsSync(contador) ? Number(readFileSync(contador, 'utf8')) || 0 : 0;
if (tentativas >= 2) {
  rmSync(contador, { force: true });
  process.exit(0);
}

const rodar = (cmd, args) =>
  execFileSync(cmd, args, { cwd: raiz, stdio: 'pipe', shell: process.platform === 'win32' }).toString();

let mudancas = '';
try {
  mudancas = rodar('git', ['status', '--porcelain', '--untracked-files=all']);
} catch {
  process.exit(0);
}
if (!/packages[/\\]dominio[/\\]/.test(mudancas)) {
  rmSync(contador, { force: true });
  process.exit(0);
}

try {
  rodar('pnpm', ['--filter', '@mel/dominio', 'test']);
  rmSync(contador, { force: true });
  process.exit(0);
} catch (erro) {
  writeFileSync(contador, String(tentativas + 1));
  const saida = `${erro.stdout ?? ''}${erro.stderr ?? ''}`.trim().split('\n').slice(-30).join('\n');
  process.stderr.write(`Testes do domínio falhando. Corrija antes de terminar:\n${saida}`);
  process.exit(2);
}
