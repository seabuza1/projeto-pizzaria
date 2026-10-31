// F1: cadastro de motoboys (gerente e admin) e noites antigas só para leitura, com CSV.
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { bancoLimpo, entrarComMfa, entrarComo, ler, noiteComCaixaDoJoao, op, token } from './apoio';

test('a gerente cadastra, renomeia e desativa motoboys; o inativo sai da chegada', async ({ page }) => {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  await op(luan, 'abrir_noite', { noite_id: randomUUID() });

  await entrarComMfa(page, 'dona@mel.test');
  await page.getByRole('link', { name: 'Motoboys' }).click();
  await page.getByPlaceholder('Nome do motoboy').fill('Carlos');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.getByLabel('Nome de Carlos')).toBeVisible();

  await page.getByRole('button', { name: 'Pedro ativo' }).click();
  await expect(page.getByRole('button', { name: 'Pedro inativo' })).toBeVisible();
  const nomeJoao = page.getByLabel('Nome de João');
  await nomeJoao.fill('João Paulo');
  await nomeJoao.press('Enter');
  await expect(page.getByLabel('Nome de João Paulo')).toBeVisible();
  await expect(page.getByText('● Salvo')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: 'Painel' }).click();
  await expect(page.getByRole('button', { name: '+ Carlos' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ João Paulo' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Pedro' })).toHaveCount(0);
});

test('a expedição não vê o cadastro de motoboys', async ({ page }) => {
  await bancoLimpo();
  await entrarComo(page, 'luan@mel.test');
  await expect(page.getByRole('button', { name: /^Abrir a noite de/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Motoboys' })).toHaveCount(0);
  await page.goto('/motoboys');
  await expect(page).toHaveURL(/\/expedicao$/);
});

test('noite antiga: só leitura, com a folha, o resumo e o CSV', async ({ page }) => {
  const { luan, noiteId } = await noiteComCaixaDoJoao();
  const [caixa] = await ler<{ id: string }[]>(luan, `caixas?noite_id=eq.${noiteId}&select=id`);
  const [barra] = await ler<{ id: string }[]>(luan, 'areas?nome=eq.Barra&select=id');
  await op(luan, 'lancar_saida', {
    caixa_id: caixa?.id,
    pedido_id: randomUUID(),
    saida_id: randomUUID(),
    codigo: '3557',
    total: 11300,
    area_id: barra?.id,
    pagamentos: [{ id: randomUUID(), forma: 'dinheiro', valor: 11300 }],
  });
  await op(luan, 'fechar_noite', { noite_id: noiteId });

  await entrarComo(page, 'luan@mel.test');
  await expect(page.getByText(/^A noite de .* foi fechada\.$/)).toBeVisible();
  await page.getByRole('link', { name: 'Noites antigas' }).click();
  await page
    .getByRole('link', { name: /^\d\d\/\d\d\/\d{4}/ })
    .first()
    .click();

  await expect(page.getByText(/\(só leitura\)$/)).toBeVisible();
  const coluna = page.getByRole('region', { name: 'Coluna de João' });
  await expect(coluna).toContainText('Devolve R$ 193,00');
  await expect(coluna.getByRole('button', { name: /^3557/ })).toBeDisabled();
  await expect(coluna.getByRole('link')).toHaveCount(0);
  await expect(page.locator('section', { hasText: 'Recebido por forma' })).toContainText('R$ 113,00');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar a noite (CSV)' }).click();
  expect((await download).suggestedFilename()).toMatch(/^mel-noite-\d{4}-\d\d-\d\d\.csv$/);

  await page.getByRole('link', { name: '← Noites antigas' }).click();
  await expect(page.getByRole('link', { name: '← Painel' })).toBeVisible();
});
