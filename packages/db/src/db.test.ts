import { describe, expect, it } from 'vitest';
import { cardapioDasLinhas, entradaDoCaixa, type LinhaPagamento, type LinhaSaida } from './dominio';
import { tiposDeOperacao, VERSAO_OP, validarDados } from './operacoes';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('schemas das operações', () => {
  it('cobre as operações do servidor', () => {
    expect(tiposDeOperacao).toContain('lancar_saida');
    expect(tiposDeOperacao).toContain('confirmar_acerto');
    expect(VERSAO_OP).toBe(1);
  });

  it('aceita um lançamento válido e recusa centavos quebrados', () => {
    const dados = {
      caixa_id: id(1),
      pedido_id: id(2),
      saida_id: id(3),
      codigo: '3557',
      total: 11300,
      area_id: id(4),
      pagamentos: [{ id: id(5), forma: 'dinheiro', valor: 11300 }],
    };
    expect(validarDados('lancar_saida', dados)).toEqual(dados);
    expect(() => validarDados('lancar_saida', { ...dados, total: 113.5 })).toThrow();
    expect(() => validarDados('lancar_saida', { ...dados, codigo: '357' })).toThrow();
  });

  it('exige versao_esperada onde a operação depende do estado atual', () => {
    expect(() => validarDados('trocar_pagamento', { saida_id: id(1), pagamentos: [] })).toThrow();
    expect(validarDados('trocar_pagamento', { saida_id: id(1), versao_esperada: 3, pagamentos: [] })).toMatchObject({
      versao_esperada: 3,
    });
    expect(() => validarDados('cancelar_saida', { saida_id: id(1) })).toThrow();
  });

  it('reabrir o acerto exige motivo (OPE3)', () => {
    expect(() => validarDados('reabrir_acerto', { caixa_id: id(1), motivo: '  ' })).toThrow();
    expect(validarDados('reabrir_acerto', { caixa_id: id(1), motivo: 'Contou de novo' })).toMatchObject({
      motivo: 'Contou de novo',
    });
  });
});

describe('linhas do banco para o domínio', () => {
  const saida = (n: number, caixa: number, extra: Partial<LinhaSaida> = {}): LinhaSaida => ({
    id: id(n),
    pedido_id: id(100 + n),
    caixa_id: id(caixa),
    area_id: id(9),
    taxa: 1200,
    estado: 'entregue',
    papel_conferido: false,
    cancelada_em: null,
    ...extra,
  });
  const pagamento = (n: number, pedido: number, extra: Partial<LinhaPagamento> = {}): LinhaPagamento => ({
    id: id(200 + n),
    pedido_id: id(100 + pedido),
    saida_id: id(pedido),
    forma: 'dinheiro',
    valor: 5000,
    troco_pix: 0,
    real: false,
    registrado_em: '2026-10-16T23:00:00+00:00',
    anulado_em: null,
    ...extra,
  });

  it('pega só as saídas e os pagamentos do caixa, marcando cancelados e anulados', () => {
    const entrada = entradaDoCaixa(
      { id: id(1), caixa_inicial: 8000, diaria: 3000, dinheiro_contado: null },
      {
        pedidos: [
          { id: id(101), codigo: '3557' },
          { id: id(102), codigo: '1111' },
          { id: id(103), codigo: '2222' },
        ],
        saidas: [saida(1, 1), saida(2, 2), saida(3, 1, { cancelada_em: '2026-10-16T23:10:00+00:00' })],
        pagamentos: [pagamento(1, 1), pagamento(2, 2), pagamento(3, 3, { anulado_em: '2026-10-16T23:10:00+00:00' })],
      },
    );
    expect(entrada.pedidos.map((p) => p.codigo)).toEqual(['3557', '2222']);
    expect(entrada.saidas.map((s) => s.cancelada)).toEqual([false, true]);
    expect(entrada.pagamentos.map((p) => p.anulado)).toEqual([false, true]);
    expect(entrada.pagamentos[0]?.criadoEm).toBe('2026-10-16T23:00:00.000Z');
    expect(entrada.dinheiroContado).toBeNull();
  });
});

describe('cardápio das linhas do banco', () => {
  const agora = '2026-10-31T00:00:00Z';
  const base = { ativo: true, criado_em: agora, atualizado_em: agora };
  const faixas = (['tradicional', 'especial', 'premium', 'doce', 'doce_especial'] as const).flatMap((faixa, i) =>
    (['B', 'P', 'M', 'G'] as const).map((tamanho, j) => ({ faixa, tamanho, preco: 3000 + i * 1000 + j * 100 })),
  );
  const linhas = {
    faixas,
    sabores: [
      {
        ...base,
        id: id(1),
        nome: 'Portuguesa',
        faixa: 'tradicional' as const,
        ingredientes: null,
        apelidos: [],
        ordem: 2,
      },
      {
        ...base,
        id: id(2),
        nome: 'Calabresa',
        faixa: 'tradicional' as const,
        ingredientes: null,
        apelidos: [],
        ordem: 1,
      },
      {
        ...base,
        id: id(3),
        nome: 'Velha',
        faixa: 'tradicional' as const,
        ingredientes: null,
        apelidos: [],
        ordem: 3,
        ativo: false,
      },
    ],
    bordas: [],
    adicionais: [
      { ...base, id: id(4), nome: 'Bacon', preco: 1000, avulso: false, ordem: 1 },
      { ...base, id: id(5), nome: 'Kit adicional de molhos', preco: 400, avulso: true, ordem: 2 },
    ],
    bebidas: [],
    combos: [{ ...base, id: id(6), codigo: '01', itens: ['Portuguesa G'], preco: 14999, ordem: 1 }],
  };

  it('na ordem do cardápio, sem os inativos nem os que acabaram hoje', () => {
    const c = cardapioDasLinhas(linhas, new Set([id(1)]));
    expect(c.sabores.map((s) => s.nome)).toEqual(['Calabresa']);
    expect(c.faixas.premium.G).toBe(5300);
    expect(c.adicionais.map((a) => a.nome)).toEqual(['Bacon']);
    expect(c.outros.map((a) => a.nome)).toEqual(['Kit adicional de molhos']);
    expect(c.combos).toEqual([{ id: '01', itens: ['Portuguesa G'], preco: 14999 }]);
  });

  it('cardápio sem o preço de uma faixa é falha inesperada', () => {
    expect(() => cardapioDasLinhas({ ...linhas, faixas: faixas.slice(1) })).toThrow(/tradicional no tamanho B/);
  });
});
