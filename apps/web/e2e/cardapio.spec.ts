// F2, 2a e 2g: preços pela gerente, "acabou hoje" pela equipe do balcão e promoção da noite no painel.
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { bancoLimpo, entrarComMfa, entrarComo, fecharAparelhos, ler, novoAparelho, op, token } from './apoio';

test.afterEach(fecharAparelhos);

test('a gerente muda o preço da G tradicional; a mudança vale no banco', async ({ page }) => {
  await bancoLimpo();
  await entrarComMfa(page, 'dona@mel.test');
  await page.getByRole('link', { name: 'Cardápio' }).click();
  const g = page.getByLabel('Tradicional G');
  await expect(g).toHaveValue('73,00');
  await g.fill('75');
  await g.press('Enter');
  // O preço novo chega ao servidor (a fila sobe sozinha).
  const luan = await token('luan@mel.test');
  const precoNoServidor = async () =>
    (await ler<{ preco: number }[]>(luan, 'cardapio_faixas?faixa=eq.tradicional&tamanho=eq.G&select=preco'))[0]?.preco;
  await expect.poll(precoNoServidor, { timeout: 10_000 }).toBe(7500);

  // Item novo e item fora do cardápio.
  await page.getByPlaceholder('Nome do item').fill('Suco de Cajá');
  await page.getByLabel('Preço do item novo').fill('9');
  await page.getByLabel('Preço do item novo').press('Enter');
  await page.getByRole('button', { name: 'Pôr no cardápio' }).click();
  await page.getByPlaceholder('Buscar no cardápio').fill('caja');
  await expect(page.getByLabel('Preço de Suco de Cajá')).toHaveValue('9,00');
  await page.getByRole('button', { name: 'Suco de Cajá no cardápio' }).click();
  await expect(page.getByRole('button', { name: 'Suco de Cajá fora do cardápio' })).toBeVisible();
});

test('o atendimento marca "acabou hoje" e o painel do Luan vê em poucos segundos', async ({ browser }) => {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  await op(luan, 'abrir_noite', { noite_id: randomUUID() });

  const balcao = await (await novoAparelho(browser)).newPage();
  await entrarComo(balcao, 'atendimento@mel.test');
  await balcao.getByRole('link', { name: 'Cardápio' }).click();
  await balcao.getByPlaceholder('Buscar no cardápio').fill('calabresa');
  // O atendimento não muda preço.
  await expect(balcao.getByLabel(/^Preço de/)).toHaveCount(0);
  await balcao.getByRole('button', { name: 'Acabou hoje: sabor Calabresa', exact: true }).click();
  await expect(balcao.getByRole('button', { name: 'Acabou hoje: sabor Calabresa', exact: true })).toHaveText('Acabou');

  const celular = await (await novoAparelho(browser)).newPage();
  await entrarComo(celular, 'luan@mel.test');
  await celular.getByRole('link', { name: 'Cardápio' }).click();
  await celular.getByPlaceholder('Buscar no cardápio').fill('calabresa');
  const doLuan = celular.getByRole('button', { name: 'Acabou hoje: sabor Calabresa', exact: true });
  await expect(doLuan).toHaveText('Acabou', { timeout: 10_000 });
  await doLuan.click();
  await expect(balcao.getByRole('button', { name: 'Acabou hoje: sabor Calabresa', exact: true })).toHaveText('Tem', {
    timeout: 10_000,
  });
});

test('promoção da noite: o painel avisa até definir; fora de R$ 3 a R$ 23 é recusada', async ({ page }) => {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  await op(luan, 'abrir_noite', { noite_id: randomUUID() });

  await entrarComo(page, 'luan@mel.test');
  const promo = page.getByRole('region', { name: 'Promoção da noite' });
  await expect(promo).toContainText('Promoção da noite não definida');
  const desconto = promo.getByLabel('Desconto nas tradicionais');
  await desconto.fill('30');
  await desconto.press('Enter');
  await expect(promo).toContainText('A promoção da noite vai de R$ 3,00 a R$ 23,00.');
  await desconto.fill('10');
  await desconto.press('Enter');
  await expect(page.getByText('Promoção da noite: R$ 10,00')).toBeVisible();

  await page.getByRole('button', { name: 'Mudar' }).click();
  await page.getByRole('button', { name: 'Sem promoção' }).click();
  await expect(page.getByText('Sem promoção hoje')).toBeVisible();
});
