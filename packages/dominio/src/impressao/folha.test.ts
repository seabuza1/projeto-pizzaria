import { transform } from 'receiptline';
import { describe, expect, it } from 'vitest';
import { liquidar } from '../acerto';
import { centavos as c } from '../dinheiro';
import { resumirNoite } from '../resumo';
import { type DadosFolha, folhaDaNoite } from './folha';

const contaFelipe = {
  caixaInicial: c(8000),
  dinheiro: c(16000),
  troco: c(300),
  cartao: c(9000),
  pixMaquina: c(7200),
  pixAntecipado: c(6000),
  diaria: c(3000),
  taxas: c(5600),
  entregues: 5,
  voltaram: 1,
  devolver: c(24300),
  receber: c(8600),
  porArea: { barra: { entregues: 2, voltaram: 1, taxas: c(3600) } },
  liquidacao: liquidar({ caixaInicial: c(8000), devolver: c(24300), receber: c(8600), dinheiroContado: c(24300) }),
};
const contaJoao = {
  ...contaFelipe,
  dinheiro: c(3700),
  troco: c(0),
  cartao: c(0),
  pixMaquina: c(0),
  pixAntecipado: c(8000),
  entregues: 2,
  voltaram: 0,
  devolver: c(11700),
  receber: c(5700),
  liquidacao: null,
};

const dados: DadosFolha = {
  data: '2026-10-16',
  hora: '23:59',
  colunas: [
    {
      ordem: 2,
      motoboy: 'João',
      linhas: [
        {
          codigo: '8498',
          formas: ['pix_antecipado', 'dinheiro'],
          estado: 'entregue',
          trocoPix: c(0),
          papelConferido: true,
        },
        { codigo: '1693', formas: ['cartao'], estado: 'em_rota', trocoPix: c(0), papelConferido: false },
      ],
      conta: contaJoao,
      confirmado: false,
    },
    {
      ordem: 1,
      motoboy: 'Felipe',
      linhas: [
        { codigo: '3557', formas: ['dinheiro'], estado: 'entregue', trocoPix: c(0), papelConferido: true },
        { codigo: '3595', formas: ['dinheiro'], estado: 'entregue', trocoPix: c(300), papelConferido: true },
        { codigo: '8094', formas: ['dinheiro'], estado: 'voltou', trocoPix: c(0), papelConferido: true },
      ],
      conta: contaFelipe,
      confirmado: true,
    },
  ],
  pix: [
    { codigo: '0017', valor: c(6000), confirmado: true },
    { codigo: '8498', valor: c(2000), confirmado: false },
  ],
  resumo: resumirNoite([contaFelipe, contaJoao]),
};

describe('folha da noite', () => {
  it('marcação estável (snapshot)', () => {
    expect(folhaDaNoite(dados)).toMatchSnapshot();
  });

  it('impressa em 48 colunas, na ordem de chegada, com PIX e resumo', () => {
    const linhas = transform(folhaDaNoite(dados), { cpl: 48, encoding: 'multilingual', command: 'text' })
      .split('\n')
      .map((l) => l.trimEnd());
    for (const l of linhas) expect(l.length, l).toBeLessThanOrEqual(48);
    const texto = linhas.join('\n');
    expect(texto.indexOf('1 Felipe')).toBeLessThan(texto.indexOf('2 João'));
    expect(linhas).toEqual(
      expect.arrayContaining([
        'Noite: 16/10/2026              Impressa às 23:59',
        '  3595  din ->3,00',
        '  8094  voltou',
        '  1693  cartão (em rota) *',
        'Devolve                                   243,00',
        'Acerto confirmado: pago                    86,00',
        'Acerto pendente',
        '  0017  caiu                               60,00',
        '  8498  conferir                           20,00',
        'Pago aos motoboys                          86,00',
        'Atenção: 1 caixa(s) sem acerto',
      ]),
    );
  });
});
