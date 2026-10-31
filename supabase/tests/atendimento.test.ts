// Pedido do atendimento (F2, 2b e 2e): rascunho, resumo, autorização, trava, alteração, cancelamento e retirada.
import type { DadosDe } from '@mel/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirNoite, aplicada, areas, entrar, limpar, novoId, pg, type Sessao, sql, versaoDoPedido } from './apoio';

let luan: Sessao;
let atendimento: Sessao;
let area: Record<string, string>;

beforeEach(async () => {
  await limpar();
  [luan, atendimento] = await Promise.all([entrar('luan'), entrar('atendimento')]);
  area = await areas();
});

type Linha = DadosDe<'salvar_pedido'>['itens'][number];
const linha = (nome: string, reais: number, extra: Partial<Linha> = {}): Linha => {
  const unitario = Math.round(reais * 100);
  const quantidade = extra.quantidade ?? 1;
  const desconto = extra.desconto ?? 0;
  return {
    item: { tipo: 'bebida', nome },
    nome,
    detalhes: [],
    faixa_cobrada: null,
    unitario,
    desconto,
    quantidade,
    total: (unitario - desconto) * quantidade,
    ...extra,
  };
};
// A 3557 real: G ½ Filé Mignon ½ Calabresa + Refrigerante 2L, Aragarças, cartão (P2).
const itens3557 = () => [
  linha('G ½ Filé Mignon ½ Calabresa', 93, {
    item: { tipo: 'pizza', tamanho: 'G', sabores: ['Filé Mignon', 'Calabresa'] },
    faixa_cobrada: 'premium',
  }),
  linha('Refrigerante 2L', 15),
];

function pedido(extra: Partial<DadosDe<'salvar_pedido'>> = {}): DadosDe<'salvar_pedido'> {
  return {
    pedido_id: novoId(),
    noite_id: novoId(),
    etapa: 'rascunho',
    telefone: '64999993557',
    tipo: 'entrega',
    area_id: area.Aragarças ?? null,
    itens: itens3557(),
    pagamentos: [pg('cartao', 113)],
    promocao: false,
    local_pendente: false,
    endereco_referencia: 'hospital',
    aparelho: 'balcao',
    ...extra,
  };
}

describe('pedido do atendimento', () => {
  it('ninguém abriu a noite: o primeiro pedido abre com os padrões', async () => {
    const r = aplicada(await atendimento.op('salvar_pedido', pedido()));
    const noites = await sql`select id from public.noites`;
    expect(noites).toHaveLength(1);
    expect(r.resultado).toMatchObject({ noite_id: noites[0]?.id, total: 11300 });
  });

  it('rascunho → aguardando cliente → autorizado; os itens guardam a fotografia (P2)', async () => {
    const { noiteId } = await abrirNoite(luan, []);
    const p = pedido({ noite_id: noiteId });
    aplicada(await atendimento.op('salvar_pedido', p));
    aplicada(await atendimento.op('salvar_pedido', { ...p, etapa: 'aguardando' }));
    const [aguardando] = await sql`select estado, codigo, total, atendendo_aparelho from public.pedidos`;
    expect(aguardando).toMatchObject({
      estado: 'aguardando',
      codigo: '3557',
      total: 11300,
      atendendo_aparelho: 'balcao',
    });
    expect(await sql`select 1 from public.pedido_itens`).toHaveLength(0);

    aplicada(await atendimento.op('salvar_pedido', { ...p, etapa: 'autorizar' }));
    const [autorizado] = await sql`
      select estado, autorizado_em is not null as autorizado, atendendo_aparelho, alterado from public.pedidos`;
    expect(autorizado).toMatchObject({
      estado: 'em_producao',
      autorizado: true,
      atendendo_aparelho: null,
      alterado: false,
    });
    const itens = await sql`select nome, faixa_cobrada, unitario, total from public.pedido_itens order by ordem`;
    expect(itens).toEqual([
      { nome: 'G ½ Filé Mignon ½ Calabresa', faixa_cobrada: 'premium', unitario: 9300, total: 9300 },
      { nome: 'Refrigerante 2L', faixa_cobrada: null, unitario: 1500, total: 1500 },
    ]);
    const pags = await sql`select forma, valor, real, saida_id from public.pagamentos`;
    expect(pags).toEqual([{ forma: 'cartao', valor: 11300, real: false, saida_id: null }]);
  });

  it('autorizar confere a área, os itens e os pagamentos (PAG2)', async () => {
    const { noiteId } = await abrirNoite(luan, []);
    const sem = await atendimento.op('salvar_pedido', pedido({ noite_id: noiteId, etapa: 'autorizar', area_id: null }));
    expect(sem.codigo).toBe('area_invalida');
    const pag = await atendimento.op(
      'salvar_pedido',
      pedido({ noite_id: noiteId, etapa: 'autorizar', pagamentos: [pg('cartao', 100)] }),
    );
    expect(pag.codigo).toBe('soma_diferente');
    const conta = await atendimento.op(
      'salvar_pedido',
      pedido({ noite_id: noiteId, itens: [{ ...linha('Refrigerante 2L', 15), total: 100 }] }),
    );
    expect(conta.codigo).toBe('item_invalido');
  });

  it('desconto só com a promoção da noite (PED4)', async () => {
    const { noiteId } = await abrirNoite(luan, []);
    const portuguesa = linha('G Portuguesa', 73, { desconto: 1000, faixa_cobrada: 'tradicional' });
    const semPromo = await atendimento.op(
      'salvar_pedido',
      pedido({ noite_id: noiteId, promocao: true, itens: [portuguesa], pagamentos: [pg('dinheiro', 68)] }),
    );
    expect(semPromo.codigo).toBe('promo_invalida');
    aplicada(await luan.op('definir_promocao', { noite_id: noiteId, desconto: 1000 }));
    // P3: G Portuguesa com promoção de R$ 10, Aragarças = R$ 68.
    const r = aplicada(
      await atendimento.op(
        'salvar_pedido',
        pedido({
          noite_id: noiteId,
          etapa: 'autorizar',
          promocao: true,
          itens: [portuguesa],
          pagamentos: [pg('dinheiro', 68)],
        }),
      ),
    );
    expect(r.resultado).toMatchObject({ total: 6800 });
  });

  it('trava: outro aparelho no mesmo telefone é recusado; "Assumir" passa o pedido', async () => {
    const { noiteId } = await abrirNoite(luan, []);
    const doBalcao = pedido({ noite_id: noiteId });
    aplicada(await atendimento.op('salvar_pedido', doBalcao));

    const outro = await luan.op('salvar_pedido', pedido({ noite_id: noiteId, aparelho: 'celular-luan' }));
    expect(outro).toMatchObject({ status: 'recusada', codigo: 'em_atendimento' });
    expect(outro.motivo).toMatch(/^3557: atendendo em outro aparelho há 0 min/);
    const mesmo = await luan.op('salvar_pedido', { ...doBalcao, aparelho: 'celular-luan' });
    expect(mesmo.codigo).toBe('em_atendimento');

    aplicada(await luan.op('assumir_pedido', { pedido_id: doBalcao.pedido_id, aparelho: 'celular-luan' }));
    aplicada(await luan.op('salvar_pedido', { ...doBalcao, aparelho: 'celular-luan', etapa: 'aguardando' }));
    const volta = await atendimento.op('salvar_pedido', doBalcao);
    expect(volta.codigo).toBe('em_atendimento');
  });

  it('alterar antes de sair: total novo e "ALTERADO"; a versão anterior fica anulada; depois de sair, não', async () => {
    const { noiteId, caixas } = await abrirNoite(luan, ['joao']);
    const p = pedido({ noite_id: noiteId, etapa: 'autorizar' });
    aplicada(await atendimento.op('salvar_pedido', p));
    const semVersao = await atendimento.op('salvar_pedido', p);
    expect(semVersao.codigo).toBe('versao_ausente');

    const alterado = {
      ...p,
      itens: [...itens3557(), linha('Refrigerante lata', 8)],
      pagamentos: [pg('cartao', 121)],
      versao_esperada: await versaoDoPedido(p.pedido_id),
    };
    aplicada(await atendimento.op('salvar_pedido', alterado));
    const [ped] = await sql`select total, alterado, estado from public.pedidos`;
    expect(ped).toMatchObject({ total: 12100, alterado: true, estado: 'em_producao' });
    const itens = await sql`select count(*) filter (where anulado_em is null)::int as valem, count(*)::int as todos
      from public.pedido_itens`;
    expect(itens[0]).toEqual({ valem: 3, todos: 5 });
    const pags = await sql`select valor from public.pagamentos where anulado_em is null`;
    expect(pags).toEqual([{ valor: 12100 }]);

    aplicada(
      await luan.op('despachar', {
        caixa_id: caixas.joao ?? '',
        saidas: [{ pedido_id: p.pedido_id, saida_id: novoId() }],
      }),
    );
    const depois = await atendimento.op('salvar_pedido', {
      ...alterado,
      versao_esperada: await versaoDoPedido(p.pedido_id),
    });
    expect(depois.codigo).toBe('pedido_encerrado');
  });

  it('cancelar com motivo: a saída é cancelada e os pagamentos ficam anulados', async () => {
    const { noiteId, caixas } = await abrirNoite(luan, ['joao']);
    const p = pedido({ noite_id: noiteId, etapa: 'autorizar' });
    aplicada(await atendimento.op('salvar_pedido', p));
    aplicada(
      await luan.op('despachar', {
        caixa_id: caixas.joao ?? '',
        saidas: [{ pedido_id: p.pedido_id, saida_id: novoId() }],
      }),
    );
    const semMotivo = await atendimento.opAntiga('cancelar_pedido', {
      pedido_id: p.pedido_id,
      motivo: ' ',
      versao_esperada: await versaoDoPedido(p.pedido_id),
    });
    expect(semMotivo.codigo).toBe('sem_motivo');
    aplicada(
      await atendimento.op('cancelar_pedido', {
        pedido_id: p.pedido_id,
        motivo: 'Cliente desistiu',
        versao_esperada: await versaoDoPedido(p.pedido_id),
      }),
    );
    const [ped] = await sql`select estado, motivo_cancelamento from public.pedidos`;
    expect(ped).toEqual({ estado: 'cancelado', motivo_cancelamento: 'Cliente desistiu' });
    const [saida] = await sql`select cancelada_em is not null as cancelada from public.saidas`;
    expect(saida?.cancelada).toBe(true);
    expect(await sql`select 1 from public.pagamentos where anulado_em is null`).toHaveLength(0);
  });

  it('retirada: sem taxa (P8); retirado com o pagamento do balcão', async () => {
    const { noiteId } = await abrirNoite(luan, []);
    const p = pedido({
      noite_id: noiteId,
      etapa: 'autorizar',
      tipo: 'retirada',
      area_id: null,
      itens: [linha('G Frango c/ Catupiry', 73, { faixa_cobrada: 'tradicional' })],
      pagamentos: [pg('cartao', 73)],
    });
    const r = aplicada(await atendimento.op('salvar_pedido', p));
    expect(r.resultado).toMatchObject({ total: 7300 });
    aplicada(
      await atendimento.op('marcar_retirado', {
        pedido_id: p.pedido_id,
        versao_esperada: await versaoDoPedido(p.pedido_id),
        pagamentos: [pg('dinheiro', 73)],
      }),
    );
    const [ped] = await sql`select estado, retirado_em is not null as retirado from public.pedidos`;
    expect(ped).toEqual({ estado: 'retirado', retirado: true });
    const reais = await sql`select forma from public.pagamentos where real`;
    expect(reais).toEqual([{ forma: 'dinheiro' }]);
  });

  it('o atendimento não despacha nem vê caixas; vê pedidos, itens e saídas', async () => {
    const { noiteId, caixas } = await abrirNoite(luan, ['joao']);
    aplicada(await atendimento.op('salvar_pedido', pedido({ noite_id: noiteId, etapa: 'autorizar' })));
    const r = await atendimento.op('despachar', {
      caixa_id: caixas.joao ?? '',
      saidas: [{ pedido_id: novoId(), saida_id: novoId() }],
    });
    expect(r.codigo).toBe('sem_permissao');
    expect((await atendimento.db.from('caixas').select('id')).data).toEqual([]);
    expect((await atendimento.db.from('pedidos').select('codigo')).data).toEqual([{ codigo: '3557' }]);
    expect((await atendimento.db.from('pedido_itens').select('nome')).data).toHaveLength(2);
  });
});
