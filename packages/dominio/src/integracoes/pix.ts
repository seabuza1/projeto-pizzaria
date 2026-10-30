// Interface do provedor Pix (ARQUITETURA, Integrações). Desenhada no MVP, usada depois:
// o Pix automático entra com as integrações; a bancada usa um Pix falso com esta mesma interface.
import type { Centavos } from '../dinheiro';
import type { Resultado } from '../resultado';

export interface CobrancaPix {
  txid: string;
  valor: Centavos;
  /** Pix copia e cola. */
  copiaECola: string;
  /** ISO 8601. */
  expiraEm: string;
}

export type EstadoCobranca =
  | { estado: 'ativa' }
  | { estado: 'paga'; valorPago: Centavos; pagoEm: string }
  | { estado: 'expirada' };

export interface PagamentoRecebido {
  txid: string;
  valor: Centavos;
  pagoEm: string;
}

export interface ProvedorPix {
  readonly nome: string;
  criarCobranca(pedido: {
    pedidoId: string;
    valor: Centavos;
    expiraEmSegundos: number;
  }): Promise<Resultado<CobrancaPix>>;
  consultar(txid: string): Promise<Resultado<EstadoCobranca>>;
  /** Confere a assinatura do webhook antes de confiar no corpo (BANCADA, Pix falso). */
  validarWebhook(corpo: string, cabecalhos: Readonly<Record<string, string>>): Resultado<PagamentoRecebido[]>;
}
