// F1, despacho: dois toques (códigos e motoboy), "Desfazer" por 5 s, Pix com motivo e pendências ao fechar.
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { bancoLimpo, entrarComo, IDS, noBanco, noiteComCaixaDoJoao, op, pedidoDoBalcao } from './apoio';

test('o Luan despacha pelo painel, desfaz, despacha certo e vê os pendentes ao fechar', async ({ page }) => {
  const { luan, noiteId } = await noiteComCaixaDoJoao();
  await op(luan, 'abrir_caixa', { caixa_id: randomUUID(), noite_id: noiteId, motoboy_id: IDS.pedro });
  pedidoDoBalcao(noiteId, '3557', 45, 'Barra', 'dinheiro');
  pedidoDoBalcao(noiteId, '0017', 60, 'Aragarças', 'pix_antecipado');

  await entrarComo(page, 'luan@mel.test');
  const despacho = page.getByRole('region', { name: 'Despacho' });
  await expect(despacho).toContainText('Para sair (2)');
  await expect(despacho.getByRole('button', { name: 'Pedido 0017' })).toContainText('PIX: CONFERIR');

  // Dois toques: os códigos e o motoboy. Pix sem "caiu" pede para conferir antes de entregar a comanda.
  await despacho.getByRole('button', { name: 'Pedido 3557' }).click();
  await despacho.getByRole('button', { name: 'Pedido 0017' }).click();
  await expect(despacho).toContainText('Confira o Pix da 0017 antes de entregar a comanda.');
  await despacho.getByRole('button', { name: 'João', exact: true }).click();
  await expect(page.getByText('3557, 0017 com João')).toBeVisible();
  const joao = page.getByRole('region', { name: 'Coluna de João' });
  await expect(joao).toContainText('3557');
  await expect(joao).toContainText('Devolve R$ 125,00');
  await expect(despacho).toHaveCount(0);

  // Motoboy errado: "Desfazer" devolve os pedidos para a lista.
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(despacho).toContainText('Para sair (2)');
  await expect(joao).toContainText('Devolve R$ 80,00');

  await despacho.getByRole('button', { name: 'Pedido 3557' }).click();
  await despacho.getByRole('button', { name: 'Pedro', exact: true }).click();
  const pedro = page.getByRole('region', { name: 'Coluna de Pedro' });
  await expect(pedro).toContainText('3557');
  await expect(pedro).toContainText('Recebe R$ 42,00');

  // Coluna PIX: o Pix do pedido que ainda não saiu também aparece. Desmarcar pede o motivo.
  await page.getByRole('button', { name: /0017.*conferir/ }).click();
  await expect(page.getByRole('button', { name: /0017.*caiu/ })).toBeVisible();
  await page.getByRole('button', { name: /0017.*caiu/ }).click();
  const desmarcar = page.getByRole('button', { name: 'Desmarcar' });
  await expect(desmarcar).toBeDisabled();
  await page.getByPlaceholder(/^Motivo/).fill('Marquei o Pix errado');
  await desmarcar.click();
  await expect(page.getByRole('button', { name: /0017.*conferir/ })).toBeVisible();

  // Fechar a noite lista os pendentes (ERROS-PREVISTOS).
  await page.getByRole('button', { name: 'Fechar a noite' }).click();
  const pendentes = page.getByRole('list', { name: 'Pendentes' });
  await expect(pendentes).toContainText('Pedido sem saída0017');
  await expect(pendentes).toContainText('Caixa sem acertoJoão, Pedro');
  await expect(pendentes).toContainText('Pix sem "caiu"0017');
  await page.getByRole('button', { name: 'Fechar com 4 pendentes' }).click();
  await page.getByRole('button', { name: 'Toque de novo para confirmar' }).click();
  await expect(page.getByText(/A noite de .* foi fechada\./)).toBeVisible();
});

test('a comanda devolvida sem saída aparece no acerto: "Era dele"', async ({ page }) => {
  const { noiteId } = await noiteComCaixaDoJoao();
  pedidoDoBalcao(noiteId, '8498', 40, 'Pontal', 'cartao');

  await entrarComo(page, 'luan@mel.test');
  await page.getByRole('region', { name: 'Coluna de João' }).getByRole('link').first().click();
  await expect(page.getByText('Comanda sem saída (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Era dele' }).click();
  await expect(page.getByText('8498 com João')).toBeVisible();
  await expect(page.getByText('Papéis (1 faltando)')).toBeVisible();
  await expect(page.getByText('Comanda sem saída')).toHaveCount(0);
});

test('a noite de ontem ficou aberta: o painel avisa e, fechada, libera abrir a de hoje', async ({ page }) => {
  await bancoLimpo();
  noBanco(`insert into public.noites (data, aberta_em) values (current_date - 2, now() - interval '2 days')`);

  await entrarComo(page, 'luan@mel.test');
  await expect(page.getByText(/^A noite de .* ainda está aberta\.$/)).toBeVisible();
  await page.getByRole('button', { name: 'Ver pendentes e fechar' }).click();
  await expect(page.getByText('Nada pendente.')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar a noite', exact: true }).last().click();
  await page.getByRole('button', { name: 'Toque de novo para confirmar' }).click();
  await expect(page.getByRole('button', { name: /^Abrir a noite de/ })).toBeVisible();
});
