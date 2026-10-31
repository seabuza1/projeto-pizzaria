import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  avisoRetirada,
  codigoRepetido,
  descreverItem,
  linkWhatsApp,
  minutosParado,
  repetirPedido,
  resumoDoPedido,
  situacaoDaTrava,
  validarTroco,
} from './atendimento';
import { type CardapioJson, cardapioEmCentavos } from './cardapio';
import { centavos as c } from './dinheiro';
import type { ItemPedido } from './preco';

const cardapio = cardapioEmCentavos(
  JSON.parse(readFileSync(new URL('../../../docs/dados/cardapio-mel.json', import.meta.url), 'utf8')) as CardapioJson,
);
const agora = new Date('2026-10-16T23:00:00Z');
const minutosAntes = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString();

describe('trava de atendimento (F2, 2b)', () => {
  it('outro aparelho atendendo há 2 min: travado, com o tempo', () => {
    expect(situacaoDaTrava({ aparelho: 'web-b', desde: minutosAntes(2) }, 'web-a', agora)).toEqual({
      livre: false,
      minutos: 2,
    });
  });
  it('livre se for o mesmo aparelho, se ninguém atende ou depois de 10 min parado', () => {
    expect(situacaoDaTrava({ aparelho: 'web-a', desde: minutosAntes(2) }, 'web-a', agora).livre).toBe(true);
    expect(situacaoDaTrava({ aparelho: null, desde: null }, 'web-a', agora).livre).toBe(true);
    expect(situacaoDaTrava({ aparelho: 'web-b', desde: minutosAntes(10) }, 'web-a', agora).livre).toBe(true);
  });
  it('"aguardando cliente há 8 min"', () => {
    expect(minutosParado(minutosAntes(8.5), agora)).toBe(8);
    expect(minutosParado(new Date(agora.getTime() + 5000).toISOString(), agora)).toBe(0);
  });
});

describe('código repetido na noite (PED1)', () => {
  const pedidos = [
    { id: 'a', codigo: '3557', estado: 'em_producao' },
    { id: 'b', codigo: '0017', estado: 'cancelado' },
  ];
  it('avisa quando outro pedido da noite tem o mesmo código', () => {
    expect(codigoRepetido('3557', pedidos)).toBe(true);
    expect(codigoRepetido('8498', pedidos)).toBe(false);
  });
  it('não conta o próprio pedido nem os cancelados', () => {
    expect(codigoRepetido('3557', pedidos, 'a')).toBe(false);
    expect(codigoRepetido('0017', pedidos)).toBe(false);
  });
});

describe('troco ("troco para 100")', () => {
  it('só com parte em dinheiro e não menor que ela', () => {
    expect(validarTroco(c(10000), [{ forma: 'dinheiro', valor: c(9300) }])).toEqual({ ok: true, valor: 10000 });
    expect(validarTroco(null, [{ forma: 'cartao', valor: c(9300) }])).toEqual({ ok: true, valor: null });
    expect(validarTroco(c(10000), [{ forma: 'cartao', valor: c(9300) }])).toMatchObject({
      ok: false,
      erro: { codigo: 'troco_sem_dinheiro' },
    });
    expect(validarTroco(c(5000), [{ forma: 'dinheiro', valor: c(9300) }])).toMatchObject({
      ok: false,
      erro: { codigo: 'troco_menor', mensagem: 'O troco é para R$ 50,00, mas a parte em dinheiro é R$ 93,00.' },
    });
  });
});

describe('resumo para o WhatsApp (F2, 2b, passo 7)', () => {
  const a3557 = {
    codigo: '3557',
    linhas: [
      { nome: 'G ½ Filé Mignon ½ Calabresa', detalhes: [], quantidade: 1 },
      { nome: 'Refrigerante 2L', detalhes: [], quantidade: 1 },
    ],
    tipo: 'entrega' as const,
    area: 'Aragarças',
    referencia: 'hospital',
    total: c(11300),
    pagamentos: [{ forma: 'cartao' as const, valor: c(11300) }],
    trocoPara: null,
  };

  it('o exemplo da spec (a 3557)', () => {
    expect(resumoDoPedido(a3557)).toBe(
      'Pedido 3557: G ½ Filé Mignon ½ Calabresa + Refrigerante 2L · entrega em Aragarças (hospital) · total R$ 113,00 · cartão na entrega. Posso mandar para a produção?',
    );
  });

  it('quantidade, borda, retirada, troco e pagamento misto', () => {
    expect(
      resumoDoPedido({
        ...a3557,
        linhas: [
          { nome: 'Refrigerante lata', detalhes: [], quantidade: 2 },
          { nome: 'M Quatro Queijos', detalhes: ['borda Cheddar'], quantidade: 1 },
        ],
        tipo: 'retirada',
        area: null,
        referencia: null,
        total: c(8400),
        pagamentos: [{ forma: 'dinheiro', valor: c(8400) }],
        trocoPara: c(10000),
      }),
    ).toBe(
      'Pedido 3557: 2 Refrigerante lata + M Quatro Queijos (borda Cheddar) · retirada no balcão · total R$ 84,00 · dinheiro na retirada, troco para R$ 100,00. Posso mandar para a produção?',
    );
    expect(
      resumoDoPedido({
        ...a3557,
        referencia: null,
        pagamentos: [
          { forma: 'pix_antecipado', valor: c(5000) },
          { forma: 'dinheiro', valor: c(6300) },
        ],
      }),
    ).toContain('· entrega em Aragarças · total R$ 113,00 · R$ 50,00 no Pix antecipado + R$ 63,00 em dinheiro.');
  });

  it('o link abre a conversa com o texto pronto; o aviso de retirada', () => {
    expect(linkWhatsApp('64999993557', 'Oi, tudo bem?')).toBe('https://wa.me/5564999993557?text=Oi%2C%20tudo%20bem%3F');
    expect(avisoRetirada('3557')).toBe('Seu pedido 3557 está pronto para retirada.');
  });
});

describe('"Repetir" um pedido anterior', () => {
  it('traz os itens que ainda existem e aponta os que saíram do cardápio', () => {
    const antes: ItemPedido[] = [
      { tipo: 'pizza', tamanho: 'G', sabores: ['Filé Mignon', 'Calabresa'] },
      { tipo: 'bebida', nome: 'Refrigerante 2L' },
      { tipo: 'pizza', tamanho: 'G', sabores: ['Sabor Que Saiu'] },
      { tipo: 'combo', id: '99' },
    ];
    expect(repetirPedido(antes, cardapio)).toEqual({
      itens: antes.slice(0, 2),
      fora: ['G Sabor Que Saiu', 'Combo 99'],
    });
  });

  it('descreve cada item para a tela', () => {
    expect(descreverItem({ tipo: 'pizza', tamanho: 'G', sabores: ['Calabresa'], quantidade: 2 })).toBe('2 G Calabresa');
    expect(descreverItem({ tipo: 'pizza', tamanho: 'M', sabores: ['Calabresa', 'Portuguesa'] })).toBe(
      'M ½ Calabresa ½ Portuguesa',
    );
    expect(descreverItem({ tipo: 'outro', nome: 'Kit adicional de molhos' })).toBe('Kit adicional de molhos');
  });
});
