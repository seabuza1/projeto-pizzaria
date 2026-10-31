import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type CardapioJson, cardapioEmCentavos, opcoesDeSabor } from './cardapio';
import { centavos as c } from './dinheiro';
import { type ItemPedido, precoDoPedido, validarPromocao } from './preco';

// O cardápio real (docs/dados/cardapio-mel.json). O schema Zod confere o formato em packages/db.
const json = JSON.parse(
  readFileSync(new URL('../../../docs/dados/cardapio-mel.json', import.meta.url), 'utf8'),
) as CardapioJson;
const cardapio = cardapioEmCentavos(json);

// Taxas da spec (F2, Casos de teste); no app vêm da tabela areas.
const TAXA = { aragarcas: c(500), pontal: c(1000), barra: c(1200), parque: c(1500), retirada: c(0) };
const refri2l: ItemPedido = { tipo: 'bebida', nome: 'Refrigerante 2L' };

function total(itens: ItemPedido[], taxa: (typeof TAXA)[keyof typeof TAXA], promo: number | null = null) {
  const r = precoDoPedido(cardapio, {
    itens,
    taxa,
    promocao: promo !== null,
    promoDesconto: promo === null ? null : c(promo * 100),
  });
  if (!r.ok) throw new Error(r.erro.mensagem);
  return r.valor.total / 100;
}

describe('preço do pedido (F2; PED2 a PED4)', () => {
  it('P1: G Calabresa + Refrigerante 2L, Aragarças = 93', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Calabresa'] }, refri2l], TAXA.aragarcas)).toBe(93);
  });

  it('P2: G ½ Filé Mignon ½ Calabresa + Refrigerante 2L, Aragarças = 113 (PED3, a 3557 real)', () => {
    expect(
      total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Filé Mignon', 'Calabresa'] }, refri2l], TAXA.aragarcas),
    ).toBe(113);
  });

  it('P3: promoção 10, G Portuguesa com promoção, Aragarças = 68 (PED4)', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Portuguesa'] }], TAXA.aragarcas, 10)).toBe(68);
  });

  it('P4: promoção 10, a 3557 com promoção: faixa cobrada premium, sem desconto = 113', () => {
    const itens: ItemPedido[] = [{ tipo: 'pizza', tamanho: 'G', sabores: ['Filé Mignon', 'Calabresa'] }, refri2l];
    expect(total(itens, TAXA.aragarcas, 10)).toBe(113);
    const r = precoDoPedido(cardapio, { itens, taxa: TAXA.aragarcas, promocao: true, promoDesconto: c(1000) });
    expect(r.ok && r.valor.linhas[0]).toMatchObject({ faixaCobrada: 'premium', unitario: 9300, desconto: 0 });
  });

  it('P5: M Quatro Queijos + borda Cheddar, Pontal = 94', () => {
    expect(
      total([{ tipo: 'pizza', tamanho: 'M', sabores: ['Quatro Queijos'], bordas: ['Cheddar'] }], TAXA.pontal),
    ).toBe(94);
  });

  it('P6: Combo 01, Aragarças = 154,99', () => {
    expect(total([{ tipo: 'combo', id: '01' }], TAXA.aragarcas)).toBe(154.99);
  });

  it('P7: G Calabresa + adicional Bacon, Barra = 95', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Calabresa'], adicionais: ['Bacon'] }], TAXA.barra)).toBe(
      95,
    );
  });

  it('P8: G Frango c/ Catupiry, retirada = 73 (sem taxa)', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Frango c/ Catupiry'] }], TAXA.retirada)).toBe(73);
  });

  it('P9: 2 Refrigerantes lata + P Marguerita, Parque de Exposições = 85', () => {
    expect(
      total(
        [
          { tipo: 'bebida', nome: 'Refrigerante lata', quantidade: 2 },
          { tipo: 'pizza', tamanho: 'P', sabores: ['Marguerita'] },
        ],
        TAXA.parque,
      ),
    ).toBe(85);
  });

  it('P10: promoção 10, G ½ Calabresa ½ Portuguesa (duas tradicionais), Aragarças = 68 (provisório: um desconto)', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Calabresa', 'Portuguesa'] }], TAXA.aragarcas, 10)).toBe(68);
  });

  it('P11: "frango" sem escolha do sabor: sem preço, e o domínio devolve as 4 opções', () => {
    const r = precoDoPedido(cardapio, {
      itens: [{ tipo: 'pizza', tamanho: 'G', sabores: ['frango'] }],
      taxa: TAXA.aragarcas,
      promocao: false,
      promoDesconto: null,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatchObject({
      codigo: 'sabor_ambiguo',
      opcoes: ['Frango c/ Catupiry', 'Franguinho', 'Estrogonofe de Frango', 'Frango com Pequi'],
    });
  });
});

describe('fotografia de cada item (pedido_itens)', () => {
  it('guarda nome, faixa cobrada, preço unitário, desconto e quantidade', () => {
    const r = precoDoPedido(cardapio, {
      itens: [
        { tipo: 'pizza', tamanho: 'G', sabores: ['Portuguesa'], quantidade: 2, bordas: ['Catupiry'] },
        { tipo: 'outro', nome: 'Kit adicional de molhos' },
      ],
      taxa: TAXA.aragarcas,
      promocao: true,
      promoDesconto: c(500),
    });
    expect(r.ok && r.valor).toMatchObject({
      linhas: [
        {
          nome: 'G Portuguesa',
          faixaCobrada: 'tradicional',
          unitario: 7300,
          desconto: 500,
          quantidade: 2,
          total: 13600,
        },
        { nome: 'Kit adicional de molhos', faixaCobrada: null, unitario: 400, desconto: 0, quantidade: 1, total: 400 },
      ],
      itens: 14000,
      taxa: 500,
      total: 14500,
    });
  });

  it('sem promoção definida na noite, não há desconto (a tela avisa)', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['Portuguesa'] }], TAXA.retirada)).toBe(73);
    const r = precoDoPedido(cardapio, {
      itens: [{ tipo: 'pizza', tamanho: 'G', sabores: ['Portuguesa'] }],
      taxa: TAXA.retirada,
      promocao: true,
      promoDesconto: null,
    });
    expect(r.ok && r.valor.total).toBe(7300);
  });
});

describe('busca no cardápio', () => {
  it('acha pelo nome ou pelo apelido, sem acento e sem diferença de maiúsculas', () => {
    expect(opcoesDeSabor(cardapio, 'filé')).toEqual(['Filé Mignon']);
    expect(opcoesDeSabor(cardapio, '4 queijos')).toEqual(['Quatro Queijos']);
    expect(opcoesDeSabor(cardapio, 'CALABRESA')).toContain('Calabresa');
    expect(opcoesDeSabor(cardapio, 'xyz')).toEqual([]);
  });

  it('o nome exato resolve mesmo quando outro sabor contém a palavra', () => {
    expect(total([{ tipo: 'pizza', tamanho: 'G', sabores: ['calabresa'] }], TAXA.retirada)).toBe(73);
  });
});

describe('o que o domínio recusa', () => {
  const recusa = (itens: ItemPedido[]) => {
    const r = precoDoPedido(cardapio, { itens, taxa: TAXA.retirada, promocao: false, promoDesconto: null });
    return r.ok ? null : r.erro.codigo;
  };
  it('item que não existe no cardápio, pizza sem sabor e quantidade inválida', () => {
    expect(recusa([{ tipo: 'pizza', tamanho: 'G', sabores: ['Abacaxi Radioativo'] }])).toBe('sabor_nao_encontrado');
    expect(recusa([{ tipo: 'pizza', tamanho: 'G', sabores: [] }])).toBe('sem_sabor');
    expect(recusa([{ tipo: 'pizza', tamanho: 'G', sabores: ['Calabresa'], bordas: ['Ouro'] }])).toBe(
      'borda_nao_encontrada',
    );
    expect(recusa([{ tipo: 'pizza', tamanho: 'G', sabores: ['Calabresa'], adicionais: ['Ouro'] }])).toBe(
      'adicional_nao_encontrado',
    );
    expect(recusa([{ tipo: 'bebida', nome: 'Champanhe' }])).toBe('item_nao_encontrado');
    expect(recusa([{ tipo: 'combo', id: '99' }])).toBe('item_nao_encontrado');
    expect(recusa([{ tipo: 'outro', nome: 'Talher de prata' }])).toBe('item_nao_encontrado');
    expect(recusa([{ tipo: 'bebida', nome: 'Refrigerante 2L', quantidade: 0 }])).toBe('quantidade_invalida');
    expect(recusa([])).toBe('sem_itens');
  });

  it('promoção da noite: de R$ 3 a R$ 23 (PED4)', () => {
    expect(validarPromocao(c(300)).ok).toBe(true);
    expect(validarPromocao(c(2300)).ok).toBe(true);
    expect(validarPromocao(c(250))).toMatchObject({ ok: false, erro: { codigo: 'promo_fora_da_faixa' } });
    expect(validarPromocao(c(2400)).ok).toBe(false);
  });
});
