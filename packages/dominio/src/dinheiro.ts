// Dinheiro sempre em centavos inteiros (PADROES, Tipos e dados).
// A marca de tipo impede somar centavos com um número qualquer (reais, quantidade, minutos).

declare const marcaCentavos: unique symbol;
export type Centavos = number & { readonly [marcaCentavos]: true };

export const ZERO = 0 as Centavos;

export function ehCentavos(valor: unknown): valor is Centavos {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

/** Para valores que já passaram por um schema (banco, Zod). Número quebrado é falha inesperada. */
export function centavos(valor: number): Centavos {
  if (!ehCentavos(valor)) throw new TypeError(`Centavos inválidos: ${valor}`);
  return valor;
}

export function somar(...valores: readonly Centavos[]): Centavos {
  return valores.reduce<number>((total, v) => total + v, 0) as Centavos;
}

export function subtrair(a: Centavos, b: Centavos): Centavos {
  return (a - b) as Centavos;
}

export function menor(...valores: readonly Centavos[]): Centavos {
  return Math.min(...valores) as Centavos;
}

/** max(0, valor) */
export function naoNegativo(valor: Centavos): Centavos {
  return Math.max(0, valor) as Centavos;
}

export function comparar(a: Centavos, b: Centavos): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Soma um campo em centavos de uma lista. */
export function somarPor<T>(itens: readonly T[], campo: (item: T) => Centavos): Centavos {
  return somar(...itens.map(campo));
}

/** 123456 → "1.234,56". Formatação fixa em pt-BR, sem depender do Intl do aparelho. */
export function formatarValor(valor: Centavos): string {
  const sinal = valor < 0 ? '-' : '';
  const absoluto = Math.abs(valor);
  const reais = Math.floor(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = (absoluto % 100).toString().padStart(2, '0');
  return `${sinal}${reais},${resto}`;
}

/** 123456 → "R$ 1.234,56"; -300 → "-R$ 3,00" */
export function formatarReais(valor: Centavos): string {
  const texto = formatarValor(valor);
  return texto.startsWith('-') ? `-R$ ${texto.slice(1)}` : `R$ ${texto}`;
}

/** Sem os centavos quando são zero: 8000 → "80"; 4750 → "47,50" */
export function formatarCurto(valor: Centavos): string {
  const texto = formatarValor(valor);
  return texto.endsWith(',00') ? texto.slice(0, -3) : texto;
}
