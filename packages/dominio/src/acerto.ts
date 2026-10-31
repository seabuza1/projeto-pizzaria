// Conta do acerto de um caixa (um motoboy numa noite). Spec: docs/fases/F1-acerto.md.
// Funções puras, tudo em centavos. Espelhada em SQL por interno.conta_caixa.
import { type Centavos, menor, naoNegativo, somar, somarPor, subtrair } from './dinheiro';
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
  taxa: Centavos;
  estado: EstadoSaida;
  papelConferido: boolean;
  /** OPE3: lançamento desfeito. A saída fica registrada, mas não conta. */
  cancelada?: boolean;
}

export interface PagamentoAcerto {
  id: string;
  pedidoId: string;
  /** Saída que recebeu na porta. Pix antecipado fica só no pedido (null). */
  saidaId: string | null;
  forma: Forma;
  valor: Centavos;
  trocoPix: Centavos;
  /** PAG3: false = forma prevista na comanda; true = forma confirmada na porta. */
  real: boolean;
  /** OPE3: substituído ou desfeito. Fica registrado, mas não conta. */
  anulado?: boolean;
  /** ISO 8601 (hora do servidor), para a ordem da lista da maquininha. */
  criadoEm: string;
}

export interface EntradaAcerto {
  caixaInicial: Centavos;
  diaria: Centavos;
  /** Pedidos das saídas do caixa. */
  pedidos: readonly PedidoAcerto[];
  /** Todas as saídas do motoboy na noite. */
  saidas: readonly SaidaAcerto[];
  /** Pagamentos desses pedidos. */
  pagamentos: readonly PagamentoAcerto[];
  dinheiroContado?: Centavos | null;
}

export interface Liquidacao {
  dinheiroContado: Centavos;
  dif: Centavos;
  falta: Centavos;
  sobra: Centavos;
  pagar: Centavos;
  completa: Centavos;
  doCaixaDele: Centavos;
  retiradoCaixaEmpresa: Centavos;
  vaiParaEmpresa: Centavos;
}

export interface TotalArea {
  entregues: number;
  voltaram: number;
  taxas: Centavos;
}

export interface SaidaSemPapel {
  saidaId: string;
  codigo: string;
}

export interface ItemMaquininha {
  pagamentoId: string;
  codigo: string;
  forma: 'cartao' | 'pix_maquininha';
  valor: Centavos;
}

/** Pagamento que vale na conta, com a comanda e a saída a que pertence. */
export interface PagamentoNaPorta {
  pagamentoId: string;
  saidaId: string;
  codigo: string;
  forma: Forma;
  valor: Centavos;
}

export interface Dica extends PagamentoNaPorta {
  pergunta: 'pagou em dinheiro?' | 'pagou no cartão ou Pix na máquina?';
}

export interface ContaAcerto {
  caixaInicial: Centavos;
  diaria: Centavos;
  dinheiro: Centavos;
  troco: Centavos;
  cartao: Centavos;
  pixMaquina: Centavos;
  pixAntecipado: Centavos;
  taxas: Centavos;
  devolver: Centavos;
  maquininha: Centavos;
  receber: Centavos;
  entregues: number;
  voltaram: number;
  porArea: Record<string, TotalArea>;
  papelFaltando: SaidaSemPapel[];
  listaMaquininha: ItemMaquininha[];
  /** Pagamentos que valem, na ordem da hora (base da dica de diferença). */
  naPorta: PagamentoNaPorta[];
  /** null enquanto o dinheiro não foi contado. */
  liquidacao: Liquidacao | null;
}

/**
 * PAG3: os pagamentos que valem para uma saída entregue. São os do pedido ligados a ela
 * ou só ao pedido (Pix antecipado); os reais, se houver, senão os previstos.
 */
export function pagamentosDaSaida(saida: SaidaAcerto, pagamentos: readonly PagamentoAcerto[]): PagamentoAcerto[] {
  const doPedido = pagamentos.filter(
    (p) => !p.anulado && p.pedidoId === saida.pedidoId && (p.saidaId === saida.id || p.saidaId === null),
  );
  const reais = doPedido.filter((p) => p.real);
  return reais.length > 0 ? reais : doPedido.filter((p) => !p.real);
}

export function calcularAcerto(entrada: EntradaAcerto): ContaAcerto {
  const { caixaInicial, diaria } = entrada;
  const saidas = entrada.saidas.filter((s) => !s.cancelada);
  const codigoDe = new Map(entrada.pedidos.map((p) => [p.id, p.codigo]));
  const codigo = (saida: SaidaAcerto) => codigoDe.get(saida.pedidoId) ?? '';

  // ENT5: a saída que voltou conta a taxa, mas não os valores do pedido.
  // T18: sem "Voltou", a saída conta como entregue (o motoboy não marca "Entregue"; decisão 0007).
  const entregues = saidas.filter((s) => s.estado !== 'voltou');

  // Um pedido com duas saídas do mesmo caixa não conta o Pix antecipado duas vezes.
  const vigentes = new Map<string, { p: PagamentoAcerto; saida: SaidaAcerto }>();
  for (const saida of entregues) {
    for (const p of pagamentosDaSaida(saida, entrada.pagamentos)) vigentes.set(p.id, { p, saida });
  }
  const pagamentos = [...vigentes.values()].map((v) => v.p);
  const daForma = (forma: Forma) => pagamentos.filter((p) => p.forma === forma);

  const dinheiro = somarPor(daForma('dinheiro'), (p) => p.valor);
  // PAG4: o troco por Pix fica com o motoboy e entra no dinheiro a devolver.
  const troco = somarPor(daForma('dinheiro'), (p) => p.trocoPix);
  const cartao = somarPor(daForma('cartao'), (p) => p.valor);
  const pixMaquina = somarPor(daForma('pix_maquininha'), (p) => p.valor);
  // PAG5: não passa pela mão do motoboy.
  const pixAntecipado = somarPor(daForma('pix_antecipado'), (p) => p.valor);
  // ENT3 e ENT4: ele recebe a taxa de cada saída, inclusive das que voltaram.
  const taxas = somarPor(saidas, (s) => s.taxa);

  // ACE3: devolve tudo e recebe diária e taxas à parte.
  const devolver = somar(caixaInicial, dinheiro, troco);
  const maquininha = somar(cartao, pixMaquina);
  const receber = somar(diaria, taxas);

  const porArea: Record<string, TotalArea> = {};
  for (const s of saidas) {
    const area = porArea[s.area] ?? { entregues: 0, voltaram: 0, taxas: somar() };
    if (s.estado === 'voltou') area.voltaram += 1;
    else area.entregues += 1;
    area.taxas = somar(area.taxas, s.taxa);
    porArea[s.area] = area;
  }

  // ACE8: a comanda perdida não trava o acerto; só aparece na lista.
  const papelFaltando = saidas.filter((s) => !s.papelConferido).map((s) => ({ saidaId: s.id, codigo: codigo(s) }));

  const naPorta: PagamentoNaPorta[] = [...vigentes.values()]
    .sort((a, b) => a.p.criadoEm.localeCompare(b.p.criadoEm))
    .map(({ p, saida }) => ({
      pagamentoId: p.id,
      saidaId: saida.id,
      codigo: codigo(saida),
      forma: p.forma,
      valor: p.valor,
    }));

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
    naPorta,
    liquidacao,
  };
}

/**
 * Dica de diferença (F1, T20): aponta as comandas que explicariam a diferença do dinheiro contado.
 * Sobra: cartão ou Pix na maquininha com o mesmo valor ("pagou em dinheiro?").
 * Falta: dinheiro com o mesmo valor ("pagou no cartão ou Pix na máquina?").
 * Só aponta; nunca troca nada sozinha.
 */
export function dicaDiferenca(conta: Pick<ContaAcerto, 'liquidacao' | 'naPorta'>): Dica[] {
  const dif = conta.liquidacao?.dif ?? 0;
  if (dif > 0) {
    return conta.naPorta
      .filter((p) => (p.forma === 'cartao' || p.forma === 'pix_maquininha') && p.valor === dif)
      .map((p) => ({ ...p, pergunta: 'pagou em dinheiro?' }));
  }
  if (dif < 0) {
    return conta.naPorta
      .filter((p) => p.forma === 'dinheiro' && p.valor === -dif)
      .map((p) => ({ ...p, pergunta: 'pagou no cartão ou Pix na máquina?' }));
  }
  return [];
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
  caixaInicial: Centavos;
  devolver: Centavos;
  receber: Centavos;
  dinheiroContado: Centavos;
}): Liquidacao {
  const dif = subtrair(dinheiroContado, devolver);
  const falta = naoNegativo(subtrair(devolver, dinheiroContado));
  const sobra = naoNegativo(dif);
  const pagar = naoNegativo(subtrair(receber, falta));
  const completa = naoNegativo(subtrair(falta, receber));

  const doCaixaDele = menor(caixaInicial, pagar, dinheiroContado);
  const retiradoCaixaEmpresa = subtrair(pagar, doCaixaDele);
  const vaiParaEmpresa = somar(subtrair(dinheiroContado, doCaixaDele), completa);

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
