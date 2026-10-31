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
