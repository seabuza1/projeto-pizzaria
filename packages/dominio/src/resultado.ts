// Regra de negócio não lança exceção: devolve um resultado (PADROES, Erros).
// O código vai para o registro de erros; a mensagem é para quem usa.

export interface ErroDeRegra {
  codigo: string;
  mensagem: string;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroDeRegra };

export const sucesso = <T>(valor: T): Resultado<T> => ({ ok: true, valor });

export const falha = (codigo: string, mensagem: string): { ok: false; erro: ErroDeRegra } => ({
  ok: false,
  erro: { codigo, mensagem },
});
