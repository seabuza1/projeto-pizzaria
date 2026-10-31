// F2, 2b e 2e: o pedido nasce digitado, vai para a produção e o Luan despacha.
import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { bancoLimpo, entrarComo, fecharAparelhos, ler, novoAparelho, op, token } from './apoio';

test.afterEach(fecharAparelhos);

async function telefone(page: Page, numero: string) {
  await page.getByLabel('Telefone').fill(numero);
}

async function buscarETocar(page: Page, texto: string, opcao: string | RegExp) {
  await page.getByPlaceholder('Buscar sabor, bebida ou combo').fill(texto);
  await page
    .getByRole('region', { name: 'Resultados' })
    .getByRole('button', { name: opcao, exact: typeof opcao === 'string' })
    .click();
}

test('a 3557 (P2): telefone, meio a meio, refrigerante, resumo, autorizado e o Luan despacha', async ({ browser }) => {
  await bancoLimpo();
  const contexto = await novoAparelho(browser);
  await contexto.route('https://wa.me/**', (r) => r.fulfill({ body: 'WhatsApp' }));
  const balcao = await contexto.newPage();
  await entrarComo(balcao, 'atendimento@mel.test');

  // Ninguém abriu a noite: o primeiro pedido abre (ERROS-PREVISTOS).
  await telefone(balcao, '(64) 99999-3557');
  await expect(balcao.getByText('3557', { exact: true })).toBeVisible();
  await balcao.getByPlaceholder('Nome do cliente').fill('Maria');

  await buscarETocar(balcao, 'filé', 'Filé Mignon');
  await buscarETocar(balcao, 'calab', 'Calabresa');
  const pizza = balcao.getByRole('region', { name: 'Pizza' });
  await expect(pizza).toContainText('G ½ Filé Mignon ½ Calabresa');
  await pizza.getByRole('button', { name: 'Pôr no pedido' }).click();
  await buscarETocar(balcao, 'refri', /^Refrigerante 2L/);

  await balcao.getByRole('button', { name: /^Aragarças/ }).click();
  await balcao.getByPlaceholder('Referência (ex.: hospital)').fill('hospital');
  await balcao.getByRole('button', { name: 'Cartão', exact: true }).click();
  await expect(balcao.getByLabel('Total do pedido')).toHaveText('R$ 113,00');

  const whatsapp = balcao.waitForEvent('popup');
  await balcao.getByRole('button', { name: 'Mandar resumo' }).click();
  const conversa = decodeURIComponent((await whatsapp).url());
  expect(conversa).toContain('https://wa.me/5564999993557?text=');
  expect(conversa).toContain(
    'Pedido 3557: G ½ Filé Mignon ½ Calabresa + Refrigerante 2L · entrega em Aragarças (hospital) · total R$ 113,00 · cartão na entrega.',
  );
  const lateral = balcao.getByRole('complementary', { name: 'Pedidos abertos' });
  await expect(lateral).toContainText(/3557aguardando cliente há \d+ min/, { timeout: 10_000 });

  await balcao.getByRole('button', { name: 'Autorizado' }).click();
  await balcao.getByRole('button', { name: 'Toque de novo para autorizar' }).click();
  await expect(balcao.getByText('3557 autorizado')).toBeVisible();
  await expect(lateral).toContainText('Em produção');
  await expect(balcao.getByText('● Salvo')).toBeVisible({ timeout: 10_000 });

  // O cliente ficou com o último local.
  const luan = await token('luan@mel.test');
  const [cliente] = await ler<{ nome: string; local_referencia: string }[]>(
    luan,
    'clientes?select=nome,local_referencia',
  );
  expect(cliente).toEqual({ nome: 'Maria', local_referencia: 'hospital' });

  // A comanda foi para a fila de impressão ao autorizar (F2, 2c).
  const comandas = () => ler<{ tipo: string; conteudo: string }[]>(luan, 'impressoes?select=tipo,conteudo');
  await expect.poll(async () => (await comandas()).length, { timeout: 10_000 }).toBe(1);
  const [comanda] = await comandas();
  expect(comanda?.tipo).toBe('comanda');
  expect(comanda?.conteudo).toContain('^^^^3557\n');
  expect(comanda?.conteudo).toContain('|Ref.: hospital');
  expect(comanda?.conteudo).toContain('|Maria');

  // O Luan vê o pedido para sair e despacha.
  const celular = await (await novoAparelho(browser)).newPage();
  await entrarComo(celular, 'luan@mel.test');
  await celular.getByRole('button', { name: '+ João' }).click();
  const despacho = celular.getByRole('region', { name: 'Despacho' });
  await despacho.getByRole('button', { name: 'Pedido 3557' }).click();
  await despacho.getByRole('button', { name: 'João', exact: true }).click();
  await expect(celular.getByRole('region', { name: 'Coluna de João' })).toContainText('Recebe R$ 35,00');
});

test('trava: o outro aparelho vê "Atendendo 3557 em outro aparelho" e pode assumir', async ({ browser }) => {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  await op(luan, 'abrir_noite', { noite_id: randomUUID() });

  const balcao = await (await novoAparelho(browser)).newPage();
  await entrarComo(balcao, 'atendimento@mel.test');
  await telefone(balcao, '64999993557');
  await buscarETocar(balcao, 'refri', /^Refrigerante 2L/);
  await expect(balcao.getByRole('complementary', { name: 'Pedidos abertos' })).toContainText('3557digitando', {
    timeout: 10_000,
  });
  await expect(balcao.getByText('● Salvo')).toBeVisible({ timeout: 10_000 });

  const celular = await (await novoAparelho(browser)).newPage();
  await entrarComo(celular, 'luan@mel.test');
  await celular.getByRole('link', { name: 'Atendimento' }).click();
  await telefone(celular, '64999993557');
  await expect(celular.getByText(/^Atendendo 3557 em outro aparelho há \d+ min$/)).toBeVisible({ timeout: 10_000 });
  await celular.getByRole('button', { name: 'Assumir' }).click();
  await expect(celular.getByRole('list', { name: 'Itens do pedido' })).toContainText('Refrigerante 2L');
});

test('retirada (P8): "frango" mostra as opções, sem taxa, troco, "Avisar" e "Retirado"', async ({ browser }) => {
  await bancoLimpo();
  const luan = await token('luan@mel.test');
  const noiteId = randomUUID();
  await op(luan, 'abrir_noite', { noite_id: noiteId });
  const [calabresa] = await ler<{ id: string }[]>(luan, 'cardapio_sabores?nome=eq.Calabresa&select=id');
  await op(luan, 'marcar_acabou', { noite_id: noiteId, tipo: 'sabor', item_id: calabresa?.id, acabou: true });

  const contexto = await novoAparelho(browser);
  await contexto.route('https://wa.me/**', (r) => r.fulfill({ body: 'WhatsApp' }));
  const balcao = await contexto.newPage();
  await entrarComo(balcao, 'atendimento@mel.test');
  await telefone(balcao, '64999998498');

  // "Acabou hoje" aparece riscado e não entra.
  await balcao.getByPlaceholder('Buscar sabor, bebida ou combo').fill('calabresa');
  await expect(balcao.getByText('Calabresa (acabou)')).toBeVisible();

  // P11: "frango" mostra as 4 opções.
  await balcao.getByPlaceholder('Buscar sabor, bebida ou combo').fill('frango');
  const resultados = balcao.getByRole('region', { name: 'Resultados' });
  for (const nome of ['Frango c/ Catupiry', 'Franguinho', 'Estrogonofe de Frango', 'Frango com Pequi']) {
    await expect(resultados.getByRole('button', { name: nome, exact: true })).toBeVisible();
  }
  await resultados.getByRole('button', { name: 'Frango c/ Catupiry', exact: true }).click();
  await balcao.getByRole('region', { name: 'Pizza' }).getByRole('button', { name: 'Pôr no pedido' }).click();

  await balcao.getByRole('button', { name: 'Retirada', exact: true }).click();
  await balcao.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  const troco = balcao.getByLabel('Troco para');
  await troco.fill('100');
  await troco.press('Enter');
  await expect(balcao.getByLabel('Total do pedido')).toHaveText('R$ 73,00');
  await balcao.getByRole('button', { name: 'Autorizado' }).click();
  await balcao.getByRole('button', { name: 'Toque de novo para autorizar' }).click();
  await expect(balcao.getByText('8498 autorizado')).toBeVisible();

  const lateral = balcao.getByRole('complementary', { name: 'Pedidos abertos' });
  await expect(lateral).toContainText('8498retirada');
  const aviso = balcao.waitForEvent('popup');
  await lateral.getByRole('button', { name: 'Avisar' }).click();
  expect(decodeURIComponent((await aviso).url())).toContain('Seu pedido 8498 está pronto para retirada.');
  await lateral.getByRole('button', { name: 'Retirado' }).click();
  await lateral.getByRole('button', { name: 'Toque de novo para confirmar' }).click();
  await expect(lateral).not.toContainText('8498');

  await expect(balcao.getByText('● Salvo')).toBeVisible({ timeout: 10_000 });
  const [pedido] = await ler<{ estado: string; troco_para: number; total: number }[]>(
    luan,
    'pedidos?select=estado,troco_para,total',
  );
  expect(pedido).toEqual({ estado: 'retirado', troco_para: 10000, total: 7300 });
});
