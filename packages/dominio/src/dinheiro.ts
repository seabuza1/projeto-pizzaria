// Dinheiro sempre em centavos (inteiro). Formatação fixa em pt-BR, sem depender do Intl do aparelho.

/** 123456 → "1.234,56" */
export function formatarValor(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(Math.round(centavos));
  const reais = Math.floor(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = (absoluto % 100).toString().padStart(2, '0');
  return `${sinal}${reais},${resto}`;
}

/** 123456 → "R$ 1.234,56"; -300 → "-R$ 3,00" */
export function formatarReais(centavos: number): string {
  const valor = formatarValor(centavos);
  return valor.startsWith('-') ? `-R$ ${valor.slice(1)}` : `R$ ${valor}`;
}

export function ehCentavos(valor: number): boolean {
  return Number.isSafeInteger(valor);
}
