// ARQUITETURA, Robustez: sem batimento do agente, "Impressora sem resposta" e a impressão pelo navegador.
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { bancoLimpo, entrarComo, ler, noBanco, op, token } from './apoio';

test('impressora sem resposta: aviso, impressão pelo navegador como reserva; com batimento, o aviso some', async ({
  page,
}) => {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  const noiteId = randomUUID();
  await op(luan, 'abrir_noite', { noite_id: noiteId });
  const impressaoId = randomUUID();
  await op(luan, 'pedir_impressao', {
    impressao_id: impressaoId,
    tipo: 'comanda',
    conteudo: '^^^^3557\n|Teste da reserva\n=\n',
    noite_id: noiteId,
  });

  await entrarComo(page, 'luan@mel.test');
  const aviso = page.getByRole('alert').filter({ hasText: 'Impressora sem resposta' });
  await expect(aviso).toContainText('Impressora sem resposta. 1 na fila.');
  await aviso.getByRole('button', { name: 'Imprimir pelo navegador' }).click();
  await expect(aviso).toContainText('Comanda 3557');
  await aviso.getByRole('button', { name: 'Imprimir', exact: true }).click();
  const estado = async () =>
    (await ler<{ estado: string }[]>(luan, `impressoes?id=eq.${impressaoId}&select=estado`))[0]?.estado;
  await expect.poll(estado, { timeout: 10_000 }).toBe('impresso');

  // O agente voltou a bater: o aviso some.
  noBanco(`insert into public.agentes (id, impressora, impressora_ok, visto_em)
    values ('a0000000-0000-4000-8000-000000000006', '192.168.0.50:9100', true, now())`);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Noites antigas' })).toBeVisible();
  await expect(aviso).toHaveCount(0);
});
