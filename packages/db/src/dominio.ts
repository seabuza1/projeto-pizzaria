// Linhas do banco → entradas das funções puras de @mel/dominio.
import {
  type Cardapio,
  centavos,
  type EntradaAcerto,
  type Faixa,
  type PagamentoAcerto,
  type PedidoAcerto,
  type SaidaAcerto,
  type Tamanho,
} from '@mel/dominio';
import type { Tables } from './database.types';

export type LinhaCaixa = Pick<Tables<'caixas'>, 'id' | 'caixa_inicial' | 'diaria' | 'dinheiro_contado'>;
export type LinhaPedido = Pick<Tables<'pedidos'>, 'id' | 'codigo'>;
export type LinhaSaida = Pick<
  Tables<'saidas'>,
  'id' | 'pedido_id' | 'caixa_id' | 'area_id' | 'taxa' | 'estado' | 'papel_conferido' | 'cancelada_em'
>;
export type LinhaPagamento = Pick<
  Tables<'pagamentos'>,
  'id' | 'pedido_id' | 'saida_id' | 'forma' | 'valor' | 'troco_pix' | 'real' | 'registrado_em' | 'anulado_em'
>;

export const pedidoParaDominio = (p: LinhaPedido): PedidoAcerto => ({ id: p.id, codigo: p.codigo });

export const saidaParaDominio = (s: LinhaSaida): SaidaAcerto => ({
  id: s.id,
  pedidoId: s.pedido_id,
  area: s.area_id,
  taxa: centavos(s.taxa),
  estado: s.estado,
  papelConferido: s.papel_conferido,
  cancelada: s.cancelada_em !== null,
});

export const pagamentoParaDominio = (p: LinhaPagamento): PagamentoAcerto => ({
  id: p.id,
  pedidoId: p.pedido_id,
  saidaId: p.saida_id,
  forma: p.forma,
  valor: centavos(p.valor),
  trocoPix: centavos(p.troco_pix),
  real: p.real,
  anulado: p.anulado_em !== null,
  criadoEm: new Date(p.registrado_em).toISOString(),
});

/** Monta a entrada do acerto de um caixa a partir das linhas da noite. */
export function entradaDoCaixa(
  caixa: LinhaCaixa,
  linhas: { pedidos: readonly LinhaPedido[]; saidas: readonly LinhaSaida[]; pagamentos: readonly LinhaPagamento[] },
): EntradaAcerto {
  const saidas = linhas.saidas.filter((s) => s.caixa_id === caixa.id);
  const pedidosIds = new Set(saidas.map((s) => s.pedido_id));
  return {
    caixaInicial: centavos(caixa.caixa_inicial),
    diaria: centavos(caixa.diaria),
    dinheiroContado: caixa.dinheiro_contado === null ? null : centavos(caixa.dinheiro_contado),
    pedidos: linhas.pedidos.filter((p) => pedidosIds.has(p.id)).map(pedidoParaDominio),
    saidas: saidas.map(saidaParaDominio),
    pagamentos: linhas.pagamentos.filter((p) => pedidosIds.has(p.pedido_id)).map(pagamentoParaDominio),
  };
}

export interface LinhasCardapio {
  faixas: readonly Pick<Tables<'cardapio_faixas'>, 'faixa' | 'tamanho' | 'preco'>[];
  sabores: readonly Tables<'cardapio_sabores'>[];
  bordas: readonly Tables<'cardapio_bordas'>[];
  adicionais: readonly Tables<'cardapio_adicionais'>[];
  bebidas: readonly Tables<'cardapio_bebidas'>[];
  combos: readonly Tables<'cardapio_combos'>[];
}

const FAIXAS: readonly Faixa[] = ['tradicional', 'especial', 'premium', 'doce', 'doce_especial'];
const TAMANHOS: readonly Tamanho[] = ['B', 'P', 'M', 'G'];

/**
 * Linhas do cardápio → cardápio de venda do domínio, na ordem do cardápio impresso.
 * Ficam de fora os itens inativos e os que acabaram hoje (ids em `acabou`).
 */
export function cardapioDasLinhas(l: LinhasCardapio, acabou: ReadonlySet<string> = new Set()): Cardapio {
  const vale = <T extends { id: string; ativo: boolean; ordem: number }>(itens: readonly T[]) =>
    itens.filter((i) => i.ativo && !acabou.has(i.id)).sort((a, b) => a.ordem - b.ordem);
  const preco = (faixa: Faixa, tamanho: Tamanho) => {
    const linha = l.faixas.find((f) => f.faixa === faixa && f.tamanho === tamanho);
    if (!linha) throw new Error(`Cardápio sem o preço da faixa ${faixa} no tamanho ${tamanho}.`);
    return centavos(linha.preco);
  };
  const item = (i: { nome: string; preco: number; apelidos?: string[] }) => ({
    nome: i.nome,
    preco: centavos(i.preco),
    apelidos: i.apelidos ?? [],
  });
  return {
    faixas: Object.fromEntries(
      FAIXAS.map((f) => [f, Object.fromEntries(TAMANHOS.map((t) => [t, preco(f, t)]))]),
    ) as Cardapio['faixas'],
    sabores: vale(l.sabores).map((s) => ({ nome: s.nome, faixa: s.faixa, apelidos: s.apelidos })),
    bordas: vale(l.bordas).map(item),
    adicionais: vale(l.adicionais)
      .filter((a) => !a.avulso)
      .map(item),
    outros: vale(l.adicionais)
      .filter((a) => a.avulso)
      .map(item),
    bebidas: vale(l.bebidas).map(item),
    combos: vale(l.combos).map((c) => ({ id: c.codigo, itens: c.itens, preco: centavos(c.preco) })),
  };
}
