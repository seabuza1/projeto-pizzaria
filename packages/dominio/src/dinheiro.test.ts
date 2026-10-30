import { describe, expect, it } from 'vitest';
import { formatarReais, formatarValor } from './dinheiro';

describe('dinheiro', () => {
  it('formata centavos como R$ 1.234,56', () => {
    expect(formatarReais(0)).toBe('R$ 0,00');
    expect(formatarReais(5)).toBe('R$ 0,05');
    expect(formatarReais(11300)).toBe('R$ 113,00');
    expect(formatarReais(123456)).toBe('R$ 1.234,56');
    expect(formatarReais(100000000)).toBe('R$ 1.000.000,00');
    expect(formatarReais(-300)).toBe('-R$ 3,00');
  });

  it('formata o valor sem o símbolo, para o recibo', () => {
    expect(formatarValor(24300)).toBe('243,00');
    expect(formatarValor(-300)).toBe('-3,00');
  });
});
