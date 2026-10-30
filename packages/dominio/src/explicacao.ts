// ACE10: toda tela de acerto mostra de onde vem cada número.
import type { ContaAcerto, Liquidacao } from './acerto';
import { type Centavos, formatarCurto, formatarReais } from './dinheiro';

export interface Parte {
  valor: Centavos;
  texto: string;
}

export interface Explicado {
  total: Centavos;
  partes: Parte[];
}

type Totais = Pick<
  ContaAcerto,
  | 'caixaInicial'
  | 'diaria'
  | 'dinheiro'
  | 'troco'
  | 'cartao'
  | 'pixMaquina'
  | 'taxas'
  | 'devolver'
  | 'maquininha'
  | 'receber'
>;

const semZeros = (partes: Parte[], fixas: number) => partes.filter((p, i) => i < fixas || p.valor !== 0);

export function explicarConta(c: Totais): { devolver: Explicado; receber: Explicado; maquininha: Explicado } {
  return {
    devolver: {
      total: c.devolver,
      partes: semZeros(
        [
          { valor: c.caixaInicial, texto: 'de caixa' },
          { valor: c.dinheiro, texto: 'em dinheiro' },
          { valor: c.troco, texto: 'de troco por Pix' },
        ],
        1,
      ),
    },
    receber: {
      total: c.receber,
      partes: semZeros(
        [
          { valor: c.diaria, texto: 'de diária' },
          { valor: c.taxas, texto: 'de taxas' },
        ],
        1,
      ),
    },
    maquininha: {
      total: c.maquininha,
      partes: semZeros(
        [
          { valor: c.cartao, texto: 'em cartão' },
          { valor: c.pixMaquina, texto: 'em Pix na maquininha' },
        ],
        0,
      ),
    },
  };
}

/** "80 de caixa + 160 em dinheiro + 3 de troco por Pix" */
export function textoDasPartes(e: Explicado): string {
  if (e.partes.length === 0) return 'nada';
  return e.partes.map((p) => `${formatarCurto(p.valor)} ${p.texto}`).join(' + ');
}

/** "Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa." */
export function textoDaLiquidacao(l: Liquidacao): string {
  if (l.pagar === 0) {
    return l.completa > 0 ? `Nada a pagar. Ele completa ${formatarReais(l.completa)} do bolso.` : 'Nada a pagar.';
  }
  if (l.doCaixaDele === 0) return `Retire ${formatarReais(l.retiradoCaixaEmpresa)} do caixa da empresa para pagar.`;
  const doCaixa = `Pague ${formatarReais(l.doCaixaDele)} do caixa dele`;
  return l.retiradoCaixaEmpresa > 0
    ? `${doCaixa} e retire ${formatarReais(l.retiradoCaixaEmpresa)} do caixa da empresa.`
    : `${doCaixa}.`;
}
