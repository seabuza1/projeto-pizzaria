// Apoio dos testes de ponta a ponta: contas do seed.sql e operações pela API, como o app faria.
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { type Browser, type BrowserContext, expect, type Page } from '@playwright/test';

const status = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
    cwd: new URL('../../..', import.meta.url).pathname,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
) as Record<string, string>;

export const API = status.API_URL ?? '';
const ANON = status.ANON_KEY ?? '';
export const SENHA = 'Mel12345teste';
export const IDS = {
  joao: 'a0000000-0000-4000-8000-000000000004',
  pedro: 'a0000000-0000-4000-8000-000000000005',
};

export async function token(email: string): Promise<string> {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

export async function op(tk: string, tipo: string, dados: object) {
  const r = await fetch(`${API}/rest/v1/rpc/aplicar_operacao`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: { id: randomUUID(), tipo, dados, criada_em: new Date().toISOString(), versao_op: 1 } }),
  });
  const resposta = (await r.json()) as { status: string; motivo: string | null };
  expect(resposta.motivo).toBeNull();
  return resposta;
}

export async function ler<T>(tk: string, caminho: string): Promise<T> {
  const r = await fetch(`${API}/rest/v1/${caminho}`, { headers: { apikey: ANON, Authorization: `Bearer ${tk}` } });
  return (await r.json()) as T;
}

/** Banco limpo, com as contas do seed. */
export async function bancoLimpo() {
  execFileSync('pnpm', ['exec', 'supabase', 'db', 'reset'], {
    cwd: new URL('../../..', import.meta.url).pathname,
    stdio: 'ignore',
  });
  // O reset reinicia os serviços; espera o login, a API REST e o Realtime voltarem.
  for (let i = 0; i < 90; i++) {
    let realtime = '';
    try {
      realtime = execFileSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'supabase_realtime_mel-pdv'], {
        encoding: 'utf8',
      }).trim();
    } catch {}
    try {
      const auth = await fetch(`${API}/auth/v1/health`, { headers: { apikey: ANON } });
      // A API REST só responde sem 5xx depois de carregar o esquema de novo.
      const rest = await fetch(`${API}/rest/v1/areas?select=id&limit=1`, { headers: { apikey: ANON } });
      if (auth.ok && rest.status < 500 && realtime === 'healthy') break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Banco limpo e uma noite aberta com o caixa do João. */
export async function noiteComCaixaDoJoao() {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  const noiteId = randomUUID();
  await op(luan, 'abrir_noite', { noite_id: noiteId });
  await op(luan, 'abrir_caixa', { caixa_id: randomUUID(), noite_id: noiteId, motoboy_id: IDS.joao });
  return { luan, noiteId };
}

export async function entrarComo(page: Page, email: string) {
  await page.goto('/');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

// Segredo TOTP de teste do seed.sql (admin e gerente entram com MFA).
const SEGREDO_TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

/** Código do app autenticador (RFC 6238: SHA-1, 30 s, 6 dígitos). */
function codigoTotp(agora = Date.now()): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...SEGREDO_TOTP].map((ch) => alfabeto.indexOf(ch).toString(2).padStart(5, '0')).join('');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(contador).digest();
  const o = (h[h.length - 1] ?? 0) & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Admin e gerente: senha e o código do autenticador. */
export async function entrarComMfa(page: Page, email: string) {
  await entrarComo(page, email);
  await page.getByPlaceholder('000000').fill(codigoTotp());
  await page.getByRole('button', { name: 'Confirmar' }).click();
}

export async function lancar(page: Page, codigo: string, total: string, area: RegExp, forma: string) {
  await page.getByLabel('Código', { exact: true }).fill(codigo);
  await page.getByLabel('Total').fill(total);
  await page.getByRole('button', { name: area }).click();
  await page.getByRole('button', { name: forma, exact: true }).click();
  await expect(page.getByText(`${codigo} lançada`)).toBeVisible();
}

/**
 * Pedido do balcão, já autorizado, com o pagamento previsto na comanda.
 * Até a tela de pedido existir (F2, etapa 7 do MVP), ele nasce direto no banco local.
 */
/** SQL direto no banco local, só para montar cenários que o app ainda não cria. */
export function noBanco(sql: string) {
  execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_mel-pdv', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    {
      input: sql,
      stdio: ['pipe', 'ignore', 'inherit'],
    },
  );
}

/** Consulta direta no banco local, para conferir o que o app gravou. Devolve as linhas em texto. */
export function doBanco(sql: string): string {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_mel-pdv', 'psql', '-U', 'postgres', '-tA'], {
    input: sql,
    encoding: 'utf8',
  }).trim();
}

export function pedidoDoBalcao(noiteId: string, codigo: string, reais: number, area: string, forma: string) {
  const pedidoId = randomUUID();
  const centavos = Math.round(reais * 100);
  const sql = `
    insert into public.pedidos (id, noite_id, codigo, origem, tipo, area_id, total, estado)
    values ('${pedidoId}', '${noiteId}', '${codigo}', 'whatsapp', 'entrega',
      (select id from public.areas where nome = '${area}'), ${centavos}, 'em_producao');
    insert into public.pagamentos (noite_id, pedido_id, forma, valor)
    values ('${noiteId}', '${pedidoId}', '${forma}', ${centavos});`;
  execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_mel-pdv', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    {
      input: sql,
      stdio: ['pipe', 'ignore', 'inherit'],
    },
  );
  return pedidoId;
}

// Aparelhos extras de um teste. Fechar no fim: um aparelho esquecido aberto reconecta depois do reset
// do banco e manda o que tinha na fila (o rascunho salvo sozinho abriria a noite do teste seguinte).
const aparelhos: BrowserContext[] = [];

export async function novoAparelho(browser: Browser): Promise<BrowserContext> {
  const contexto = await browser.newContext({ viewport: { width: 412, height: 915 } });
  aparelhos.push(contexto);
  return contexto;
}

export async function fecharAparelhos() {
  for (const contexto of aparelhos.splice(0)) await contexto.close();
}
