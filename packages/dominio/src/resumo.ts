// Resumo da noite (painel do Luan) e histórico do motoboy.
import type { ContaAcerto, TotalArea } from './acerto';
import { type Centavos, formatarValor, somar, somarPor } from './dinheiro';
import { formatarData } from './noite';

type ContaResumida = Pick<
  ContaAcerto,
  | 'dinheiro'
  | 'troco'
  | 'cartao'
  | 'pixMaquina'
  | 'pixAntecipado'
  | 'diaria'
  | 'taxas'
  | 'entregues'
  | 'voltaram'
  | 'porArea'
  | 'liquidacao'
>;

function somarAreas(contas: readonly Pick<ContaAcerto, 'porArea'>[]): Record<string, TotalArea> {
  const total: Record<string, TotalArea> = {};
  for (const c of contas) {
    for (const [area, t] of Object.entries(c.porArea)) {
      const a = total[area] ?? { entregues: 0, voltaram: 0, taxas: somar() };
      a.entregues += t.entregues;
      a.voltaram += t.voltaram;
      a.taxas = somar(a.taxas, t.taxas);
      total[area] = a;
    }
  }
  return total;
}

const contar = <T>(itens: readonly T[], f: (x: T) => number) => itens.reduce((s, x) => s + f(x), 0);

export interface ResumoNoite {
  porForma: { dinheiro: Centavos; troco: Centavos; cartao: Centavos; pixMaquina: Centavos; pixAntecipado: Centavos };
  pagoMotoboys: Centavos;
  doCaixaDeles: Centavos;
  retiradoCaixaEmpresa: Centavos;
  vaiParaEmpresa: Centavos;
  faltas: Centavos;
  sobras: Centavos;
  completado: Centavos;
  entregas: number;
  voltaram: number;
  porArea: Record<string, TotalArea>;
  /** Caixas sem dinheiro contado (fora das somas da liquidação). */
  pendentes: number;
}

export function resumirNoite(contas: readonly ContaResumida[]): ResumoNoite {
  const liq = contas.flatMap((c) => (c.liquidacao ? [c.liquidacao] : []));
  return {
    porForma: {
      dinheiro: somarPor(contas, (c) => c.dinheiro),
      troco: somarPor(contas, (c) => c.troco),
      cartao: somarPor(contas, (c) => c.cartao),
      pixMaquina: somarPor(contas, (c) => c.pixMaquina),
      pixAntecipado: somarPor(contas, (c) => c.pixAntecipado),
    },
    pagoMotoboys: somarPor(liq, (l) => l.pagar),
    doCaixaDeles: somarPor(liq, (l) => l.doCaixaDele),
    retiradoCaixaEmpresa: somarPor(liq, (l) => l.retiradoCaixaEmpresa),
    vaiParaEmpresa: somarPor(liq, (l) => l.vaiParaEmpresa),
    faltas: somarPor(liq, (l) => l.falta),
    sobras: somarPor(liq, (l) => l.sobra),
    completado: somarPor(liq, (l) => l.completa),
    entregas: contar(contas, (c) => c.entregues),
    voltaram: contar(contas, (c) => c.voltaram),
    porArea: somarAreas(contas),
    pendentes: contas.length - liq.length,
  };
}

/** "Entregas por cidade": junta as áreas da mesma cidade. */
export function agruparPorCidade(
  porArea: Record<string, TotalArea>,
  cidadeDe: (area: string) => string,
): Record<string, TotalArea> {
  return somarAreas(Object.entries(porArea).map(([area, t]) => ({ porArea: { [cidadeDe(area)]: { ...t } } })));
}

export interface LinhaDaNoite {
  ordem: number;
  motoboy: string;
  conta: Pick<
    ContaAcerto,
    'caixaInicial' | 'entregues' | 'voltaram' | 'devolver' | 'maquininha' | 'receber' | 'pixAntecipado' | 'liquidacao'
  >;
  confirmado: boolean;
}

/** Contingência (ARQUITETURA, Robustez): "Exportar a noite (CSV)" com os dados do aparelho, sem internet. */
export function noiteCsv(data: string, linhas: readonly LinhaDaNoite[]): string {
  const v = (c: Centavos | undefined) => (c === undefined ? '' : formatarValor(c));
  const cabecalho =
    'noite;ordem;motoboy;caixa_inicial;entregas;voltaram;devolver;maquininha;receber;pix_antecipado;' +
    'contado;pagar;do_caixa_dele;retirado_caixa_empresa;vai_para_empresa;acerto';
  const corpo = [...linhas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((l) => {
      const q = l.conta.liquidacao ?? undefined;
      return [
        formatarData(data),
        l.ordem,
        l.motoboy.replaceAll(';', ','),
        v(l.conta.caixaInicial),
        l.conta.entregues,
        l.conta.voltaram,
        v(l.conta.devolver),
        v(l.conta.maquininha),
        v(l.conta.receber),
        v(l.conta.pixAntecipado),
        v(q?.dinheiroContado),
        v(q?.pagar),
        v(q?.doCaixaDele),
        v(q?.retiradoCaixaEmpresa),
        v(q?.vaiParaEmpresa),
        l.confirmado ? 'confirmado' : 'pendente',
      ].join(';');
    });
  return `${cabecalho}\n${corpo.map((l) => `${l}\n`).join('')}`;
}
