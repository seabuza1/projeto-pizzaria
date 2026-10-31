import { describe, expect, it } from 'vitest';
import {
  type ContaAcerto,
  calcularAcerto,
  dicaDiferenca,
  type EntradaAcerto,
  type EstadoSaida,
  type PagamentoAcerto,
  type PedidoAcerto,
  type SaidaAcerto,
} from './acerto';
import { type Centavos, centavos } from './dinheiro';
import { type Forma, validarLancamento } from './pagamento';

// Casos de teste de docs/fases/F1-acerto.md. Valores da spec em reais; o domínio usa centavos.
const r = (reais: number) => centavos(Math.round(reais * 100));

// ENT1: taxa padrão por cidade, em centavos.
const TAXAS = { Barra: r(12), Aragarças: r(5), Pontal: r(10) };
type Area = keyof typeof TAXAS;

interface Linha {
  forma: Forma;
  valor: Centavos;
  trocoPix?: Centavos;
}
const din = (reais: number, trocoReais = 0): Linha => ({ forma: 'dinheiro', valor: r(reais), trocoPix: r(trocoReais) });
const cartao = (reais: number): Linha => ({ forma: 'cartao', valor: r(reais) });
const pixMaq = (reais: number): Linha => ({ forma: 'pix_maquininha', valor: r(reais) });
const pixAnt = (reais: number): Linha => ({ forma: 'pix_antecipado', valor: r(reais) });

// Monta o caixa de um motoboy como o app faria ao lançar: pedido, saída e pagamentos previstos.
function novoCaixa() {
  const areas: Record<Area, Centavos> = { ...TAXAS };
  const pedidos: PedidoAcerto[] = [];
  const saidas: SaidaAcerto[] = [];
  const pagamentos: PagamentoAcerto[] = [];
  let seq = 0;
  const proximoId = (prefixo: string) => `${prefixo}-${++seq}`;
  const agora = () => new Date(Date.UTC(2026, 9, 17, 1, 0, seq)).toISOString();

  function lancar(codigo: string, totalReais: number, area: Area, linhas: Linha[], estado: EstadoSaida = 'entregue') {
    const v = validarLancamento({ codigo, total: r(totalReais), pagamentos: linhas });
    if (!v.ok) throw new Error(`Fixture inválida: ${v.erro.mensagem}`);
    const pedido: PedidoAcerto = { id: proximoId('pedido'), codigo };
    const saida: SaidaAcerto = {
      id: proximoId('saida'),
      pedidoId: pedido.id,
      area,
      taxa: areas[area],
      estado,
      papelConferido: false,
    };
    pedidos.push(pedido);
    saidas.push(saida);
    for (const linha of linhas) {
      pagamentos.push({
        id: proximoId('pagamento'),
        pedidoId: pedido.id,
        // Pix antecipado fica só no pedido; os da porta ficam ligados à saída.
        saidaId: linha.forma === 'pix_antecipado' ? null : saida.id,
        forma: linha.forma,
        valor: linha.valor,
        trocoPix: linha.trocoPix ?? r(0),
        real: false,
        criadoEm: agora(),
      });
    }
    return saida;
  }

  // "Saiu de novo": outra saída do mesmo pedido, com a taxa da tabela de agora;
  // os pagamentos da porta passam para a nova saída.
  function sairDeNovo(codigo: string, area: Area, estado: EstadoSaida = 'entregue') {
    const pedido = pedidos.find((p) => p.codigo === codigo);
    const anterior = saidas.find((s) => s.pedidoId === pedido?.id && s.estado === 'voltou');
    if (!pedido || !anterior) throw new Error(`Fixture inválida: ${codigo} não voltou`);
    const saida: SaidaAcerto = {
      id: proximoId('saida'),
      pedidoId: pedido.id,
      area,
      taxa: areas[area],
      estado,
      papelConferido: false,
    };
    saidas.push(saida);
    for (const [i, p] of pagamentos.entries()) {
      if (p.saidaId === anterior.id) pagamentos[i] = { ...p, saidaId: saida.id };
    }
    return saida;
  }

  // "Trocou a forma" na porta: os pagamentos reais substituem os previstos do pedido.
  function trocarForma(codigo: string, linhas: Linha[]) {
    const pedido = pedidos.find((p) => p.codigo === codigo);
    const saida = saidas.findLast((s) => s.pedidoId === pedido?.id);
    if (!pedido || !saida) throw new Error(`Fixture inválida: ${codigo} não existe`);
    // OPE3: a troca anterior fica registrada como anulada.
    for (const [i, p] of pagamentos.entries()) {
      if (p.pedidoId === pedido.id && p.real) pagamentos[i] = { ...p, anulado: true };
    }
    for (const linha of linhas) {
      pagamentos.push({
        id: proximoId('pagamento'),
        pedidoId: pedido.id,
        saidaId: linha.forma === 'pix_antecipado' ? null : saida.id,
        forma: linha.forma,
        valor: linha.valor,
        trocoPix: linha.trocoPix ?? r(0),
        real: true,
        criadoEm: agora(),
      });
    }
  }

  // "Desfazer" o lançamento: a saída fica cancelada e os pagamentos anulados, nada é apagado.
  function desfazerLancamento(codigo: string) {
    const pedido = pedidos.find((p) => p.codigo === codigo);
    for (const [i, s] of saidas.entries()) if (s.pedidoId === pedido?.id) saidas[i] = { ...s, cancelada: true };
    for (const [i, p] of pagamentos.entries()) if (p.pedidoId === pedido?.id) pagamentos[i] = { ...p, anulado: true };
  }

  function conferirPapeis(exceto: string[] = []) {
    for (const [i, s] of saidas.entries()) {
      const codigo = pedidos.find((p) => p.id === s.pedidoId)?.codigo ?? '';
      saidas[i] = { ...s, papelConferido: !exceto.includes(codigo) };
    }
  }

  function entrada(extra: Partial<EntradaAcerto> = {}): EntradaAcerto {
    return { caixaInicial: r(80), diaria: r(30), pedidos, saidas, pagamentos, ...extra };
  }

  return { areas, lancar, sairDeNovo, trocarForma, desfazerLancamento, conferirPapeis, entrada };
}

function noiteBase() {
  const caixa = novoCaixa();
  caixa.lancar('3557', 113, 'Barra', [din(113)]);
  caixa.lancar('0017', 60, 'Aragarças', [pixAnt(60)]);
  caixa.lancar('2672', 90, 'Pontal', [cartao(90)]);
  caixa.lancar('0910', 72, 'Barra', [pixMaq(72)]);
  caixa.lancar('3595', 47, 'Aragarças', [din(47, 3)]);
  caixa.lancar('8094', 65, 'Barra', [din(65)], 'voltou');
  return caixa;
}

function contarBase(dinheiroContado?: number): ContaAcerto {
  const extra = dinheiroContado === undefined ? {} : { dinheiroContado: r(dinheiroContado) };
  return calcularAcerto(noiteBase().entrada(extra));
}

describe('acerto do motoboy (F1)', () => {
  it('T1 base: devolver 243, maquininha 162, receber 86, pixAntecipado 60', () => {
    const conta = contarBase();
    expect(conta).toMatchObject({
      dinheiro: r(160),
      troco: r(3),
      cartao: r(90),
      pixMaquina: r(72),
      pixAntecipado: r(60),
      taxas: r(56),
      devolver: r(243),
      maquininha: r(162),
      receber: r(86),
      entregues: 5,
      voltaram: 1,
      liquidacao: null,
    });
  });

  it('T2 contado 240: falta 3, pagar 83', () => {
    expect(contarBase(240).liquidacao).toMatchObject({ dif: r(-3), falta: r(3), sobra: 0, pagar: r(83), completa: 0 });
  });

  it('T3 contado 243: bate, pagar 86', () => {
    expect(contarBase(243).liquidacao).toMatchObject({ dif: 0, falta: 0, sobra: 0, pagar: r(86), completa: 0 });
  });

  it('T4 contado 250: sobra 7, pagar 86', () => {
    expect(contarBase(250).liquidacao).toMatchObject({ dif: r(7), falta: 0, sobra: r(7), pagar: r(86), completa: 0 });
  });

  it('T5 contado 140: falta 103, pagar 0, completa 17', () => {
    expect(contarBase(140).liquidacao).toMatchObject({ falta: r(103), sobra: 0, pagar: 0, completa: r(17) });
  });

  it('T6 pedido 1234 com 20 de Pix antecipado e 30 em dinheiro', () => {
    const caixa = noiteBase();
    caixa.lancar('1234', 50, 'Pontal', [pixAnt(20), din(30)]);
    expect(calcularAcerto(caixa.entrada())).toMatchObject({
      devolver: r(273),
      maquininha: r(162),
      receber: r(96),
      pixAntecipado: r(80),
    });
  });

  it('T7 o 8094 sai de novo com ele e é entregue em dinheiro', () => {
    const caixa = noiteBase();
    caixa.sairDeNovo('8094', 'Barra');
    expect(calcularAcerto(caixa.entrada())).toMatchObject({
      devolver: r(308),
      receber: r(98),
      entregues: 6,
      voltaram: 1,
    });
  });

  it('T8 a taxa de Barra muda para 13 depois: receber continua 86 (ENT2)', () => {
    const caixa = noiteBase();
    caixa.areas.Barra = r(13);
    expect(calcularAcerto(caixa.entrada())).toMatchObject({ taxas: r(56), receber: r(86) });
  });

  it('T10 caixa 75, treze saídas no cartão, contado 75', () => {
    const caixa = novoCaixa();
    for (let i = 0; i < 10; i++) caixa.lancar(`10${String(i).padStart(2, '0')}`, 50, 'Barra', [cartao(50)]);
    for (let i = 0; i < 2; i++) caixa.lancar(`20${String(i).padStart(2, '0')}`, 40, 'Aragarças', [cartao(40)]);
    caixa.lancar('3000', 30, 'Pontal', [cartao(30)]);
    const conta = calcularAcerto(caixa.entrada({ caixaInicial: r(75), dinheiroContado: r(75) }));
    expect(conta).toMatchObject({ devolver: r(75), maquininha: r(610), receber: r(170) });
    expect(conta.liquidacao).toMatchObject({
      pagar: r(170),
      doCaixaDele: r(75),
      retiradoCaixaEmpresa: r(95),
      vaiParaEmpresa: 0,
    });
  });

  it('T11 contado 243: 80 do caixa dele, 6 do caixa da empresa, 163 para a empresa', () => {
    expect(contarBase(243).liquidacao).toMatchObject({
      pagar: r(86),
      doCaixaDele: r(80),
      retiradoCaixaEmpresa: r(6),
      vaiParaEmpresa: r(163),
    });
  });

  it('T12 contado 240: falta 3, 80 do caixa dele, 3 do caixa da empresa, 160 para a empresa', () => {
    expect(contarBase(240).liquidacao).toMatchObject({
      falta: r(3),
      pagar: r(83),
      doCaixaDele: r(80),
      retiradoCaixaEmpresa: r(3),
      vaiParaEmpresa: r(160),
    });
  });

  it('T13 contado 140: falta 103, nada a pagar, completa 17, 157 para a empresa', () => {
    expect(contarBase(140).liquidacao).toMatchObject({
      falta: r(103),
      pagar: 0,
      completa: r(17),
      doCaixaDele: 0,
      retiradoCaixaEmpresa: 0,
      vaiParaEmpresa: r(157),
    });
  });

  it('T14 contado 250: sobra 7, 80 do caixa dele, 6 do caixa da empresa, 170 para a empresa', () => {
    expect(contarBase(250).liquidacao).toMatchObject({
      sobra: r(7),
      pagar: r(86),
      doCaixaDele: r(80),
      retiradoCaixaEmpresa: r(6),
      vaiParaEmpresa: r(170),
    });
  });

  it('T15 uma saída em Aragarças de 40 em dinheiro, contado 120', () => {
    const caixa = novoCaixa();
    caixa.lancar('1111', 40, 'Aragarças', [din(40)]);
    const conta = calcularAcerto(caixa.entrada({ dinheiroContado: r(120) }));
    expect(conta.receber).toBe(r(35));
    expect(conta.liquidacao).toMatchObject({
      pagar: r(35),
      doCaixaDele: r(35),
      retiradoCaixaEmpresa: 0,
      vaiParaEmpresa: r(85),
    });
  });

  it('T16 entregas por área', () => {
    expect(contarBase().porArea).toEqual({
      Barra: { entregues: 2, voltaram: 1, taxas: r(36) },
      Aragarças: { entregues: 2, voltaram: 0, taxas: r(10) },
      Pontal: { entregues: 1, voltaram: 0, taxas: r(10) },
    });
  });

  it('T17 papel conferido em todas menos a 2672', () => {
    const caixa = noiteBase();
    caixa.conferirPapeis(['2672']);
    const conta = calcularAcerto(caixa.entrada());
    expect(conta.papelFaltando.map((p) => p.codigo)).toEqual(['2672']);
  });

  it('T18 saída sem "Voltou" no fechamento conta como entregue, sem aviso', () => {
    const caixa = noiteBase();
    caixa.lancar('5555', 40, 'Aragarças', [din(40)], 'em_rota');
    const conta = calcularAcerto(caixa.entrada());
    expect(conta).toMatchObject({ devolver: r(283), receber: r(91), entregues: 6, voltaram: 1 });
    expect(conta).not.toHaveProperty('avisos');
  });

  it('T20 dica de diferença: aponta a comanda provável, e a troca de forma resolve', () => {
    // O cliente da 2672 pagou os 90 em dinheiro e ninguém trocou a forma.
    const caixa = noiteBase();
    const antes = calcularAcerto(caixa.entrada({ dinheiroContado: r(333) }));
    expect(antes.liquidacao).toMatchObject({ dif: r(90), sobra: r(90) });
    expect(dicaDiferenca(antes)).toEqual([
      {
        pagamentoId: expect.any(String),
        saidaId: expect.any(String),
        codigo: '2672',
        forma: 'cartao',
        valor: r(90),
        pergunta: 'pagou em dinheiro?',
      },
    ]);
    // A dica não troca nada sozinha: depois de "Trocou a forma" para dinheiro, a conta bate.
    caixa.trocarForma('2672', [din(90)]);
    const depois = calcularAcerto(caixa.entrada({ dinheiroContado: r(333) }));
    expect(depois).toMatchObject({ devolver: r(333), maquininha: r(72) });
    expect(depois.liquidacao).toMatchObject({ dif: 0, sobra: 0 });
    expect(dicaDiferenca(depois)).toEqual([]);
  });

  it('dica de diferença quando falta: pagamentos em dinheiro com o valor da falta', () => {
    // Contou 113 a menos: talvez a 3557 tenha pago no cartão.
    const conta = calcularAcerto(noiteBase().entrada({ dinheiroContado: r(130) }));
    expect(dicaDiferenca(conta).map((d) => [d.codigo, d.pergunta])).toEqual([
      ['3557', 'pagou no cartão ou Pix na máquina?'],
    ]);
    expect(dicaDiferenca(calcularAcerto(noiteBase().entrada()))).toEqual([]);
  });
});

describe('acerto do motoboy: detalhes', () => {
  it('lista da maquininha com código, forma e valor, na ordem da hora', () => {
    expect(contarBase().listaMaquininha).toEqual([
      { pagamentoId: expect.any(String), codigo: '2672', forma: 'cartao', valor: r(90) },
      { pagamentoId: expect.any(String), codigo: '0910', forma: 'pix_maquininha', valor: r(72) },
    ]);
  });

  it('sem conferência, papelFaltando traz todas as saídas, inclusive a que voltou', () => {
    expect(contarBase().papelFaltando.map((p) => p.codigo)).toEqual(['3557', '0017', '2672', '0910', '3595', '8094']);
  });

  it('a forma real substitui a prevista (PAG3)', () => {
    const caixa = noiteBase();
    caixa.trocarForma('2672', [din(50), pixMaq(40)]);
    expect(calcularAcerto(caixa.entrada())).toMatchObject({
      dinheiro: r(210),
      cartao: 0,
      pixMaquina: r(112),
      devolver: r(293),
      maquininha: r(112),
    });
  });

  it('OPE3 lançamento desfeito fica registrado, mas não conta', () => {
    const caixa = noiteBase();
    caixa.lancar('7777', 40, 'Aragarças', [din(40)]);
    caixa.desfazerLancamento('7777');
    const conta = calcularAcerto(caixa.entrada());
    expect(conta).toMatchObject({ devolver: r(243), receber: r(86), entregues: 5 });
    expect(conta.papelFaltando.map((p) => p.codigo)).not.toContain('7777');
  });

  it('OPE3 trocar a forma duas vezes: só a última troca vale', () => {
    const caixa = noiteBase();
    caixa.trocarForma('2672', [din(90)]);
    caixa.trocarForma('2672', [pixMaq(90)]);
    expect(calcularAcerto(caixa.entrada())).toMatchObject({ dinheiro: r(160), cartao: 0, pixMaquina: r(162) });
  });

  it('confere: sem falta, vaiParaEmpresa − retiradoCaixaEmpresa = devolver − receber + sobra', () => {
    for (const contado of [243, 250, 300]) {
      const conta = contarBase(contado);
      const l = conta.liquidacao;
      expect(l?.falta).toBe(0);
      expect((l?.vaiParaEmpresa ?? 0) - (l?.retiradoCaixaEmpresa ?? 0)).toBe(
        conta.devolver - conta.receber + (l?.sobra ?? 0),
      );
    }
  });
});
