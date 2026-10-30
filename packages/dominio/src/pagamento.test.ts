import { describe, expect, it } from 'vitest';
import { validarLancamento } from './pagamento';

const erro = (codigo: string, mensagem: string) => ({ ok: false, erro: { codigo, mensagem } });

describe('validação do lançamento', () => {
  it('aceita pagamento misto que soma o total', () => {
    const r = validarLancamento({
      codigo: '1234',
      total: 5000,
      pagamentos: [
        { forma: 'pix_antecipado', valor: 2000 },
        { forma: 'dinheiro', valor: 3000, trocoPix: 300 },
      ],
    });
    expect(r).toEqual({
      ok: true,
      valor: {
        codigo: '1234',
        total: 5000,
        pagamentos: [
          { forma: 'pix_antecipado', valor: 2000, trocoPix: 0 },
          { forma: 'dinheiro', valor: 3000, trocoPix: 300 },
        ],
      },
    });
  });

  it('T9 pagamento misto cuja soma difere do total: bloqueado, com mensagem (PAG2)', () => {
    const r = validarLancamento({
      codigo: '1234',
      total: 5000,
      pagamentos: [
        { forma: 'pix_antecipado', valor: 2000 },
        { forma: 'dinheiro', valor: 2500 },
      ],
    });
    expect(r).toEqual(erro('soma_diferente', 'Pagamentos somam R$ 45,00, mas o total é R$ 50,00.'));
  });

  it('T19 troco por Pix sem parte em dinheiro: recusado (PAG4)', () => {
    for (const forma of ['cartao', 'pix_maquininha', 'pix_antecipado'] as const) {
      const r = validarLancamento({ codigo: '2672', total: 9000, pagamentos: [{ forma, valor: 9000, trocoPix: 300 }] });
      expect(r).toEqual(erro('troco_sem_dinheiro', 'Troco por Pix só com parte em dinheiro.'));
    }
  });

  it('recusa troco por Pix na linha do cartão, mesmo com outra parte em dinheiro', () => {
    const r = validarLancamento({
      codigo: '2672',
      total: 9000,
      pagamentos: [
        { forma: 'dinheiro', valor: 5000 },
        { forma: 'cartao', valor: 4000, trocoPix: 300 },
      ],
    });
    expect(r).toEqual(erro('troco_sem_dinheiro', 'Troco por Pix só com parte em dinheiro.'));
  });

  it('recusa código sem 4 dígitos', () => {
    for (const codigo of ['', '123', '12345', '12a4']) {
      const r = validarLancamento({ codigo, total: 1000, pagamentos: [{ forma: 'dinheiro', valor: 1000 }] });
      expect(r).toEqual(erro('codigo_invalido', 'O código tem 4 dígitos.'));
    }
  });

  it('recusa lançamento sem forma de pagamento', () => {
    expect(validarLancamento({ codigo: '1234', total: 1000, pagamentos: [] })).toEqual(
      erro('sem_pagamento', 'Escolha a forma de pagamento.'),
    );
  });

  it('recusa valores que não são centavos inteiros e positivos', () => {
    expect(
      validarLancamento({ codigo: '1234', total: 10.5, pagamentos: [{ forma: 'dinheiro', valor: 10.5 }] }),
    ).toEqual(erro('total_invalido', 'Total inválido.'));
    expect(validarLancamento({ codigo: '1234', total: 1000, pagamentos: [{ forma: 'dinheiro', valor: 0 }] })).toEqual(
      erro('valor_invalido', 'Valor inválido no pagamento.'),
    );
    expect(
      validarLancamento({
        codigo: '1234',
        total: 1000,
        pagamentos: [{ forma: 'dinheiro', valor: 1000, trocoPix: -1 }],
      }),
    ).toEqual(erro('troco_invalido', 'Troco por Pix inválido.'));
  });
});
