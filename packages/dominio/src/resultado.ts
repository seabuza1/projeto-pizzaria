// Regra de negócio não lança exceção: devolve um resultado (PADROES, Erros).
// O código vai para o registro de erros; a mensagem é para quem usa.

export interface ErroDeRegra {
  codigo: string;
  mensagem: string;
  /** Quando falta escolher: as opções para a tela mostrar (F2, P11). */
  opcoes?: readonly string[];
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroDeRegra };

export const sucesso = <T>(valor: T): Resultado<T> => ({ ok: true, valor });

export const falha = (
  codigo: string,
  mensagem: string,
  opcoes?: readonly string[],
): { ok: false; erro: ErroDeRegra } => ({
  ok: false,
  erro: opcoes ? { codigo, mensagem, opcoes } : { codigo, mensagem },
});
