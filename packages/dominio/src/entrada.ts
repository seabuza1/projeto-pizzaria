// O que o motoboy digita no lançamento.
import { type Centavos, somarPor, subtrair } from './dinheiro';
import type { Forma } from './pagamento';
import { falha, type Resultado, sucesso } from './resultado';

/** "113" → 11300; "47,50" → 4750; "1.234,56" → 123456. */
export function lerValor(texto: string): Resultado<Centavos> {
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(texto.trim());
  const valor = m ? Number((m[1] ?? '').replaceAll('.', '')) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : Number.NaN;
  if (!Number.isSafeInteger(valor)) return falha('valor_invalido', 'Digite o valor, por exemplo 113 ou 47,50.');
  return sucesso(valor as Centavos);
}

export interface LinhaDivisao {
  forma: Forma;
  valor: Centavos | null;
}

/** "Pagou de mais de um jeito": a linha vazia fica com o resto do total. */
export function completarResto(
  total: Centavos,
  linhas: readonly LinhaDivisao[],
): Resultado<{ forma: Forma; valor: Centavos }[]> {
  const vazias = linhas.filter((l) => l.valor === null);
  if (vazias.length > 1) return falha('linhas_vazias', 'Deixe só uma linha sem valor.');
  const resto = subtrair(
    total,
    somarPor(linhas, (l) => l.valor ?? (0 as Centavos)),
  );
  if (vazias.length === 1 && resto <= 0) return falha('sem_resto', 'Não sobra nada para a linha vazia.');
  return sucesso(linhas.map((l) => ({ forma: l.forma, valor: l.valor ?? resto })));
}
