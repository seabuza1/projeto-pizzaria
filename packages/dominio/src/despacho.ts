// Despacho (F1, ENT6) e pendências do fechamento da noite (F1, Fluxo da noite, 7).
import type { Forma } from './pagamento';

export interface PedidoDespacho {
  id: string;
  codigo: string;
  tipo: 'entrega' | 'retirada' | 'mesa';
  estado: 'aberto' | 'entregue' | 'cancelado';
  /** Ordem de balcão (ENT6). ISO 8601, hora do servidor. */
  criadoEm: string;
}

export interface SaidaDespacho {
  pedidoId: string;
  /** OPE3: desfeita ou cancelada com motivo. */
  cancelada: boolean;
}

export interface PagamentoDespacho {
  pedidoId: string;
  forma: Forma;
  pixConfirmado: boolean;
  anulado: boolean;
}

/** PAG5: "conferir" até o Luan marcar "caiu" em todos os Pix antecipados do pedido. */
export type SituacaoPix = 'caiu' | 'conferir' | null;

export interface ProntoParaSair<P extends PedidoDespacho = PedidoDespacho> {
  pedido: P;
  pix: SituacaoPix;
}

const pixDoPedido = (pedidoId: string, pagamentos: readonly PagamentoDespacho[]) =>
  pagamentos.filter((p) => p.pedidoId === pedidoId && p.forma === 'pix_antecipado' && !p.anulado);

export function situacaoPix(pedidoId: string, pagamentos: readonly PagamentoDespacho[]): SituacaoPix {
  const pix = pixDoPedido(pedidoId, pagamentos);
  if (pix.length === 0) return null;
  return pix.every((p) => p.pixConfirmado) ? 'caiu' : 'conferir';
}

/**
 * Pedidos de entrega que ainda não saíram, por ordem de balcão (ENT6).
 * Uma saída cancelada devolve o pedido para a lista (ERROS-PREVISTOS: despachou para o motoboy errado).
 */
export function prontosParaSair<P extends PedidoDespacho>(
  pedidos: readonly P[],
  saidas: readonly SaidaDespacho[],
  pagamentos: readonly PagamentoDespacho[],
): ProntoParaSair<P>[] {
  const comSaida = new Set(saidas.filter((s) => !s.cancelada).map((s) => s.pedidoId));
  return pedidos
    .filter((p) => p.tipo === 'entrega' && p.estado === 'aberto' && !comSaida.has(p.id))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    .map((pedido) => ({ pedido, pix: situacaoPix(pedido.id, pagamentos) }));
}

export interface PendenciasNoite<P extends PedidoDespacho = PedidoDespacho> {
  /** "Pedido autorizado sem saída" (ERROS-PREVISTOS: Luan esquece de despachar). */
  semSaida: P[];
  caixasSemAcerto: string[];
  /** Pix antecipado sem "caiu". */
  pixSemCaiu: P[];
  total: number;
}

/** O que o fechamento da noite lista para o Luan resolver ou confirmar. Os rascunhos entram com a F2. */
export function pendenciasDaNoite<P extends PedidoDespacho>(noite: {
  pedidos: readonly P[];
  saidas: readonly SaidaDespacho[];
  pagamentos: readonly PagamentoDespacho[];
  caixas: readonly { id: string }[];
  acertos: readonly { caixaId: string }[];
}): PendenciasNoite<P> {
  const semSaida = prontosParaSair(noite.pedidos, noite.saidas, noite.pagamentos).map((p) => p.pedido);
  const comAcerto = new Set(noite.acertos.map((a) => a.caixaId));
  const caixasSemAcerto = noite.caixas.filter((c) => !comAcerto.has(c.id)).map((c) => c.id);
  const pixSemCaiu = noite.pedidos.filter(
    (p) => p.estado !== 'cancelado' && situacaoPix(p.id, noite.pagamentos) === 'conferir',
  );
  return {
    semSaida,
    caixasSemAcerto,
    pixSemCaiu,
    total: semSaida.length + caixasSemAcerto.length + pixSemCaiu.length,
  };
}
