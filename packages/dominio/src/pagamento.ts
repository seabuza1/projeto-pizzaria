import { type Centavos, ehCentavos, formatarReais, somar, ZERO } from './dinheiro';
import { falha, type Resultado, sucesso } from './resultado';

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

export interface PagamentoValido {
  forma: Forma;
  valor: Centavos;
  trocoPix: Centavos;
}

export interface LancamentoValido {
  codigo: string;
  total: Centavos;
  pagamentos: PagamentoValido[];
}

// Os mesmos códigos e mensagens de interno.validar_pagamentos (supabase/migrations).
export const ERROS_LANCAMENTO = {
  codigo_invalido: 'O código tem 4 dígitos.',
  total_invalido: 'Total inválido.',
  sem_pagamento: 'Escolha a forma de pagamento.',
  valor_invalido: 'Valor inválido no pagamento.',
  troco_invalido: 'Troco por Pix inválido.',
  troco_sem_dinheiro: 'Troco por Pix só com parte em dinheiro.',
} as const;

const erro = (codigo: keyof typeof ERROS_LANCAMENTO) => falha(codigo, ERROS_LANCAMENTO[codigo]);

/** PAG2: a soma dos pagamentos é igual ao total. */
export function validarPagamentos(
  total: Centavos,
  pagamentos: readonly PagamentoLancado[],
): Resultado<PagamentoValido[]> {
  if (pagamentos.length === 0) return erro('sem_pagamento');
  if (!pagamentos.every((p) => ehCentavos(p.valor) && p.valor > 0)) return erro('valor_invalido');
  if (!pagamentos.every((p) => ehCentavos(p.trocoPix ?? 0) && (p.trocoPix ?? 0) >= 0)) return erro('troco_invalido');
  const validos = pagamentos.map((p) => ({
    forma: p.forma,
    valor: p.valor as Centavos,
    trocoPix: (p.trocoPix ?? ZERO) as Centavos,
  }));
  // PAG4: troco por Pix só na parte em dinheiro.
  if (validos.some((p) => p.trocoPix > 0 && p.forma !== 'dinheiro')) return erro('troco_sem_dinheiro');
  const soma = somar(...validos.map((p) => p.valor));
  if (soma !== total) {
    return falha('soma_diferente', `Pagamentos somam ${formatarReais(soma)}, mas o total é ${formatarReais(total)}.`);
  }
  return sucesso(validos);
}

/** Valida o lançamento da comanda (e a troca de forma na porta). */
export function validarLancamento({ codigo, total, pagamentos }: Lancamento): Resultado<LancamentoValido> {
  // PED1: o código são os 4 últimos dígitos do telefone.
  if (!/^\d{4}$/.test(codigo)) return erro('codigo_invalido');
  if (!ehCentavos(total) || total <= 0) return erro('total_invalido');
  const r = validarPagamentos(total, pagamentos);
  return r.ok ? sucesso({ codigo, total, pagamentos: r.valor }) : r;
}
