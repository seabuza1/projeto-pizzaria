import { describe, expect, it } from 'vitest';
import { centavos } from './dinheiro';
import { completarResto, lerValor } from './entrada';

const c = centavos;

describe('valor digitado', () => {
  it('"113" vale R$ 113,00', () => {
    expect(lerValor('113')).toEqual({ ok: true, valor: 11300 });
    expect(lerValor(' 80 ')).toEqual({ ok: true, valor: 8000 });
  });

  it('aceita centavos com vírgula e milhar com ponto', () => {
    expect(lerValor('47,50')).toEqual({ ok: true, valor: 4750 });
    expect(lerValor('47,5')).toEqual({ ok: true, valor: 4750 });
    expect(lerValor('1.234,56')).toEqual({ ok: true, valor: 123456 });
    expect(lerValor('0,05')).toEqual({ ok: true, valor: 5 });
  });

  it('recusa o que não é valor', () => {
    for (const t of ['', 'abc', '1,234', '12,3,4', '-5', '1.23']) {
      expect(lerValor(t), t).toEqual({
        ok: false,
        erro: { codigo: 'valor_invalido', mensagem: 'Digite o valor, por exemplo 113 ou 47,50.' },
      });
    }
  });
});

describe('pagamento dividido: a linha vazia fica com o resto', () => {
  it('preenche a única linha vazia', () => {
    expect(
      completarResto(c(5000), [
        { forma: 'pix_antecipado', valor: c(2000) },
        { forma: 'dinheiro', valor: null },
      ]),
    ).toEqual({
      ok: true,
      valor: [
        { forma: 'pix_antecipado', valor: 2000 },
        { forma: 'dinheiro', valor: 3000 },
      ],
    });
  });

  it('sem linha vazia, só confere', () => {
    expect(completarResto(c(5000), [{ forma: 'cartao', valor: c(5000) }])).toMatchObject({ ok: true });
  });

  it('mais de uma linha vazia ou resto não positivo é erro', () => {
    expect(
      completarResto(c(5000), [
        { forma: 'cartao', valor: null },
        { forma: 'dinheiro', valor: null },
      ]),
    ).toEqual({ ok: false, erro: { codigo: 'linhas_vazias', mensagem: 'Deixe só uma linha sem valor.' } });
    expect(
      completarResto(c(5000), [
        { forma: 'cartao', valor: c(5000) },
        { forma: 'dinheiro', valor: null },
      ]),
    ).toEqual({ ok: false, erro: { codigo: 'sem_resto', mensagem: 'Não sobra nada para a linha vazia.' } });
  });
});
