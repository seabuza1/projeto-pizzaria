// Conta do acerto de um caixa (um motoboy numa noite). Spec: docs/fases/F1-acerto.md.
// Funções puras, tudo em centavos.
import type { Forma } from './pagamento';

/** ENT5 */
export type EstadoSaida = 'separada' | 'em_rota' | 'entregue' | 'voltou';

export interface PedidoAcerto {
  id: string;
  codigo: string;
}

export interface SaidaAcerto {
  id: string;
  pedidoId: string;
  area: string;
  /** ENT2: taxa gravada na saída; mudar a tabela de áreas não muda saídas antigas. */
  taxa: number;
  estado: EstadoSaida;
  papelConferido: boolean;
}

export interface PagamentoAcerto {
  id: string;
  pedidoId: string;
  /** Saída que recebeu na porta. Pix antecipado fica só no pedido (null). */
  saidaId: string | null;
  forma: Forma;
  valor: number;
  trocoPix: number;
  /** PAG3: false = forma prevista na comanda; true = forma confirmada na porta. */
  real: boolean;
  /** ISO 8601, para a ordem da lista da maquininha. */
  criadoEm: string;
}

export interface EntradaAcerto {
  caixaInicial: number;
  diaria: number;
  /** Pedidos das saídas do caixa. */
  pedidos: readonly PedidoAcerto[];
  /** Todas as saídas do motoboy na noite. */
  saidas: readonly SaidaAcerto[];
  /** Pagamentos desses pedidos. */
  pagamentos: readonly PagamentoAcerto[];
  dinheiroContado?: number | null;
}

export interface Liquidacao {
  dinheiroContado: number;
  dif: number;
  falta: number;
  sobra: number;
  pagar: number;
  completa: number;
  doCaixaDele: number;
  retiradoCaixaEmpresa: number;
  vaiParaEmpresa: number;
}

export interface TotalArea {
  entregues: number;
  voltaram: number;
  taxas: number;
}

export interface SaidaSemPapel {
  saidaId: string;
  codigo: string;
}

export interface ItemMaquininha {
  pagamentoId: string;
  codigo: string;
  forma: 'cartao' | 'pix_maquininha';
  valor: number;
}

export interface Aviso {
  tipo: 'saida_em_rota';
  saidaId: string;
  codigo: string;
  mensagem: string;
}

export interface ContaAcerto {
  caixaInicial: number;
  diaria: number;
  dinheiro: number;
  troco: number;
  cartao: number;
  pixMaquina: number;
  pixAntecipado: number;
  taxas: number;
  devolver: number;
  maquininha: number;
  receber: number;
  entregues: number;
  voltaram: number;
  porArea: Record<string, TotalArea>;
  papelFaltando: SaidaSemPapel[];
  listaMaquininha: ItemMaquininha[];
  avisos: Aviso[];
  /** null enquanto o dinheiro não foi contado. */
  liquidacao: Liquidacao | null;
}

const soma = (pagamentos: readonly PagamentoAcerto[], campo: (p: PagamentoAcerto) => number) =>
  pagamentos.reduce((total, p) => total + campo(p), 0);

/**
 * PAG3: os pagamentos que valem para uma saída entregue. São os do pedido ligados a ela
 * ou só ao pedido (Pix antecipado); os reais, se houver, senão os previstos.
 */
function pagamentosDaSaida(saida: SaidaAcerto, pagamentos: readonly PagamentoAcerto[]): PagamentoAcerto[] {
  const doPedido = pagamentos.filter(
    (p) => p.pedidoId === saida.pedidoId && (p.saidaId === saida.id || p.saidaId === null),
  );
  const reais = doPedido.filter((p) => p.real);
  return reais.length > 0 ? reais : doPedido.filter((p) => !p.real);
}

export function calcularAcerto(entrada: EntradaAcerto): ContaAcerto {
  const { caixaInicial, diaria, saidas } = entrada;
  const codigoDe = new Map(entrada.pedidos.map((p) => [p.id, p.codigo]));
  const codigo = (saida: SaidaAcerto) => codigoDe.get(saida.pedidoId) ?? '';

  // ENT5: a saída que voltou conta a taxa, mas não os valores do pedido.
  // Em rota (ou separada) no fechamento conta como entregue, com aviso.
  const entregues = saidas.filter((s) => s.estado !== 'voltou');
  const avisos: Aviso[] = entregues
    .filter((s) => s.estado !== 'entregue')
    .map((s) => ({
      tipo: 'saida_em_rota',
      saidaId: s.id,
      codigo: codigo(s),
      mensagem: `${codigo(s)} ainda ${s.estado === 'em_rota' ? 'em rota' : 'separada'}: contada como entregue.`,
    }));

  // Um pedido com duas saídas do mesmo caixa não conta o Pix antecipado duas vezes.
  const naPorta = new Map<string, PagamentoAcerto>();
  for (const saida of entregues) {
    for (const p of pagamentosDaSaida(saida, entrada.pagamentos)) naPorta.set(p.id, p);
  }
  const pagamentos = [...naPorta.values()];
  const daForma = (forma: Forma) => pagamentos.filter((p) => p.forma === forma);

  const dinheiro = soma(daForma('dinheiro'), (p) => p.valor);
  // PAG4: o troco por Pix fica com o motoboy e entra no dinheiro a devolver.
  const troco = soma(daForma('dinheiro'), (p) => p.trocoPix);
  const cartao = soma(daForma('cartao'), (p) => p.valor);
  const pixMaquina = soma(daForma('pix_maquininha'), (p) => p.valor);
  // PAG5: não passa pela mão do motoboy.
  const pixAntecipado = soma(daForma('pix_antecipado'), (p) => p.valor);
  // ENT3 e ENT4: ele recebe a taxa de cada saída, inclusive das que voltaram.
  const taxas = saidas.reduce((total, s) => total + s.taxa, 0);

  // ACE3: devolve tudo e recebe diária e taxas à parte.
  const devolver = caixaInicial + dinheiro + troco;
  const maquininha = cartao + pixMaquina;
  const receber = diaria + taxas;

  const porArea: Record<string, TotalArea> = {};
  for (const s of saidas) {
    const area = porArea[s.area] ?? { entregues: 0, voltaram: 0, taxas: 0 };
    if (s.estado === 'voltou') area.voltaram += 1;
    else area.entregues += 1;
    area.taxas += s.taxa;
    porArea[s.area] = area;
  }

  // ACE8: a comanda perdida não trava o acerto; só aparece na lista.
  const papelFaltando = saidas.filter((s) => !s.papelConferido).map((s) => ({ saidaId: s.id, codigo: codigo(s) }));

  // PAG7: cada transação da maquininha precisa casar com um pagamento de uma saída dele.
  const listaMaquininha = pagamentos
    .filter(
      (p): p is PagamentoAcerto & Pick<ItemMaquininha, 'forma'> => p.forma === 'cartao' || p.forma === 'pix_maquininha',
    )
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    .map((p) => ({
      pagamentoId: p.id,
      codigo: codigoDe.get(p.pedidoId) ?? '',
      forma: p.forma,
      valor: p.valor,
    }));

  const dinheiroContado = entrada.dinheiroContado ?? null;
  const liquidacao = dinheiroContado === null ? null : liquidar({ caixaInicial, devolver, receber, dinheiroContado });

  return {
    caixaInicial,
    diaria,
    dinheiro,
    troco,
    cartao,
    pixMaquina,
    pixAntecipado,
    taxas,
    devolver,
    maquininha,
    receber,
    entregues: entregues.length,
    voltaram: saidas.length - entregues.length,
    porArea,
    papelFaltando,
    listaMaquininha,
    avisos,
    liquidacao,
  };
}

/**
 * ACE4 a ACE6. Paga primeiro com o caixa inicial dele; o que passar sai do caixa da empresa.
 * A falta é descontada do que ele recebe e, se passar, ele completa do bolso.
 */
export function liquidar({
  caixaInicial,
  devolver,
  receber,
  dinheiroContado,
}: {
  caixaInicial: number;
  devolver: number;
  receber: number;
  dinheiroContado: number;
}): Liquidacao {
  const dif = dinheiroContado - devolver;
  const falta = Math.max(0, -dif);
  const sobra = Math.max(0, dif);
  const pagar = Math.max(0, receber - falta);
  const completa = Math.max(0, falta - receber);

  const doCaixaDele = Math.min(caixaInicial, pagar, dinheiroContado);
  const retiradoCaixaEmpresa = pagar - doCaixaDele;
  const vaiParaEmpresa = dinheiroContado - doCaixaDele + completa;

  return {
    dinheiroContado,
    dif,
    falta,
    sobra,
    pagar,
    completa,
    doCaixaDele,
    retiradoCaixaEmpresa,
    vaiParaEmpresa,
  };
}
