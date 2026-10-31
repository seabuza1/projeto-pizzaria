import { cardapioEmCentavos } from '@mel/dominio';
import { describe, expect, it } from 'vitest';
import cardapioMel from '../../../docs/dados/cardapio-mel.json';
import { CardapioSchema } from './cardapio';

const lido = cardapioMel;

describe('cardápio real (docs/dados/cardapio-mel.json)', () => {
  it('passa no CardapioSchema', () => {
    const r = CardapioSchema.safeParse(lido);
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  it('vira centavos sem perder nada', () => {
    const cardapio = cardapioEmCentavos(CardapioSchema.parse(lido));
    expect(cardapio.faixas.premium.G).toBe(9300);
    expect(cardapio.combos.find((c) => c.id === '01')?.preco).toBe(14999);
    expect(cardapio.outros.find((o) => o.nome === 'Cuba de creme de avelã')?.preco).toBe(999);
  });

  it('recusa preço com três decimais, faixa desconhecida e sabor repetido', () => {
    // biome-ignore lint/suspicious/noExplicitAny: cópia crua para estragar de propósito
    const copia = (): any => JSON.parse(JSON.stringify(lido));
    const tresDecimais = copia();
    tresDecimais.bordas[0].preco = 1.005;
    expect(CardapioSchema.safeParse(tresDecimais).success).toBe(false);
    const faixa = copia();
    faixa.pizzas.sabores[0].faixa = 'gourmet';
    expect(CardapioSchema.safeParse(faixa).success).toBe(false);
    const repetido = copia();
    repetido.pizzas.sabores.push({ ...repetido.pizzas.sabores[0] });
    expect(CardapioSchema.safeParse(repetido).success).toBe(false);
  });
});
