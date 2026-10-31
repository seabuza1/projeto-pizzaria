// Interface da impressora (ARQUITETURA, Integrações). O agente usa a impressora de rede (TCP 9100);
// a bancada troca por uma impressora virtual sem mexer nas telas.
import type { Resultado } from '../resultado';

export type TipoImpressao = 'recibo_acerto' | 'folha_noite' | 'comanda';

export interface TrabalhoImpressao {
  id: string;
  tipo: TipoImpressao;
  /** Marcação ReceiptLine (packages/dominio/src/impressao). */
  conteudo: string;
}

export interface Impressora {
  readonly nome: string;
  imprimir(trabalho: TrabalhoImpressao): Promise<Resultado<void>>;
}

/** ARQUITETURA, Robustez: o agente grava "vivo" a cada 30 s; sem sinal há 2 minutos, a impressora está sem resposta. */
export const SEM_BATIMENTO_MS = 2 * 60_000;

export type SituacaoImpressora = 'ok' | 'sem_resposta' | 'sem_agente';

export function situacaoDaImpressora(
  batimento: { vistoEm: string; impressoraOk: boolean } | null,
  agora: Date,
): SituacaoImpressora {
  if (!batimento) return 'sem_agente';
  if (agora.getTime() - new Date(batimento.vistoEm).getTime() > SEM_BATIMENTO_MS) return 'sem_resposta';
  return batimento.impressoraOk ? 'ok' : 'sem_resposta';
}
