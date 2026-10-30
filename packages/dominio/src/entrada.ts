// O que o motoboy digita no lançamento.
import type { Forma } from './pagamento';

/** "113" → 11300; "47,50" → 4750; "1.234,56" → 123456. Inválido → null. */
export function lerValor(texto: string): number | null {
  const t = texto.trim();
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const reais = Number((m[1] ?? '').replaceAll('.', ''));
  const centavos = Number((m[2] ?? '').padEnd(2, '0'));
  const valor = reais * 100 + centavos;
  return Number.isSafeInteger(valor) ? valor : null;
}

export interface LinhaDivisao {
  forma: Forma;
  valor: number | null;
}

export type Divisao = { ok: true; linhas: { forma: Forma; valor: number }[] } | { ok: false; erro: string };

/** "Pagou de mais de um jeito": a linha vazia fica com o resto do total. */
export function completarResto(total: number, linhas: readonly LinhaDivisao[]): Divisao {
  const vazias = linhas.filter((l) => l.valor === null);
  if (vazias.length > 1) return { ok: false, erro: 'Deixe só uma linha sem valor.' };
  const preenchido = linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
  const resto = total - preenchido;
  if (vazias.length === 1 && resto <= 0) return { ok: false, erro: 'Não sobra nada para a linha vazia.' };
  return { ok: true, linhas: linhas.map((l) => ({ forma: l.forma, valor: l.valor ?? resto })) };
}
