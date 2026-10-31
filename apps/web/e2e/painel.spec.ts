// F1, "Pronto quando": o painel atualiza em poucos segundos; depois do acerto confirmado, o caixa trava.
import { expect, test } from '@playwright/test';
import { bancoLimpo, entrarComo, lancar, noiteComCaixaDoJoao } from './apoio';

test('noite completa pelo painel: abre, escolhe o João, lança, Pix cai, confere e confirma', async ({ browser }) => {
  await bancoLimpo();
  // Dois aparelhos da expedição: o que um faz aparece no outro em poucos segundos (F1, tempo real).
  const balcao = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const celularLuan = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();

  await entrarComo(celularLuan, 'luan@mel.test');
  await celularLuan.getByRole('button', { name: /^Abrir a noite de/ }).click();
  await celularLuan.getByRole('button', { name: '+ João' }).click();
  const coluna = celularLuan.getByRole('region', { name: 'Coluna de João' });
  await expect(coluna).toContainText('Devolve R$ 80,00');

  await entrarComo(balcao, 'luan@mel.test');
  await balcao.getByRole('button', { name: 'Lançar comanda de papel' }).click();
  await lancar(balcao, '3557', '113', /^Barra/, 'Dinheiro');
  await lancar(balcao, '0017', '60', /^Aragarças/, 'Pix antecipado');

  await expect(coluna).toContainText('3557', { timeout: 10_000 });
  await expect(coluna).toContainText('0017', { timeout: 10_000 });
  await expect(coluna).toContainText('Devolve R$ 193,00');

  // Coluna PIX: tocar marca "caiu" (PAG5).
  await celularLuan.getByRole('button', { name: /0017.*conferir/ }).click();
  await expect(celularLuan.getByRole('button', { name: /0017.*caiu/ })).toBeVisible();

  // Caixa do João: papéis, dinheiro contado e liquidação.
  await coluna.getByRole('link').first().click();
  await expect(celularLuan.getByText('Papéis (2 faltando)')).toBeVisible();
  // As que faltam ficam no topo: marca a primeira sem conferir, duas vezes.
  await celularLuan.getByRole('checkbox', { checked: false }).first().click();
  await expect(celularLuan.getByText('Papéis (1 faltando)')).toBeVisible();
  await celularLuan.getByRole('checkbox', { checked: false }).first().click();
  await expect(celularLuan.getByText('Papéis (0 faltando)')).toBeVisible();
  const contado = celularLuan.locator('label', { hasText: 'Contado' }).getByRole('textbox');
  await contado.fill('193');
  await contado.press('Enter');
  // Receber 30 + 12 + 5 = 47; paga tudo do caixa dele.
  await expect(celularLuan.getByText('Pague R$ 47,00 do caixa dele.')).toBeVisible();

  await celularLuan.getByRole('button', { name: 'Confirmar acerto' }).click();
  await celularLuan.getByRole('button', { name: 'Toque de novo para confirmar' }).click();
  await expect(celularLuan.getByText(/^Confirmado por Luan às \d\d:\d\d$/)).toBeVisible();
  await expect(celularLuan.getByText('● Salvo')).toBeVisible({ timeout: 10_000 });

  // Depois do acerto, o caixa trava: sem lançar para ele e sem menu nos códigos (ACE9).
  await celularLuan.getByRole('link', { name: '← Folha' }).click();
  await expect(coluna).toContainText('Confirmado');
  await expect(coluna.getByRole('button', { name: /^3557/ })).toBeDisabled();

  // Resumo da noite.
  await celularLuan.getByRole('link', { name: 'Resumo da noite' }).click();
  await expect(celularLuan.locator('section', { hasText: 'Motoboys' })).toContainText('R$ 47,00');
});

test('o Luan lança comanda de papel, troca a forma e marca o que voltou, pelo painel', async ({ page }) => {
  await noiteComCaixaDoJoao();
  await entrarComo(page, 'luan@mel.test');
  const coluna = page.getByRole('region', { name: 'Coluna de João' });
  await expect(coluna).toContainText('Devolve R$ 80,00');

  // Contingência: a noite rodou no papel e o Luan lança depois.
  await page.getByRole('button', { name: 'Lançar comanda de papel' }).click();
  await lancar(page, '2672', '90', /^Pontal/, 'Dinheiro');
  await lancar(page, '8094', '65', /^Barra/, 'Dinheiro');
  await page.keyboard.press('Escape');
  await expect(coluna).toContainText('Devolve R$ 235,00');

  // Na porta o cliente pagou no cartão: "Trocou a forma" (PAG3).
  await coluna.getByRole('button', { name: /^2672/ }).click();
  await page.getByRole('button', { name: 'Trocou a forma' }).click();
  // O editor vem com a forma atual (dinheiro, 90); troca a forma da linha para cartão.
  await page.getByRole('dialog').getByRole('button', { name: 'Cartão' }).first().click();
  await page.getByRole('button', { name: 'Salvar a forma' }).click();
  await expect(coluna).toContainText('Devolve R$ 145,00');

  // O 8094 voltou: a taxa conta, os valores não (ENT5).
  await coluna.getByRole('button', { name: /^8094/ }).click();
  await page.getByRole('button', { name: 'Voltou', exact: true }).click();
  await expect(coluna).toContainText('Devolve R$ 80,00');
  await expect(coluna).toContainText('Recebe R$ 52,00');
});

test('dica de diferença (T20): a sobra aponta o cartão que foi pago em dinheiro', async ({ page }) => {
  await noiteComCaixaDoJoao();
  await entrarComo(page, 'luan@mel.test');
  await page.getByRole('button', { name: 'Lançar comanda de papel' }).click();
  await lancar(page, '2672', '90', /^Pontal/, 'Cartão');
  await page.keyboard.press('Escape');

  // O motoboy devolve 80 de caixa + 90 em dinheiro: sobra 90 (a comanda dizia cartão).
  await page.getByRole('region', { name: 'Coluna de João' }).getByRole('link').first().click();
  const contado = page.locator('label', { hasText: 'Contado' }).getByRole('textbox');
  await contado.fill('170');
  await contado.press('Enter');
  await expect(
    page.getByText(/Diferença de R\$ 90,00: a 2672 \(Cartão, R\$ 90,00\) pagou em dinheiro\?/),
  ).toBeVisible();

  // A dica só aponta; o Luan troca a forma, e a sobra some.
  await page.getByRole('button', { name: 'Trocou a forma' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Trocou a forma' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dinheiro' }).first().click();
  await page.getByRole('button', { name: 'Salvar a forma' }).click();
  await expect(page.getByText(/pagou em dinheiro\?/)).toHaveCount(0);
  await expect(page.getByText('Pague R$ 40,00 do caixa dele.')).toBeVisible();
});
