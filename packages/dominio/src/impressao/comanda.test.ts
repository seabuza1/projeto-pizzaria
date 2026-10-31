import { transform } from 'receiptline';
import { describe, expect, it } from 'vitest';
import { centavos as c } from '../dinheiro';
import { comandaDoPedido, type DadosComanda } from './comanda';

// A 3557 real (P2): G ½ Filé Mignon ½ Calabresa + Refrigerante 2L, Aragarças, cartão.
const a3557: DadosComanda = {
  codigo: '3557',
  promocao: false,
  alterado: false,
  linhas: [
    { nome: 'G ½ Filé Mignon ½ Calabresa', detalhes: [], quantidade: 1, desconto: c(0), total: c(9300) },
    { nome: 'Refrigerante 2L', detalhes: [], quantidade: 1, desconto: c(0), total: c(1500) },
  ],
  tipo: 'entrega',
  area: 'Aragarças',
  endereco: 'Rua 7, 120',
  referencia: 'hospital',
  link: 'https://maps.app.goo.gl/abc123',
  telefone: '64999993557',
  cliente: 'Maria',
  total: c(11300),
  pagamentos: [{ forma: 'cartao', valor: c(11300) }],
  trocoPara: null,
  pixPago: null,
  data: '2026-10-16',
  hora: '21:48',
};

describe('comanda impressa (F2, 2c; 80 mm)', () => {
  it('a 3557: código grande, itens, total, forma, área, referência, telefone e QR do Maps', () => {
    const comanda = comandaDoPedido(a3557);
    expect(comanda).toMatchSnapshot();
    expect(comanda).toContain('^^^^3557\n');
    expect(comanda).toContain('{code:https\\://maps.app.goo.gl/abc123; option:qrcode,6,m}');
    expect(comanda).toContain('Taxa Aragarças | 5,00');
    expect(comanda).not.toContain('SEM LOCALIZAÇÃO');
  });

  it('promoção (asterisco), ALTERADO, dinheiro com troco e Pix antecipado a conferir', () => {
    const comanda = comandaDoPedido({
      ...a3557,
      promocao: true,
      alterado: true,
      linhas: [
        {
          nome: 'G Portuguesa',
          detalhes: ['borda Cheddar', '+ Bacon'],
          quantidade: 2,
          desconto: c(1000),
          total: c(17800),
        },
      ],
      total: c(18300),
      pagamentos: [
        { forma: 'pix_antecipado', valor: c(5000) },
        { forma: 'dinheiro', valor: c(13300) },
      ],
      trocoPara: c(15000),
      pixPago: false,
      link: null,
    });
    expect(comanda).toMatchSnapshot();
    expect(comanda.startsWith('^^`ALTERADO`\n^^^^3557 *\n')).toBe(true);
    expect(comanda).toContain('2 "G Portuguesa" * | 178,00');
    expect(comanda).toContain('~~borda Cheddar |');
    expect(comanda).toContain('|^"TROCO PARA 150,00"');
    expect(comanda).toContain('|^`PIX: CONFERIR`');
    expect(comanda).toContain('^^`SEM LOCALIZAÇÃO`');
  });

  it('retirada: sem taxa e sem endereço; Pix que já caiu sai "PIX PAGO"', () => {
    const comanda = comandaDoPedido({
      ...a3557,
      tipo: 'retirada',
      area: null,
      linhas: [{ nome: 'G Frango c/ Catupiry', detalhes: [], quantidade: 1, desconto: c(0), total: c(7300) }],
      total: c(7300),
      pagamentos: [{ forma: 'pix_antecipado', valor: c(7300) }],
      pixPago: true,
    });
    expect(comanda).toContain('"RETIRADA"');
    expect(comanda).toContain('|Retirada no balcão');
    expect(comanda).toContain('|^"PIX PAGO"');
    expect(comanda).not.toContain('Taxa');
    expect(comanda).not.toContain('SEM LOCALIZAÇÃO');
  });

  it('vira ESC/POS e SVG sem erro (o que o agente e a prévia fazem)', () => {
    const comanda = comandaDoPedido(a3557);
    expect(transform(comanda, { cpl: 48, encoding: 'cp860', command: 'svg' })).toContain('<svg');
    expect(transform(comanda, { cpl: 48, encoding: 'cp860', command: 'escpos' }).length).toBeGreaterThan(100);
  });

  it('nome com caractere da marcação não vira comando', () => {
    const comanda = comandaDoPedido({ ...a3557, cliente: 'Zé | {teste}' });
    expect(comanda).toContain('|Zé \\| \\{teste\\}');
  });
});
