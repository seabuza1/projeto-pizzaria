import { ehCentavos, formatarReais } from './dinheiro';

/** PAG1, sem o crédito do cliente (fase 2). PAG6: Pix na hora é sempre na maquininha. */
export type Forma = 'dinheiro' | 'cartao' | 'pix_maquininha' | 'pix_antecipado';

export interface PagamentoLancado {
  forma: Forma;
  valor: number;
  trocoPix?: number;
}

export interface Lancamento {
  codigo: string;
  total: number;
  pagamentos: readonly PagamentoLancado[];
}

/**
 * Valida o lançamento da comanda (e a troca de forma na porta).
 * Devolve as mensagens para a tela; lista vazia = pode lançar.
 */
export function validarLancamento({ codigo, total, pagamentos }: Lancamento): string[] {
  const erros: string[] = [];

  // PED1: o código são os 4 últimos dígitos do telefone.
  if (!/^\d{4}$/.test(codigo)) erros.push('O código tem 4 dígitos.');

  const totalOk = ehCentavos(total) && total > 0;
  if (!totalOk) erros.push('Total inválido.');

  if (pagamentos.length === 0) {
    erros.push('Escolha a forma de pagamento.');
    return erros;
  }

  const valoresOk = pagamentos.every((p) => ehCentavos(p.valor) && p.valor > 0);
  if (!valoresOk) erros.push('Valor inválido no pagamento.');

  const trocosOk = pagamentos.every((p) => ehCentavos(p.trocoPix ?? 0) && (p.trocoPix ?? 0) >= 0);
  if (!trocosOk) erros.push('Troco por Pix inválido.');

  // PAG4: troco por Pix só na parte em dinheiro.
  if (pagamentos.some((p) => (p.trocoPix ?? 0) > 0 && p.forma !== 'dinheiro')) {
    erros.push('Troco por Pix só com parte em dinheiro.');
  }

  // PAG2: a soma dos pagamentos é igual ao total.
  if (totalOk && valoresOk) {
    const soma = pagamentos.reduce((s, p) => s + p.valor, 0);
    if (soma !== total) erros.push(`Os pagamentos somam ${formatarReais(soma)} e o total é ${formatarReais(total)}.`);
  }

  return erros;
}
