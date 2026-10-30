// Apoio dos testes de ponta a ponta: contas do seed.sql e operações pela API, como o app faria.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

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
  // O reset reinicia os serviços; espera a API e o Realtime voltarem.
  for (let i = 0; i < 90; i++) {
    let realtime = '';
    try {
      realtime = execFileSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'supabase_realtime_mel-pdv'], {
        encoding: 'utf8',
      }).trim();
    } catch {}
    try {
      const auth = await fetch(`${API}/auth/v1/health`, { headers: { apikey: ANON } });
      if (auth.ok && realtime === 'healthy') break;
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

export async function lancar(page: Page, codigo: string, total: string, area: RegExp, forma: string) {
  await page.getByLabel('Código', { exact: true }).fill(codigo);
  await page.getByLabel('Total').fill(total);
  await page.getByRole('button', { name: area }).click();
  await page.getByRole('button', { name: forma, exact: true }).click();
  await expect(page.getByText(`${codigo} lançada`)).toBeVisible();
}
