// Fila de impressão: pega os pendentes, imprime um por vez e marca. Sem internet, imprime o que o balcão manda
// pela rede local e registra depois (ARQUITETURA, Impressão).
import type { Impressora, TipoImpressao, TrabalhoImpressao } from '@mel/dominio';

export type EstadoImpressao = 'imprimindo' | 'impresso' | 'erro';

export interface TrabalhoLocal extends TrabalhoImpressao {
  noiteId?: string;
  caixaId?: string;
  pedidoId?: string;
}

/** O que o processador precisa da fila no banco (FilaSupabase; nos testes, uma fila falsa). */
export interface Fila {
  pendentes(): Promise<TrabalhoImpressao[]>;
  marcar(id: string, estado: EstadoImpressao, erro?: string): Promise<void>;
  registrarLocal(trabalho: TrabalhoLocal): Promise<void>;
}

export interface Registro {
  info(mensagem: string): void;
  erro(mensagem: string): void;
}

export const TIPOS: readonly TipoImpressao[] = ['comanda', 'recibo_acerto', 'folha_noite'];

export class Processador {
  private rodando: Promise<void> | null = null;
  private outraVez = false;
  /** Impressos pela rede local: se o pedido da fila chegar depois, não imprime de novo. */
  private readonly impressosAqui = new Set<string>();
  /** Impressos sem internet que ainda não subiram. */
  private readonly aRegistrar: TrabalhoLocal[] = [];

  private readonly fila: Fila;
  private readonly impressora: Impressora;
  private readonly registro: Registro;

  constructor(fila: Fila, impressora: Impressora, registro: Registro) {
    this.fila = fila;
    this.impressora = impressora;
    this.registro = registro;
  }

  /** Esvazia a fila. Chamado pelo Realtime e a cada 10 s; chamadas juntas rodam uma vez só, e de novo no fim. */
  rodar(): Promise<void> {
    if (this.rodando) {
      this.outraVez = true;
      return this.rodando;
    }
    this.rodando = (async () => {
      try {
        do {
          this.outraVez = false;
          await this.subirLocais();
          for (const t of await this.fila.pendentes()) await this.imprimirDaFila(t);
        } while (this.outraVez);
      } catch (erro) {
        this.registro.erro(`fila: ${(erro as Error).message}`);
      } finally {
        this.rodando = null;
      }
    })();
    return this.rodando;
  }

  private async imprimirDaFila(t: TrabalhoImpressao) {
    if (this.impressosAqui.has(t.id)) {
      await this.fila.marcar(t.id, 'impresso');
      return;
    }
    await this.fila.marcar(t.id, 'imprimindo');
    const r = await this.impressora.imprimir(t);
    if (r.ok) {
      this.impressosAqui.add(t.id);
      await this.fila.marcar(t.id, 'impresso');
      this.registro.info(`impresso ${t.tipo} ${t.id}`);
    } else {
      await this.fila.marcar(t.id, 'erro', r.erro.mensagem);
      this.registro.erro(`${t.tipo} ${t.id}: ${r.erro.mensagem}`);
    }
  }

  /** Impressão pela rede local (sem internet). Repetida com o mesmo id não imprime de novo. */
  async imprimirLocal(t: TrabalhoLocal): Promise<{ ok: boolean; repetida?: boolean; erro?: string }> {
    if (this.impressosAqui.has(t.id)) return { ok: true, repetida: true };
    const r = await this.impressora.imprimir(t);
    if (!r.ok) return { ok: false, erro: r.erro.mensagem };
    this.impressosAqui.add(t.id);
    this.aRegistrar.push(t);
    void this.subirLocais();
    return { ok: true };
  }

  private async subirLocais() {
    while (this.aRegistrar.length > 0) {
      const t = this.aRegistrar[0];
      if (!t) break;
      try {
        await this.fila.registrarLocal(t);
        this.aRegistrar.shift();
      } catch {
        // Sem internet: tenta de novo na próxima rodada.
        return;
      }
    }
  }
}
