import { describe, expect, it } from 'vitest';
import { liquidar } from './acerto';
import { centavos as c } from './dinheiro';
import { agruparPorCidade, filtrarPeriodo, historicoCsv, noiteCsv, resumirNoite, resumirPeriodo } from './resumo';

const area = (entregues: number, voltaram: number, taxas: number) => ({ entregues, voltaram, taxas: c(taxas) });

const contaA = {
  dinheiro: c(16000),
  troco: c(300),
  cartao: c(9000),
  pixMaquina: c(7200),
  pixAntecipado: c(6000),
  diaria: c(3000),
  taxas: c(5600),
  entregues: 5,
  voltaram: 1,
  porArea: { barra: area(2, 1, 3600), ara: area(2, 0, 1000) },
  liquidacao: liquidar({ caixaInicial: c(8000), devolver: c(24300), receber: c(8600), dinheiroContado: c(24000) }),
};
const contaB = {
  dinheiro: c(4000),
  troco: c(0),
  cartao: c(0),
  pixMaquina: c(0),
  pixAntecipado: c(0),
  diaria: c(3000),
  taxas: c(500),
  entregues: 1,
  voltaram: 0,
  porArea: { ara: area(1, 0, 500) },
  liquidacao: liquidar({ caixaInicial: c(8000), devolver: c(12000), receber: c(3500), dinheiroContado: c(12500) }),
};

describe('resumo da noite', () => {
  it('soma formas, liquidações, faltas, sobras e entregas por área', () => {
    expect(resumirNoite([contaA, contaB, { ...contaB, liquidacao: null }])).toEqual({
      porForma: { dinheiro: 24000, troco: 300, cartao: 9000, pixMaquina: 7200, pixAntecipado: 6000 },
      pagoMotoboys: 8300 + 3500,
      doCaixaDeles: 8000 + 3500,
      retiradoCaixaEmpresa: 300,
      vaiParaEmpresa: 16000 + 9000,
      faltas: 300,
      sobras: 500,
      completado: 0,
      entregas: 7,
      voltaram: 1,
      porArea: { barra: area(2, 1, 3600), ara: area(4, 0, 2000) },
      pendentes: 1,
    });
  });
});

describe('histórico do motoboy', () => {
  const noites = [
    { data: '2026-10-14', conta: contaB },
    { data: '2026-10-16', conta: contaA },
    { data: '2026-09-30', conta: contaB },
  ];

  it('filtra por semana (de segunda) e por mês', () => {
    // 2026-10-16 é sexta; a semana começa na segunda 12/10.
    expect(filtrarPeriodo(noites, 'semana', '2026-10-16').map((n) => n.data)).toEqual(['2026-10-14', '2026-10-16']);
    expect(filtrarPeriodo(noites, 'mes', '2026-10-16').length).toBe(2);
    expect(filtrarPeriodo(noites, 'mes', '2026-09-05').map((n) => n.data)).toEqual(['2026-09-30']);
  });

  it('resume noites, entregas, diárias, taxas e o total recebido', () => {
    expect(
      resumirPeriodo([...noites.slice(0, 2), { data: '2026-10-17', conta: { ...contaB, liquidacao: null } }]),
    ).toEqual({
      noites: 3,
      entregas: 7,
      porArea: { ara: area(4, 0, 2000), barra: area(2, 1, 3600) },
      diarias: 9000,
      taxas: 6600,
      recebido: 3500 + 8300,
      pendentes: 1,
    });
  });

  it('exporta em CSV com ponto e vírgula', () => {
    expect(historicoCsv([...noites.slice(0, 2), { data: '2026-10-17', conta: { ...contaB, liquidacao: null } }])).toBe(
      'data;entregas;voltaram;diaria;taxas;recebido\n' +
        '14/10/2026;1;0;30,00;5,00;35,00\n16/10/2026;5;1;30,00;56,00;83,00\n17/10/2026;1;0;30,00;5,00;\n',
    );
  });
});

describe('entregas por cidade', () => {
  it('junta as áreas da mesma cidade', () => {
    const cidade: Record<string, string> = { barra: 'Barra do Garças', parque: 'Barra do Garças', ara: 'Aragarças' };
    expect(
      agruparPorCidade(
        { barra: area(2, 1, 3600), parque: area(1, 0, 1500), ara: area(2, 0, 1000) },
        (a) => cidade[a] ?? a,
      ),
    ).toEqual({ 'Barra do Garças': area(3, 1, 5100), Aragarças: area(2, 0, 1000) });
  });
});

describe('exportar a noite (CSV)', () => {
  it('uma linha por motoboy, na ordem de chegada', () => {
    const conta = { ...contaA, caixaInicial: c(8000), devolver: c(24300), maquininha: c(16200), receber: c(8600) };
    expect(
      noiteCsv('2026-10-16', [
        { ordem: 2, motoboy: 'João; o novo', conta: { ...conta, liquidacao: null }, confirmado: false },
        { ordem: 1, motoboy: 'Felipe', conta, confirmado: true },
      ]),
    ).toBe(
      'noite;ordem;motoboy;caixa_inicial;entregas;voltaram;devolver;maquininha;receber;pix_antecipado;' +
        'contado;pagar;do_caixa_dele;retirado_caixa_empresa;vai_para_empresa;acerto\n' +
        '16/10/2026;1;Felipe;80,00;5;1;243,00;162,00;86,00;60,00;240,00;83,00;80,00;3,00;160,00;confirmado\n' +
        '16/10/2026;2;João, o novo;80,00;5;1;243,00;162,00;86,00;60,00;;;;;;pendente\n',
    );
  });
});
