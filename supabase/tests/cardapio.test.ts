// Cardápio, "acabou hoje", promoção da noite e clientes (F2, 2a e 2g).
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirNoite, aplicada, entrar, limpar, novoId, type Sessao, sql } from './apoio';

let felipe: Sessao;
let luan: Sessao;
let dona: Sessao;
let atendimento: Sessao;
let agente: Sessao;
let noiteId: string;

beforeEach(async () => {
  await limpar();
  [felipe, luan, dona, atendimento, agente] = await Promise.all([
    entrar('felipe'),
    entrar('luan'),
    entrar('dona'),
    entrar('atendimento'),
    entrar('agente'),
  ]);
  ({ noiteId } = await abrirNoite(luan, []));
});

const precoG = async (faixa: string) => {
  const [l] = await sql<{ preco: number }[]>`
    select preco from public.cardapio_faixas where faixa = ${faixa} and tamanho = 'G'`;
  return l?.preco;
};

describe('cardápio (PED8)', () => {
  it('o seed vem do JSON: G tradicional R$ 73, Combo 01 R$ 149,99 e o apelido "filé"', async () => {
    expect(await precoG('tradicional')).toBe(7300);
    const [combo] = await sql`select preco from public.cardapio_combos where codigo = '01'`;
    expect(combo?.preco).toBe(14999);
    const [file] = await sql`select nome from public.cardapio_sabores where 'filé' = any (apelidos)`;
    expect(file?.nome).toBe('Filé Mignon');
  });

  it('só gerente e admin mudam preço; a mudança fica em eventos, de quanto para quanto', async () => {
    const r = await luan.op('salvar_preco_faixa', { faixa: 'tradicional', tamanho: 'G', preco: 7500 });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'sem_permissao' });
    const atend = await atendimento.op('salvar_preco_faixa', { faixa: 'tradicional', tamanho: 'G', preco: 7500 });
    expect(atend.codigo).toBe('sem_permissao');

    const ok = aplicada(await dona.op('salvar_preco_faixa', { faixa: 'tradicional', tamanho: 'G', preco: 7500 }));
    expect(await precoG('tradicional')).toBe(7500);
    const [ev] = await sql`
      select autor, antes ->> 'preco' as antes, depois ->> 'preco' as depois from public.eventos
      where operacao_id = ${ok.id} and tabela = 'cardapio_faixas'`;
    expect(ev).toMatchObject({ autor: dona.id, antes: '7300', depois: '7500' });

    aplicada(await felipe.op('salvar_preco_faixa', { faixa: 'tradicional', tamanho: 'G', preco: 7300 }));
  });

  it('a gerente cadastra e desativa um item; nome repetido é recusado', async () => {
    const item_id = novoId();
    const base = { tipo: 'bebida' as const, item_id, nome: 'Suco de Cajá', preco: 900, grupo: 'sucos', ativo: true };
    aplicada(await dona.op('salvar_item_cardapio', base));
    aplicada(await dona.op('salvar_item_cardapio', { ...base, ativo: false }));
    const [b] = await sql`select preco, ativo from public.cardapio_bebidas where id = ${item_id}`;
    expect(b).toMatchObject({ preco: 900, ativo: false });

    const repetido = await dona.op('salvar_item_cardapio', { ...base, item_id: novoId(), nome: 'refrigerante 2l' });
    expect(repetido).toMatchObject({ status: 'recusada', codigo: 'dados_invalidos' });
    await sql`delete from public.cardapio_bebidas where id = ${item_id}`;
  });
});

describe('"acabou hoje"', () => {
  const sabor = async () => {
    const [s] = await sql<{ id: string }[]>`select id from public.cardapio_sabores where nome = 'Calabresa'`;
    return s?.id ?? '';
  };

  it('o atendimento marca e desmarca; vale só na noite', async () => {
    const item_id = await sabor();
    aplicada(await atendimento.op('marcar_acabou', { noite_id: noiteId, tipo: 'sabor', item_id, acabou: true }));
    // Marcar duas vezes não duplica.
    aplicada(await luan.op('marcar_acabou', { noite_id: noiteId, tipo: 'sabor', item_id, acabou: true }));
    expect(await sql`select 1 from public.cardapio_acabou where noite_id = ${noiteId}`).toHaveLength(1);
    aplicada(await atendimento.op('marcar_acabou', { noite_id: noiteId, tipo: 'sabor', item_id, acabou: false }));
    expect(await sql`select 1 from public.cardapio_acabou where noite_id = ${noiteId}`).toHaveLength(0);
  });

  it('noite fechada não muda; o agente não marca', async () => {
    const item_id = await sabor();
    const r = await agente.op('marcar_acabou', { noite_id: noiteId, tipo: 'sabor', item_id, acabou: true });
    expect(r.codigo).toBe('sem_permissao');
    aplicada(await luan.op('fechar_noite', { noite_id: noiteId }));
    const fechada = await luan.op('marcar_acabou', { noite_id: noiteId, tipo: 'sabor', item_id, acabou: true });
    expect(fechada.codigo).toBe('noite_fechada');
  });
});

describe('promoção da noite (PED4; F2, 2g)', () => {
  it('a expedição define de R$ 3 a R$ 23, ou "sem promoção"; o atendimento não', async () => {
    aplicada(await luan.op('definir_promocao', { noite_id: noiteId, desconto: 1000 }));
    const [n] = await sql`select promo_desconto from public.noites where id = ${noiteId}`;
    expect(n?.promo_desconto).toBe(1000);
    aplicada(await dona.op('definir_promocao', { noite_id: noiteId, desconto: 0 }));

    const fora = await luan.opAntiga('definir_promocao', { noite_id: noiteId, desconto: 2500 });
    expect(fora.codigo).toBe('promo_fora_da_faixa');
    const atend = await atendimento.op('definir_promocao', { noite_id: noiteId, desconto: 500 });
    expect(atend.codigo).toBe('sem_permissao');
  });
});

describe('clientes (F2, 2a)', () => {
  it('a equipe do balcão salva pelo telefone; dois aparelhos ficam num cliente só', async () => {
    const telefone = '64999993557';
    aplicada(await atendimento.op('salvar_cliente', { cliente_id: novoId(), telefone, nome: 'Maria' }));
    aplicada(
      await luan.op('salvar_cliente', {
        cliente_id: novoId(),
        telefone,
        local_link: 'https://maps.app.goo.gl/abc',
        local_referencia: 'hospital',
      }),
    );
    const clientes = await sql`select nome, local_link, local_referencia from public.clientes`;
    expect(clientes).toEqual([
      { nome: 'Maria', local_link: 'https://maps.app.goo.gl/abc', local_referencia: 'hospital' },
    ]);
  });

  it('só a equipe do balcão lê clientes e cardápio; o agente não', async () => {
    aplicada(await atendimento.op('salvar_cliente', { cliente_id: novoId(), telefone: '64999993557', nome: 'Maria' }));
    const { data: doAtendimento } = await atendimento.db.from('clientes').select('nome');
    expect(doAtendimento).toEqual([{ nome: 'Maria' }]);
    const { data: doAgente } = await agente.db.from('clientes').select('nome');
    expect(doAgente).toEqual([]);
    const { data: cardapio } = await agente.db.from('cardapio_sabores').select('nome');
    expect(cardapio).toEqual([]);
    const r = await agente.op('salvar_cliente', { cliente_id: novoId(), telefone: '64999993557' });
    expect(r.codigo).toBe('sem_permissao');
  });

  it('telefone sem DDD é recusado', async () => {
    const r = await atendimento.opAntiga('salvar_cliente', { cliente_id: novoId(), telefone: '99993557' });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'telefone_invalido' });
  });
});
