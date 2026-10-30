import { transform } from 'receiptline';
import { describe, expect, it } from 'vitest';
import { calcularAcerto, type PagamentoAcerto, type SaidaAcerto } from '../acerto';
import { type Centavos, centavos } from '../dinheiro';
import { escapar, reciboDoAcerto } from './recibo';

const r = (reais: number) => centavos(Math.round(reais * 100));
const AREAS: Record<string, string> = { barra: 'Barra', ara: 'Aragarças', pontal: 'Pontal' };
const TAXA: Record<string, Centavos> = { barra: r(12), ara: r(5), pontal: r(10) };

// Noite base da F1 (T1), com a ordem de lançamento do recibo do MVP.md.
function contaBase(contado: number) {
  const linhas: [string, number, string, PagamentoAcerto['forma'], number, SaidaAcerto['estado']][] = [
    ['3557', 113, 'barra', 'dinheiro', 0, 'entregue'],
    ['0017', 60, 'ara', 'pix_antecipado', 0, 'entregue'],
    ['2672', 90, 'pontal', 'cartao', 0, 'entregue'],
    ['0910', 72, 'barra', 'pix_maquininha', 0, 'entregue'],
    ['3595', 47, 'ara', 'dinheiro', 3, 'entregue'],
    ['8094', 65, 'barra', 'dinheiro', 0, 'voltou'],
  ];
  return calcularAcerto({
    caixaInicial: r(80),
    diaria: r(30),
    dinheiroContado: r(contado),
    pedidos: linhas.map(([codigo], i) => ({ id: `p${i}`, codigo })),
    saidas: linhas.map(([, , area, , , estado], i) => ({
      id: `s${i}`,
      pedidoId: `p${i}`,
      area,
      taxa: TAXA[area] ?? r(0),
      estado,
      papelConferido: true,
    })),
    pagamentos: linhas.map(([, valor, , forma, troco], i) => ({
      id: `g${i}`,
      pedidoId: `p${i}`,
      saidaId: forma === 'pix_antecipado' ? null : `s${i}`,
      forma,
      valor: r(valor),
      trocoPix: r(troco),
      real: false,
      criadoEm: `2026-10-16T23:0${i}:00Z`,
    })),
  });
}

const base = {
  data: '2026-10-16',
  motoboy: 'Felipe',
  ordem: 1,
  confirmadoPor: 'Luan',
  hora: '23:48',
  nomeArea: (id: string) => AREAS[id] ?? id,
  voltaram: ['8094'],
  pix: [{ codigo: '0017', confirmado: true }],
};

describe('recibo do acerto (MVP.md, 80 mm e 48 colunas)', () => {
  it('é igual ao recibo do MVP para a noite base com contado 243', () => {
    expect(reciboDoAcerto({ ...base, conta: contaBase(243) })).toMatchSnapshot();
  });

  it('com falta, mostra a diferença negativa e o que ele completa', () => {
    const recibo = reciboDoAcerto({ ...base, conta: contaBase(140), pix: [{ codigo: '0017', confirmado: false }] });
    expect(recibo).toContain('Diferença | -103,00');
    expect(recibo).toContain('Completa do bolso | 17,00');
    expect(recibo).toContain('Pix antecipado: 60,00 (0017, não confirmado)');
  });

  it('lista os papéis que faltam (ACE8)', () => {
    const conta = contaBase(243);
    const recibo = reciboDoAcerto({
      ...base,
      conta: {
        ...conta,
        papelFaltando: [
          { saidaId: 's2', codigo: '2672' },
          { saidaId: 's5', codigo: '8094' },
        ],
      },
    });
    expect(recibo).toContain('|Papéis faltando: 2672, 8094');
  });

  it('sem contado não gera recibo (ainda não há acerto)', () => {
    expect(() => reciboDoAcerto({ ...base, conta: { ...contaBase(243), liquidacao: null } })).toThrow(
      'Recibo sem dinheiro contado',
    );
  });

  it('escapa o que a marcação entende como comando', () => {
    expect(escapar('João | "Zé" {x} ~_^`-=\\')).toBe('João \\| \\"Zé\\" \\{x\\} \\~\\_\\^\\`\\-\\=\\\\');
  });
});

describe('o recibo impresso em 48 colunas', () => {
  it('sai como o modelo do MVP.md', () => {
    const texto = transform(reciboDoAcerto({ ...base, conta: contaBase(243) }), {
      cpl: 48,
      encoding: 'multilingual',
      command: 'text',
    });
    const linhas = texto.split('\n').map((l) => l.trimEnd());
    for (const l of linhas) expect(l.length, l).toBeLessThanOrEqual(48);
    expect(linhas).toEqual(
      expect.arrayContaining([
        '                ACERTO DO MOTOBOY',
        'Noite: 16/10/2026            Motoboy: Felipe (1)',
        'Confirmado por: Luan                       23:48',
        'Entregas: 5 (Barra 2, Aragarças 2, Pontal 1)',
        'Voltaram: 1 (8094)',
        'Pix antecipado: 60,00 (0017, caiu)',
        'Caixa inicial                              80,00',
        'Dinheiro das vendas                       160,00',
        'Troco por Pix                               3,00',
        '= Devolver                                243,00',
        'Diferença                                   0,00',
        '= Receber                                  86,00',
        'Pago do caixa dele                         80,00',
        'Retirado do caixa da empresa                6,00',
        'Vai para a empresa                        163,00',
        'Maquininha esperada                       162,00',
        '  2672  cartão                             90,00',
        '  0910  Pix na maquininha                  72,00',
        'Papéis faltando: nenhum',
        'Motoboy: ______________   Luan: ______________',
      ]),
    );
  });
});
