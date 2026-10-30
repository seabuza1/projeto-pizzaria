import { describe, expect, it } from 'vitest';
import {
  centavos,
  comparar,
  ehCentavos,
  formatarCurto,
  formatarReais,
  formatarValor,
  menor,
  naoNegativo,
  somar,
  somarPor,
  subtrair,
  ZERO,
} from './dinheiro';

const c = centavos;

describe('Centavos', () => {
  it('só aceita inteiros', () => {
    expect(ehCentavos(4750)).toBe(true);
    expect(ehCentavos(47.5)).toBe(false);
    expect(ehCentavos('4750')).toBe(false);
    expect(() => centavos(10.5)).toThrow('Centavos inválidos: 10.5');
  });

  it('soma, subtrai, compara e limita', () => {
    expect(somar(c(8000), c(16000), c(300))).toBe(24300);
    expect(somar()).toBe(ZERO);
    expect(subtrair(c(24000), c(24300))).toBe(-300);
    expect(menor(c(8000), c(8600), c(24300))).toBe(8000);
    expect(naoNegativo(c(-300))).toBe(0);
    expect(naoNegativo(c(700))).toBe(700);
    expect([comparar(c(1), c(2)), comparar(c(2), c(2)), comparar(c(3), c(2))]).toEqual([-1, 0, 1]);
    expect(somarPor([{ v: c(100) }, { v: c(250) }], (x) => x.v)).toBe(350);
  });
});

describe('formatação', () => {
  it('formata centavos como R$ 1.234,56', () => {
    expect(formatarReais(c(0))).toBe('R$ 0,00');
    expect(formatarReais(c(5))).toBe('R$ 0,05');
    expect(formatarReais(c(11300))).toBe('R$ 113,00');
    expect(formatarReais(c(123456))).toBe('R$ 1.234,56');
    expect(formatarReais(c(100000000))).toBe('R$ 1.000.000,00');
    expect(formatarReais(c(-300))).toBe('-R$ 3,00');
  });

  it('formata o valor sem o símbolo, para o recibo', () => {
    expect(formatarValor(c(24300))).toBe('243,00');
    expect(formatarValor(c(-300))).toBe('-3,00');
  });

  it('formato curto, sem ",00"', () => {
    expect(formatarCurto(c(8000))).toBe('80');
    expect(formatarCurto(c(4750))).toBe('47,50');
  });
});
