// Linhas do banco → entradas das funções puras de @mel/dominio.
import { centavos, type EntradaAcerto, type PagamentoAcerto, type PedidoAcerto, type SaidaAcerto } from '@mel/dominio';
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
