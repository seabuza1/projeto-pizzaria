// Despacho no painel do Luan (F1, ENT6), ordem de chegada (ACE7) e Pix antecipado (PAG5).
import { beforeEach, describe, expect, it } from 'vitest';
import {
  abrirNoite,
  aplicada,
  areas,
  confirmarAcerto,
  entrar,
  lancar,
  limpar,
  novoId,
  pedidoDoBalcao,
  pg,
  type Sessao,
  sql,
  versaoDoPedido,
} from './apoio';

let luan: Sessao;
let agente: Sessao;
let area: Record<string, string>;
let noiteId: string;
let caixas: Record<string, string>;

beforeEach(async () => {
  await limpar();
  [luan, agente] = await Promise.all([entrar('luan'), entrar('agente')]);
  area = await areas();
  ({ noiteId, caixas } = await abrirNoite(luan, ['joao', 'pedro', 'felipe']));
});

const despachar = (caixa: string, ...pedidos: string[]) => {
  const saidas = pedidos.map((pedido_id) => ({ pedido_id, saida_id: novoId() }));
  return luan.op('despachar', { caixa_id: caixas[caixa] ?? '', saidas }).then((r) => ({ r, saidas }));
};

async function saidasDo(pedidoId: string) {
  return sql<{ id: string; caixa_id: string; taxa: number; cancelada_em: Date | null }[]>`
    select id, caixa_id, taxa, cancelada_em from public.saidas where pedido_id = ${pedidoId} order by criado_em`;
}

async function pagamentosDo(pedidoId: string) {
  return sql<{ forma: string; saida_id: string | null; anulado_em: Date | null }[]>`
    select forma, saida_id, anulado_em from public.pagamentos where pedido_id = ${pedidoId} order by forma`;
}

describe('despacho (F1, ENT6)', () => {
  it('tocar nos códigos e no motoboy cria uma saída por pedido, com a taxa da área (ENT2)', async () => {
    const p1 = await pedidoDoBalcao(noiteId, '3557', 45, area.Barra ?? '', [pg('dinheiro', 45)]);
    const p2 = await pedidoDoBalcao(noiteId, '0017', 60, area.Aragarças ?? '', [pg('pix_antecipado', 60)]);
    const { r, saidas } = await despachar('joao', p1, p2);
    aplicada(r);

    const [s1] = await saidasDo(p1);
    const [s2] = await saidasDo(p2);
    expect(s1).toMatchObject({ id: saidas[0]?.saida_id, caixa_id: caixas.joao, taxa: 1200 });
    expect(s2).toMatchObject({ id: saidas[1]?.saida_id, caixa_id: caixas.joao, taxa: 500 });
    // O pagamento da porta passa a ser da saída; o Pix antecipado fica só no pedido (PAG5).
    expect(await pagamentosDo(p1)).toEqual([{ forma: 'dinheiro', saida_id: s1?.id, anulado_em: null }]);
    expect(await pagamentosDo(p2)).toEqual([{ forma: 'pix_antecipado', saida_id: null, anulado_em: null }]);

    const [linha] = await sql`select interno.conta_caixa(${caixas.joao ?? ''}, null) as conta`;
    expect(linha?.conta).toMatchObject({ devolver: 12500, receber: 4700, pixAntecipado: 6000, entregues: 2 });
  });

  it('pedido que já saiu é recusado, e nenhum pedido da mesma operação sai (tudo ou nada)', async () => {
    const p1 = await pedidoDoBalcao(noiteId, '3557', 45, area.Barra ?? '', [pg('dinheiro', 45)]);
    const p2 = await pedidoDoBalcao(noiteId, '8498', 40, area.Pontal ?? '', [pg('cartao', 40)]);
    aplicada((await despachar('joao', p1)).r);

    const { r } = await despachar('pedro', p2, p1);
    expect(r).toMatchObject({ status: 'recusada', codigo: 'ja_saiu', motivo: '3557: já saiu com João.' });
    expect(await saidasDo(p2)).toEqual([]);
  });

  it('desfazer devolve o pedido para a lista, com os pagamentos; depois sai com o motoboy certo', async () => {
    const p1 = await pedidoDoBalcao(noiteId, '3557', 45, area.Barra ?? '', [pg('dinheiro', 45)]);
    const { saidas } = await despachar('joao', p1);
    const errada = saidas[0]?.saida_id ?? '';
    aplicada(await luan.op('cancelar_saida', { saida_id: errada, versao_esperada: await versaoDoPedido(p1) }));

    const [pedido] = await sql`select estado from public.pedidos where id = ${p1}`;
    expect(pedido?.estado).toBe('aberto');
    expect(await pagamentosDo(p1)).toEqual([{ forma: 'dinheiro', saida_id: null, anulado_em: null }]);

    const certa = await despachar('pedro', p1);
    aplicada(certa.r);
    expect(await pagamentosDo(p1)).toEqual([
      { forma: 'dinheiro', saida_id: certa.saidas[0]?.saida_id, anulado_em: null },
    ]);
    const [conta] = await sql`select interno.conta_caixa(${caixas.joao ?? ''}, null) as conta`;
    expect(conta?.conta).toMatchObject({ devolver: 8000, taxas: 0, entregues: 0 });
  });

  it('desfazer a comanda de papel continua desfazendo o lançamento inteiro', async () => {
    const { saidaId, pedidoId } = await lancar(luan, caixas.joao ?? '', '2672', 90, area.Barra ?? '', [
      pg('cartao', 90),
    ]);
    aplicada(await luan.op('cancelar_saida', { saida_id: saidaId, versao_esperada: await versaoDoPedido(pedidoId) }));
    const [pedido] = await sql`select estado from public.pedidos where id = ${pedidoId}`;
    expect(pedido?.estado).toBe('cancelado');
    expect((await pagamentosDo(pedidoId))[0]?.anulado_em).not.toBeNull();
    // Comanda de papel não aparece para despachar.
    const { r } = await despachar('pedro', pedidoId);
    expect(r.codigo).toBe('nao_e_entrega');
  });

  it('pedido de outra noite e caixa de outro papel são recusados', async () => {
    const r = await agente.op('despachar', {
      caixa_id: caixas.joao ?? '',
      saidas: [{ pedido_id: novoId(), saida_id: novoId() }],
    });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'sem_permissao' });
  });
});

describe('ordem de chegada (ACE7)', () => {
  const ordem = async () =>
    (
      await sql<{ motoboy: string }[]>`
        select m.nome as motoboy from public.caixas c join public.motoboys m on m.id = c.motoboy_id
        where c.noite_id = ${noiteId} order by c.ordem_chegada`
    ).map((l) => l.motoboy);

  it('muda até o primeiro acerto confirmado', async () => {
    expect(await ordem()).toEqual(['João', 'Pedro', 'Felipe']);
    aplicada(await luan.op('mudar_ordem_caixa', { caixa_id: caixas.felipe ?? '', ordem: 1 }));
    expect(await ordem()).toEqual(['Felipe', 'João', 'Pedro']);
    aplicada(await luan.op('mudar_ordem_caixa', { caixa_id: caixas.joao ?? '', ordem: 3 }));
    expect(await ordem()).toEqual(['Felipe', 'Pedro', 'João']);

    aplicada(await luan.op('informar_contado', { caixa_id: caixas.felipe ?? '', dinheiro_contado: 8000 }));
    aplicada(await confirmarAcerto(luan, caixas.felipe ?? ''));
    const r = await luan.op('mudar_ordem_caixa', { caixa_id: caixas.joao ?? '', ordem: 1 });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'ja_tem_acerto' });
  });
});

describe('Pix antecipado (PAG5)', () => {
  it('desmarcar o "caiu" pede o motivo, que fica na operação', async () => {
    const p = await pedidoDoBalcao(noiteId, '0017', 60, area.Barra ?? '', [pg('pix_antecipado', 60)]);
    const [pix] = await sql<{ id: string }[]>`select id from public.pagamentos where pedido_id = ${p}`;
    const pagamento_id = pix?.id ?? '';
    aplicada(await luan.op('marcar_pix', { pagamento_id, confirmado: true }));

    const sem = await luan.op('marcar_pix', { pagamento_id, confirmado: false });
    expect(sem).toMatchObject({ status: 'recusada', codigo: 'sem_motivo' });

    const com = aplicada(await luan.op('marcar_pix', { pagamento_id, confirmado: false, motivo: 'Era o 0071' }));
    const [op] = await sql`select dados ->> 'motivo' as motivo from public.operacoes where id = ${com.id}`;
    expect(op?.motivo).toBe('Era o 0071');
    const eventos = await sql`select 1 from public.eventos where operacao_id = ${com.id} and tabela = 'pagamentos'`;
    expect(eventos).toHaveLength(1);
  });

  it('noite fechada só se lê', async () => {
    const p = await pedidoDoBalcao(noiteId, '0017', 60, area.Barra ?? '', [pg('pix_antecipado', 60)]);
    const [pix] = await sql<{ id: string }[]>`select id from public.pagamentos where pedido_id = ${p}`;
    aplicada(await luan.op('fechar_noite', { noite_id: noiteId }));
    const r = await luan.op('marcar_pix', { pagamento_id: pix?.id ?? '', confirmado: true });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'noite_fechada' });
  });
});
