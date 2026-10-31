// A fila de impressão no Supabase, com a conta de papel `agente` (nunca a service role).
// As mudanças passam por aplicar_operacao, como as do app.
import { randomUUID } from 'node:crypto';
import type { TipoImpressao, TrabalhoImpressao } from '@mel/dominio';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoImpressao, Fila, TrabalhoLocal } from './processador.ts';

/** Igual a VERSAO_OP de packages/db (um teste confere). */
export const VERSAO_OP_AGENTE = 1;

export class FilaSupabase implements Fila {
  private readonly db: SupabaseClient;
  private readonly impressora: string;

  constructor(db: SupabaseClient, impressora: string) {
    this.db = db;
    this.impressora = impressora;
  }

  async pendentes(): Promise<TrabalhoImpressao[]> {
    const { data, error } = await this.db
      .from('impressoes')
      .select('id, tipo, conteudo')
      .eq('estado', 'pendente')
      .eq('impressora', this.impressora)
      .order('criado_em')
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((t) => ({
      id: t.id as string,
      tipo: t.tipo as TipoImpressao,
      conteudo: t.conteudo as string,
    }));
  }

  marcar(id: string, estado: EstadoImpressao, erro?: string): Promise<void> {
    return this.operacao('atualizar_impressao', { impressao_id: id, estado, ...(erro ? { erro } : {}) });
  }

  registrarLocal(t: TrabalhoLocal): Promise<void> {
    return this.operacao('registrar_impressao_local', {
      impressao_id: t.id,
      tipo: t.tipo,
      conteudo: t.conteudo,
      ...(t.noiteId ? { noite_id: t.noiteId } : {}),
      ...(t.caixaId ? { caixa_id: t.caixaId } : {}),
      ...(t.pedidoId ? { pedido_id: t.pedidoId } : {}),
    });
  }

  private async operacao(tipo: string, dados: Record<string, unknown>) {
    const op = {
      id: randomUUID(),
      tipo,
      dados,
      criada_em: new Date().toISOString(),
      versao_op: VERSAO_OP_AGENTE,
      aparelho: 'agente',
    };
    const { data, error } = await this.db.rpc('aplicar_operacao', { op });
    if (error) throw error;
    const r = data as { status: string; motivo: string | null };
    if (r.status !== 'aplicada') throw new Error(r.motivo ?? 'Operação recusada.');
  }
}
