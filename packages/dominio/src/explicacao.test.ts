import { describe, expect, it } from 'vitest';
import type { Centavos } from './dinheiro';
import { explicarConta, textoDaLiquidacao, textoDasPartes } from './explicacao';

// Os valores dos casos já são centavos inteiros.
const cs = <T extends Record<string, number>>(o: T) => o as unknown as { [K in keyof T]: Centavos };

const conta = cs({
  caixaInicial: 8000,
  diaria: 3000,
  dinheiro: 16000,
  troco: 300,
  cartao: 9000,
  pixMaquina: 7200,
  pixAntecipado: 6000,
  taxas: 5600,
  devolver: 24300,
  maquininha: 16200,
  receber: 8600,
});

describe('de onde vem cada número (ACE10)', () => {
  it('monta as partes do devolver, do receber e da maquininha', () => {
    const e = explicarConta(conta);
    expect(textoDasPartes(e.devolver)).toBe('80 de caixa + 160 em dinheiro + 3 de troco por Pix');
    expect(textoDasPartes(e.receber)).toBe('30 de diária + 56 de taxas');
    expect(textoDasPartes(e.maquininha)).toBe('90 em cartão + 72 em Pix na maquininha');
    expect(e.devolver.total).toBe(24300);
  });

  it('esconde as partes zeradas, menos o caixa e a diária', () => {
    const e = explicarConta({ ...conta, ...cs({ dinheiro: 0, troco: 0, taxas: 0, cartao: 4750, pixMaquina: 0 }) });
    expect(textoDasPartes(e.devolver)).toBe('80 de caixa');
    expect(textoDasPartes(e.receber)).toBe('30 de diária');
    expect(textoDasPartes(e.maquininha)).toBe('47,50 em cartão');
  });
});

describe('liquidação em uma frase (painel do Luan)', () => {
  const base = cs({ dinheiroContado: 7500, dif: 0, falta: 0, sobra: 0, completa: 0 });

  it('do caixa dele e do caixa da empresa (T10)', () => {
    expect(
      textoDaLiquidacao({
        ...base,
        ...cs({ pagar: 17000, doCaixaDele: 7500, retiradoCaixaEmpresa: 9500, vaiParaEmpresa: 0 }),
      }),
    ).toBe('Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa.');
  });

  it('só do caixa dele (T15)', () => {
    expect(
      textoDaLiquidacao({
        ...base,
        ...cs({ pagar: 3500, doCaixaDele: 3500, retiradoCaixaEmpresa: 0, vaiParaEmpresa: 8500 }),
      }),
    ).toBe('Pague R$ 35,00 do caixa dele.');
  });

  it('falta maior que o que ele recebe (T13)', () => {
    expect(
      textoDaLiquidacao({
        ...base,
        ...cs({
          falta: 10300,
          pagar: 0,
          completa: 1700,
          doCaixaDele: 0,
          retiradoCaixaEmpresa: 0,
          vaiParaEmpresa: 15700,
        }),
      }),
    ).toBe('Nada a pagar. Ele completa R$ 17,00 do bolso.');
  });

  it('sem dinheiro na mão, tudo sai do caixa da empresa', () => {
    expect(
      textoDaLiquidacao({
        ...base,
        ...cs({ dinheiroContado: 0, pagar: 3000, doCaixaDele: 0, retiradoCaixaEmpresa: 3000, vaiParaEmpresa: 0 }),
      }),
    ).toBe('Retire R$ 30,00 do caixa da empresa para pagar.');
  });
});
