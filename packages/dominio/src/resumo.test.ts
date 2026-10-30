import { describe, expect, it } from 'vitest';
import { liquidar } from './acerto';
import { agruparPorCidade, filtrarPeriodo, historicoCsv, resumirNoite, resumirPeriodo } from './resumo';

const contaA = {
  dinheiro: 16000,
  troco: 300,
  cartao: 9000,
  pixMaquina: 7200,
  pixAntecipado: 6000,
  diaria: 3000,
  taxas: 5600,
  entregues: 5,
  voltaram: 1,
  porArea: { barra: { entregues: 2, voltaram: 1, taxas: 3600 }, ara: { entregues: 2, voltaram: 0, taxas: 1000 } },
  liquidacao: liquidar({ caixaInicial: 8000, devolver: 24300, receber: 8600, dinheiroContado: 24000 }),
};
const contaB = {
  dinheiro: 4000,
  troco: 0,
  cartao: 0,
  pixMaquina: 0,
  pixAntecipado: 0,
  diaria: 3000,
  taxas: 500,
  entregues: 1,
  voltaram: 0,
  porArea: { ara: { entregues: 1, voltaram: 0, taxas: 500 } },
  liquidacao: liquidar({ caixaInicial: 8000, devolver: 12000, receber: 3500, dinheiroContado: 12500 }),
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
      porArea: {
        barra: { entregues: 2, voltaram: 1, taxas: 3600 },
        ara: { entregues: 4, voltaram: 0, taxas: 2000 },
      },
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
    expect(resumirPeriodo(noites.slice(0, 2))).toEqual({
      noites: 2,
      entregas: 6,
      porArea: {
        ara: { entregues: 3, voltaram: 0, taxas: 1500 },
        barra: { entregues: 2, voltaram: 1, taxas: 3600 },
      },
      diarias: 6000,
      taxas: 6100,
      recebido: 3500 + 8300,
      pendentes: 0,
    });
  });

  it('exporta em CSV com ponto e vírgula', () => {
    expect(historicoCsv(noites.slice(0, 2))).toBe(
      'data;entregas;voltaram;diaria;taxas;recebido\n14/10/2026;1;0;30,00;5,00;35,00\n16/10/2026;5;1;30,00;56,00;83,00\n',
    );
  });
});

describe('entregas por cidade', () => {
  it('junta as áreas da mesma cidade', () => {
    const cidade: Record<string, string> = { barra: 'Barra do Garças', parque: 'Barra do Garças', ara: 'Aragarças' };
    expect(
      agruparPorCidade(
        {
          barra: { entregues: 2, voltaram: 1, taxas: 3600 },
          parque: { entregues: 1, voltaram: 0, taxas: 1500 },
          ara: { entregues: 2, voltaram: 0, taxas: 1000 },
        },
        (a) => cidade[a] ?? a,
      ),
    ).toEqual({
      'Barra do Garças': { entregues: 3, voltaram: 1, taxas: 5100 },
      Aragarças: { entregues: 2, voltaram: 0, taxas: 1000 },
    });
  });
});
