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

export interface NoiteDoHistorico {
  /** AAAA-MM-DD */
  data: string;
  conta: Pick<ContaAcerto, 'diaria' | 'taxas' | 'entregues' | 'voltaram' | 'porArea' | 'liquidacao'>;
}

export type Periodo = 'semana' | 'mes';

/** Semana de segunda a domingo; mês do calendário. */
export function filtrarPeriodo<T extends { data: string }>(noites: readonly T[], periodo: Periodo, hoje: string): T[] {
  if (periodo === 'mes') return noites.filter((n) => n.data.slice(0, 7) === hoje.slice(0, 7));
  const dia = new Date(`${hoje}T12:00:00Z`);
  const desdeSegunda = (dia.getUTCDay() + 6) % 7;
  const inicio = new Date(dia.getTime() - desdeSegunda * 864e5).toISOString().slice(0, 10);
  return noites.filter((n) => n.data >= inicio && n.data <= hoje);
}

export function resumirPeriodo(noites: readonly NoiteDoHistorico[]) {
  return {
    noites: noites.length,
    entregas: contar(noites, (n) => n.conta.entregues),
    porArea: somarAreas(noites.map((n) => n.conta)),
    diarias: somarPor(noites, (n) => n.conta.diaria),
    taxas: somarPor(noites, (n) => n.conta.taxas),
    // O que ele levou de fato: o que recebe menos a falta.
    recebido: somarPor(noites, (n) => n.conta.liquidacao?.pagar ?? somar()),
    pendentes: noites.filter((n) => !n.conta.liquidacao).length,
  };
}

export function historicoCsv(noites: readonly NoiteDoHistorico[]): string {
  const linhas = [...noites]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((n) =>
      [
        formatarData(n.data),
        n.conta.entregues,
        n.conta.voltaram,
        formatarValor(n.conta.diaria),
        formatarValor(n.conta.taxas),
        n.conta.liquidacao ? formatarValor(n.conta.liquidacao.pagar) : '',
      ].join(';'),
    );
  return `data;entregas;voltaram;diaria;taxas;recebido\n${linhas.map((l) => `${l}\n`).join('')}`;
}

/** "Entregas por cidade": junta as áreas da mesma cidade. */
export function agruparPorCidade(
  porArea: Record<string, TotalArea>,
  cidadeDe: (area: string) => string,
): Record<string, TotalArea> {
  return somarAreas(Object.entries(porArea).map(([area, t]) => ({ porArea: { [cidadeDe(area)]: { ...t } } })));
}
