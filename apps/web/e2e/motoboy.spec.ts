// F1, "Pronto quando": o motoboy lança e marca entregas, inclusive em modo avião; nada duplica.
import { expect, test } from '@playwright/test';
import { entrarComo, lancar, ler, noiteComCaixaDoJoao } from './apoio';

test('o motoboy lança, marca entregue e vê a conta do acerto', async ({ page }) => {
  const { luan } = await noiteComCaixaDoJoao();
  await entrarComo(page, 'joao@mel.test');

  await lancar(page, '3557', '113', /^Barra/, 'Dinheiro');
  await lancar(page, '2672', '90', /^Pontal/, 'Cartão');
  await page.getByRole('button', { name: 'Entregue' }).first().click();

  const topo = page.locator('header');
  await expect(topo).toContainText('R$ 193,00');
  await expect(topo).toContainText('R$ 90,00');
  await expect(topo).toContainText('R$ 52,00');
  await expect(page.getByText('● Salvo')).toBeVisible();

  await page.getByRole('link', { name: 'Acerto' }).click();
  await expect(page.getByText('Aguardando o Luan')).toBeVisible();
  await expect(page.getByText('80 de caixa + 113 em dinheiro')).toBeVisible();

  const saidas = await ler<{ estado: string }[]>(luan, 'saidas?select=estado&order=criado_em');
  expect(saidas.map((s) => s.estado)).toEqual(['em_rota', 'entregue']);
});

test('em modo avião, lança e marca entregue; com a internet de volta, tudo sobe e nada duplica', async ({
  page,
  context,
}) => {
  const { luan } = await noiteComCaixaDoJoao();
  await entrarComo(page, 'joao@mel.test');
  await expect(page.getByLabel('Código', { exact: true })).toBeVisible();

  await context.setOffline(true);
  await lancar(page, '0910', '72', /^Barra/, 'Pix maq.');
  await lancar(page, '3595', '47', /^Aragarças/, 'Dinheiro');
  await page.getByRole('button', { name: 'Entregue' }).first().click();
  await expect(page.getByText('3 alterações esperando internet')).toBeVisible();
  await expect(page.locator('header')).toContainText('R$ 127,00');
  expect(await ler<unknown[]>(luan, 'pedidos?select=id')).toEqual([]);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('● Salvo')).toBeVisible({ timeout: 20_000 });

  const pedidos = await ler<{ codigo: string }[]>(luan, 'pedidos?select=codigo&order=codigo');
  expect(pedidos.map((p) => p.codigo)).toEqual(['0910', '3595']);
  const saidas = await ler<{ estado: string }[]>(luan, 'saidas?select=estado&estado=eq.entregue');
  expect(saidas).toHaveLength(1);
});

test('código repetido na noite pede um segundo toque (PED1)', async ({ page }) => {
  const { luan } = await noiteComCaixaDoJoao();
  await entrarComo(page, 'joao@mel.test');
  await lancar(page, '3557', '113', /^Barra/, 'Dinheiro');

  await page.getByLabel('Código', { exact: true }).fill('3557');
  await page.getByLabel('Total').fill('40');
  await page.getByRole('button', { name: /^Aragarças/ }).click();
  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  await expect(page.getByText('3557 já foi lançada hoje. Toque de novo para lançar outra.')).toBeVisible();
  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  await expect(page.getByText('3557 lançada')).toBeVisible();

  await expect(async () => {
    expect(await ler<unknown[]>(luan, 'pedidos?select=id&codigo=eq.3557')).toHaveLength(2);
  }).toPass();
});

test('desfazer o lançamento não apaga nada no servidor (OPE3)', async ({ page }) => {
  const { luan } = await noiteComCaixaDoJoao();
  await entrarComo(page, 'joao@mel.test');
  await lancar(page, '8094', '65', /^Barra/, 'Dinheiro');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Nenhuma comanda ainda.')).toBeVisible();
  await expect(page.locator('header')).toContainText('R$ 80,00');

  await expect(async () => {
    const pedidos = await ler<{ estado: string }[]>(luan, 'pedidos?select=estado');
    expect(pedidos).toEqual([{ estado: 'cancelado' }]);
  }).toPass();
});
