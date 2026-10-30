// F1, "Pronto quando": o painel mostra a comanda nova em poucos segundos; depois do acerto confirmado,
// o motoboy não edita o caixa nem as saídas.
import { expect, test } from '@playwright/test';
import { bancoLimpo, entrarComo, lancar } from './apoio';

test('noite completa: Luan abre, João lança, Pix cai, Luan confere e confirma o acerto', async ({ browser }) => {
  await bancoLimpo();
  const celularLuan = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const celularJoao = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();

  // Luan abre a noite e o caixa do João, que chegou primeiro.
  await entrarComo(celularLuan, 'luan@mel.test');
  await celularLuan.getByRole('button', { name: /^Abrir a noite de/ }).click();
  await celularLuan.getByRole('button', { name: '+ João' }).click();
  await expect(celularLuan.getByText('Devolve R$ 80,00')).toBeVisible();

  // João lança duas comandas.
  await entrarComo(celularJoao, 'joao@mel.test');
  await lancar(celularJoao, '3557', '113', /^Barra/, 'Dinheiro');
  await lancar(celularJoao, '0017', '60', /^Aragarças/, 'Pix antecipado');
  await expect(celularJoao.getByText('Pix não confirmado · cobrar R$ 60,00')).toBeVisible();
  await celularJoao.getByRole('button', { name: 'Entregue', exact: true }).first().click();

  // Em poucos segundos, as comandas aparecem na folha do Luan.
  const folha = celularLuan.locator('a[href*="/caixa/"]');
  await expect(folha).toContainText('3557', { timeout: 10_000 });
  await expect(folha).toContainText('0017', { timeout: 10_000 });
  await expect(folha).toContainText('Devolve R$ 193,00');

  // Coluna PIX: tocar marca "caiu"; o João vê "Pix confirmado".
  await celularLuan.getByRole('button', { name: /0017.*conferir/ }).click();
  await expect(celularLuan.getByRole('button', { name: /0017.*caiu/ })).toBeVisible();
  await expect(celularJoao.getByText('Pix confirmado')).toBeVisible({ timeout: 10_000 });

  // Caixa do João: papéis, dinheiro contado e liquidação.
  await folha.first().click();
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

  // O João vê o acerto confirmado e não lança mais nada.
  await celularJoao.getByRole('link', { name: 'Acerto' }).click();
  await expect(celularJoao.getByText(/^Confirmado por Luan às/)).toBeVisible({ timeout: 10_000 });
  await celularJoao.getByRole('link', { name: 'Noite' }).click();
  await expect(celularJoao.getByLabel('Código', { exact: true })).toHaveCount(0);
  await expect(celularJoao.getByRole('button', { name: 'Entregue', exact: true })).toHaveCount(0);

  // Resumo da noite.
  await celularLuan.getByRole('link', { name: '← Folha' }).click();
  await celularLuan.getByRole('link', { name: 'Resumo da noite' }).click();
  await expect(celularLuan.locator('section', { hasText: 'Motoboys' })).toContainText('R$ 47,00');
});
