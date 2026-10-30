import { describe, expect, it } from 'vitest';
import { completarResto, lerValor } from './entrada';

describe('valor digitado', () => {
  it('"113" vale R$ 113,00', () => {
    expect(lerValor('113')).toBe(11300);
    expect(lerValor(' 80 ')).toBe(8000);
  });

  it('aceita centavos com vírgula e milhar com ponto', () => {
    expect(lerValor('47,50')).toBe(4750);
    expect(lerValor('47,5')).toBe(4750);
    expect(lerValor('1.234,56')).toBe(123456);
    expect(lerValor('0,05')).toBe(5);
  });

  it('recusa o que não é valor', () => {
    for (const t of ['', 'abc', '1,234', '12,3,4', '-5', '1.23']) expect(lerValor(t), t).toBeNull();
  });
});

describe('pagamento dividido: a linha vazia fica com o resto', () => {
  it('preenche a única linha vazia', () => {
    expect(
      completarResto(5000, [
        { forma: 'pix_antecipado', valor: 2000 },
        { forma: 'dinheiro', valor: null },
      ]),
    ).toEqual({
      ok: true,
      linhas: [
        { forma: 'pix_antecipado', valor: 2000 },
        { forma: 'dinheiro', valor: 3000 },
      ],
    });
  });

  it('sem linha vazia, só confere', () => {
    expect(completarResto(5000, [{ forma: 'cartao', valor: 5000 }])).toMatchObject({ ok: true });
  });

  it('mais de uma linha vazia ou resto não positivo é erro', () => {
    expect(
      completarResto(5000, [
        { forma: 'cartao', valor: null },
        { forma: 'dinheiro', valor: null },
      ]),
    ).toEqual({ ok: false, erro: 'Deixe só uma linha sem valor.' });
    expect(
      completarResto(5000, [
        { forma: 'cartao', valor: 5000 },
        { forma: 'dinheiro', valor: null },
      ]),
    ).toEqual({ ok: false, erro: 'Não sobra nada para a linha vazia.' });
  });
});
