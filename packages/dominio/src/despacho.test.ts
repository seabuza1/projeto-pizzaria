import { describe, expect, it } from 'vitest';
import {
  type PagamentoDespacho,
  type PedidoDespacho,
  pendenciasDaNoite,
  prontosParaSair,
  type SaidaDespacho,
  situacaoPix,
} from './despacho';

const pedido = (id: string, criadoEm: string, extra: Partial<PedidoDespacho> = {}): PedidoDespacho => ({
  id,
  codigo: id,
  tipo: 'entrega',
  estado: 'em_producao',
  criadoEm: `2026-10-16T${criadoEm}:00Z`,
  ...extra,
});
const saida = (pedidoId: string, cancelada = false): SaidaDespacho => ({ pedidoId, cancelada });
const pix = (pedidoId: string, confirmado: boolean, anulado = false): PagamentoDespacho => ({
  pedidoId,
  forma: 'pix_antecipado',
  pixConfirmado: confirmado,
  real: false,
  anulado,
});
const din = (pedidoId: string): PagamentoDespacho => ({
  pedidoId,
  forma: 'dinheiro',
  pixConfirmado: false,
  real: false,
  anulado: false,
});

describe('situação do Pix antecipado (PAG5)', () => {
  it('sem Pix antecipado: nada', () => {
    expect(situacaoPix('3557', [din('3557')])).toBeNull();
  });
  it('"conferir" enquanto um Pix do pedido não caiu; "caiu" quando todos caíram', () => {
    expect(situacaoPix('0017', [pix('0017', false)])).toBe('conferir');
    expect(situacaoPix('0017', [pix('0017', true), pix('0017', false)])).toBe('conferir');
    expect(situacaoPix('0017', [pix('0017', true), din('0017')])).toBe('caiu');
  });
  it('a forma confirmada na porta vale: Pix que não caiu e foi pago em dinheiro não fica pendente', () => {
    expect(situacaoPix('0017', [pix('0017', false), { ...din('0017'), real: true }])).toBeNull();
  });
  it('Pix anulado (troca de forma) não conta', () => {
    expect(situacaoPix('0017', [pix('0017', false, true)])).toBeNull();
    expect(situacaoPix('0017', [pix('0017', false, true), pix('0017', true)])).toBe('caiu');
  });
});

describe('prontos para sair (F1, despacho; ENT6)', () => {
  it('entregas autorizadas sem saída, por ordem de balcão, com a situação do Pix', () => {
    const pedidos = [
      pedido('8498', '22:10'),
      pedido('3557', '22:00'),
      pedido('0017', '22:05'),
      pedido('1693', '21:50', { tipo: 'retirada' }),
      pedido('2672', '21:40', { estado: 'cancelado' }),
      pedido('0910', '21:30'),
    ];
    const prontos = prontosParaSair(pedidos, [saida('0910')], [pix('0017', false), din('3557')]);
    expect(prontos.map((p) => [p.pedido.codigo, p.pix])).toEqual([
      ['3557', null],
      ['0017', 'conferir'],
      ['8498', null],
    ]);
  });
  it('a saída cancelada (despacho para o motoboy errado) devolve o pedido para a lista', () => {
    const prontos = prontosParaSair([pedido('3557', '22:00')], [saida('3557', true)], []);
    expect(prontos.map((p) => p.pedido.codigo)).toEqual(['3557']);
  });
});

describe('pendências do fechamento (F1, Fluxo da noite, 7; ERROS-PREVISTOS)', () => {
  const pedidos = [pedido('3557', '22:00'), pedido('0017', '22:05'), pedido('8498', '22:10')];
  const caixas = [{ id: 'felipe' }, { id: 'joao' }];

  it('Luan esquece de despachar: lista o pedido sem saída', () => {
    const p = pendenciasDaNoite({
      pedidos,
      saidas: [saida('0017'), saida('8498')],
      pagamentos: [],
      caixas,
      acertos: [{ caixaId: 'felipe' }, { caixaId: 'joao' }],
    });
    expect(p.semSaida.map((x) => x.codigo)).toEqual(['3557']);
    expect(p.total).toBe(1);
  });

  it('lista o caixa sem acerto e o Pix sem "caiu"', () => {
    const p = pendenciasDaNoite({
      pedidos,
      saidas: [saida('3557'), saida('0017'), saida('8498')],
      pagamentos: [pix('0017', false), pix('8498', true)],
      caixas,
      acertos: [{ caixaId: 'felipe' }],
    });
    expect(p.semSaida).toEqual([]);
    expect(p.caixasSemAcerto).toEqual(['joao']);
    expect(p.pixSemCaiu.map((x) => x.codigo)).toEqual(['0017']);
    expect(p.total).toBe(2);
  });

  it('o cliente sumiu no meio da conversa: lista o rascunho e o que aguarda o cliente', () => {
    const p = pendenciasDaNoite({
      pedidos: [pedido('8498', '22:10', { estado: 'rascunho' }), pedido('1693', '22:20', { estado: 'aguardando' })],
      saidas: [],
      pagamentos: [],
      caixas: [],
      acertos: [],
    });
    expect(p.rascunhos.map((x) => x.codigo)).toEqual(['8498', '1693']);
    expect(p.semSaida).toEqual([]);
    expect(p.total).toBe(2);
  });

  it('Pix de pedido cancelado não fica pendente', () => {
    const p = pendenciasDaNoite({
      pedidos: [pedido('0017', '22:05', { estado: 'cancelado' })],
      saidas: [],
      pagamentos: [pix('0017', false)],
      caixas: [],
      acertos: [],
    });
    expect(p.total).toBe(0);
  });
});
