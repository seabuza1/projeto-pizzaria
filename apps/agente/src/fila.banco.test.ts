// Integração: o agente de verdade (node src/principal.ts) com o Supabase local e uma térmica falsa.
// O Luan pede a comanda; o agente imprime, marca "impresso" e grava o batimento.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type AddressInfo, createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { afterAll, expect, it } from 'vitest';

const raiz = fileURLToPath(new URL('../../..', import.meta.url));
const status = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { cwd: raiz, encoding: 'utf8' }),
) as Record<string, string>;
const url = status.API_URL ?? '';
const anon = status.ANON_KEY ?? '';

let agente: ChildProcess | undefined;
const recebidos: Buffer[] = [];
const termica = createServer((s) => {
  const partes: Buffer[] = [];
  s.on('data', (b: Buffer) => partes.push(b));
  s.on('end', () => recebidos.push(Buffer.concat(partes)));
});

afterAll(() => {
  agente?.kill();
  termica.close();
});

it('o agente imprime a comanda pedida pelo Luan e marca "impresso"', async () => {
  await new Promise<void>((ok) => termica.listen(0, '127.0.0.1', ok));
  const porta = (termica.address() as AddressInfo).port;

  const luan = createClient(url, anon, { auth: { persistSession: false } });
  const login = await luan.auth.signInWithPassword({ email: 'luan@mel.test', password: 'Mel12345teste' });
  expect(login.error).toBeNull();
  const impressaoId = randomUUID();
  const { data } = await luan.rpc('aplicar_operacao', {
    op: {
      id: randomUUID(),
      tipo: 'pedir_impressao',
      dados: { impressao_id: impressaoId, tipo: 'comanda', conteudo: '^^^^3557\n|Teste do agente\n=\n' },
      criada_em: new Date().toISOString(),
      versao_op: 1,
    },
  });
  expect((data as { status: string }).status).toBe('aplicada');

  agente = spawn(process.execPath, ['src/principal.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      MEL_SUPABASE_URL: url,
      MEL_SUPABASE_ANON_KEY: anon,
      MEL_AGENTE_EMAIL: 'agente@mel.test',
      MEL_AGENTE_SENHA: 'Mel12345teste',
      MEL_IMPRESSORA_HOST: '127.0.0.1',
      MEL_IMPRESSORA_PORTA: String(porta),
      MEL_AGENTE_PORTA_LOCAL: String(20_000 + Math.floor(Math.random() * 20_000)),
    },
    stdio: 'ignore',
  });

  const estado = async () => {
    const { data: linhas } = await luan.from('impressoes').select('estado').eq('id', impressaoId);
    return linhas?.[0]?.estado;
  };
  await expect.poll(estado, { timeout: 15_000, interval: 500 }).toBe('impresso');
  expect(recebidos.some((b) => b.includes(Buffer.from('Teste do agente')))).toBe(true);
}, 30_000);
