// Motor de dados: fila de operações, envio para aplicar_operacao, download da noite e tempo real.
// Não depende do React; repo.ts expõe isto para as telas.
import {
  type DadosDe,
  type Database,
  type RespostaOperacao,
  type TipoOperacao,
  VERSAO_OP,
  validarDados,
} from '@mel/db';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { v7 as uuidv7 } from 'uuid';
import { aplicarLocal } from './aplicar-local';
import type { BancoLocal } from './banco-local';

export interface OpcoesMotor {
  supabase: SupabaseClient<Database>;
  banco: BancoLocal;
  aparelho: string;
  /** Avisa a tela quando uma operação é recusada pelo servidor. */
  aoRecusar?: (motivo: string) => void;
  /** A fila parou até a pessoa agir: atualizar o app ou confirmar o código do autenticador. */
  aoBloquear?: (bloqueio: Bloqueio) => void;
  aoErro?: (erro: unknown, contexto: string) => void;
}

const TABELAS_DA_NOITE = ['caixas', 'pedidos', 'saidas', 'pagamentos', 'acertos', 'impressoes'] as const;
const TABELAS_GERAIS = ['noites', 'areas', 'config', 'perfis', 'motoboys'] as const;
const MAX_TENTATIVAS = 5;

export type Bloqueio = { tipo: 'atualizar' | 'mfa'; mensagem: string };

// MEL02: app antigo demais; MEL03: falta o código do autenticador. A operação fica na fila.
function bloqueioDe(erro: unknown): Bloqueio | null {
  const e = erro as { code?: string; message?: string } | null;
  if (e?.code === 'MEL02') return { tipo: 'atualizar', mensagem: e.message ?? 'Atualize o app.' };
  if (e?.code === 'MEL03') return { tipo: 'mfa', mensagem: e.message ?? 'Confirme o código do app autenticador.' };
  return null;
}

function ehFalhaDeRede(erro: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const e = erro as { message?: string; code?: string; status?: number } | null;
  const msg = `${e?.message ?? erro}`;
  return /fetch|network|Failed to|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Load failed|timeout/i.test(msg) && !e?.code;
}

// Sessão vencida ou serviço fora: tenta de novo depois, sem gastar tentativas.
function ehTransitorio(erro: unknown): boolean {
  const e = erro as { code?: string; status?: number } | null;
  return Boolean(e?.code?.startsWith('PGRST3') || e?.code === '28000' || (e?.status && e.status >= 500));
}

export class Motor {
  private trava: Promise<unknown> = Promise.resolve();
  private canal: RealtimeChannel | undefined;
  /** Noite que o canal do Realtime escuta (null: só as tabelas gerais). */
  private noiteDoCanal: string | null | undefined;
  private agendado: ReturnType<typeof setTimeout> | undefined;
  private relogio: ReturnType<typeof setInterval> | undefined;
  private realtimeOk = false;
  private ultimaBaixa = 0;
  usuarioId: string | undefined;

  constructor(private readonly o: OpcoesMotor) {}

  get banco() {
    return this.o.banco;
  }

  /** Uma coisa por vez: enviar a fila e baixar a noite não se cruzam. */
  private comTrava<T>(f: () => Promise<T>): Promise<T> {
    const proxima = this.trava.then(f, f);
    this.trava = proxima.catch(() => undefined);
    return proxima;
  }

  /** Aplica no aparelho, põe na fila e tenta enviar. Devolve o id da operação. */
  async executar<T extends TipoOperacao>(tipo: T, dados: DadosDe<T>): Promise<string> {
    const usuarioId = this.usuarioId;
    if (!usuarioId) throw new Error('Faça login de novo.');
    const op = {
      id: uuidv7(),
      tipo,
      dados: validarDados(tipo, dados),
      criada_em: new Date().toISOString(),
      aparelho: this.o.aparelho,
      versao_op: VERSAO_OP,
    };
    const { banco } = this.o;
    await this.comTrava(() =>
      banco.transaction('rw', [...banco.tabelasDeDados, banco.fila], async () => {
        const ultima = await banco.fila.orderBy('seq').last();
        await aplicarLocal(banco, op, { usuarioId });
        await banco.fila.add({ ...op, seq: (ultima?.seq ?? 0) + 1, tentativas: 0 });
      }),
    );
    void this.enviar();
    return op.id;
  }

  enviar(): Promise<void> {
    return this.comTrava(() => this.enviarAgora());
  }

  baixar(): Promise<boolean> {
    return this.comTrava(() => this.baixarAgora());
  }

  private async enviarAgora() {
    const { banco, supabase } = this.o;
    let recusou = false;
    let enviou = false;
    for (;;) {
      const op = await banco.fila.orderBy('seq').first();
      if (!op) break;
      const { seq: _seq, tentativas, erro: _erro, ...envio } = op;
      let resposta: RespostaOperacao;
      try {
        const { data, error } = await supabase.rpc('aplicar_operacao', { op: envio as never });
        if (error) throw error;
        resposta = data as unknown as RespostaOperacao;
      } catch (erro) {
        const bloqueio = bloqueioDe(erro);
        if (bloqueio) {
          this.o.aoBloquear?.(bloqueio);
          break;
        }
        if (ehFalhaDeRede(erro) || ehTransitorio(erro)) break;
        this.o.aoErro?.(erro, `enviar ${op.tipo}`);
        if (tentativas + 1 < MAX_TENTATIVAS) {
          await banco.fila.update(op.id, {
            tentativas: tentativas + 1,
            erro: String((erro as Error)?.message ?? erro),
          });
          break;
        }
        resposta = {
          id: op.id,
          status: 'recusada',
          motivo: 'Não foi possível salvar. Fale com o admin.',
          codigo: 'erro_inesperado',
          resultado: null,
        };
      }
      await banco.fila.delete(op.id);
      enviou = true;
      if (resposta.status === 'recusada') {
        recusou = true;
        const motivo = resposta.motivo ?? 'Operação recusada.';
        await banco.recusas.put({
          id: op.id,
          tipo: op.tipo,
          motivo,
          codigo: resposta.codigo ?? 'recusada',
          em: new Date().toISOString(),
        });
        this.o.aoRecusar?.(motivo);
      }
    }
    // Recusada: o aparelho desfaz o efeito local baixando a verdade do servidor.
    // Noite nova aberta neste aparelho: baixa para o Realtime passar a escutar a noite certa.
    if (recusou || (enviou && (await this.noiteLocal()) !== this.noiteDoCanal)) await this.baixarAgora();
  }

  private async noiteLocal(): Promise<string | null> {
    const noites = (await this.o.banco.noites.toArray()).sort((a, b) => b.data.localeCompare(a.data));
    return (noites.find((n) => !n.fechada_em) ?? noites[0])?.id ?? null;
  }

  private async baixarAgora(): Promise<boolean> {
    const { banco, supabase } = this.o;
    try {
      const [config, areas, perfis, motoboys, noites] = await Promise.all([
        supabase.from('config').select('*'),
        supabase.from('areas').select('*').order('ordem'),
        supabase.from('perfis').select('*'),
        supabase.from('motoboys').select('*').order('nome'),
        supabase.from('noites').select('*').order('data', { ascending: false }).limit(3),
      ]);
      for (const r of [config, areas, perfis, motoboys, noites]) if (r.error) throw r.error;
      const noite = noites.data?.find((n) => !n.fechada_em) ?? noites.data?.[0];
      const vazio = { data: [], error: null };
      const daNoite = noite
        ? await Promise.all([
            supabase.from('caixas').select('*').eq('noite_id', noite.id),
            supabase.from('pedidos').select('*').eq('noite_id', noite.id),
            supabase.from('saidas').select('*').eq('noite_id', noite.id),
            supabase.from('pagamentos').select('*').eq('noite_id', noite.id),
            supabase.from('acertos').select('*').eq('noite_id', noite.id),
            supabase.from('impressoes').select('*').eq('noite_id', noite.id).order('criado_em', { ascending: false }),
          ])
        : [vazio, vazio, vazio, vazio, vazio, vazio];
      for (const r of daNoite) if (r.error) throw r.error;
      const [caixas, pedidos, saidas, pagamentos, acertos, impressoes] = daNoite;

      const usuarioId = this.usuarioId ?? '';
      await banco.transaction('rw', [...banco.tabelasDeDados, banco.fila], async () => {
        for (const t of banco.tabelasDeDados) await t.clear();
        await banco.config.bulkPut(config.data ?? []);
        await banco.areas.bulkPut(areas.data ?? []);
        await banco.perfis.bulkPut(perfis.data ?? []);
        await banco.motoboys.bulkPut(motoboys.data ?? []);
        await banco.noites.bulkPut(noites.data ?? []);
        await banco.caixas.bulkPut((caixas.data ?? []) as never[]);
        await banco.pedidos.bulkPut((pedidos.data ?? []) as never[]);
        await banco.saidas.bulkPut((saidas.data ?? []) as never[]);
        await banco.pagamentos.bulkPut((pagamentos.data ?? []) as never[]);
        await banco.acertos.bulkPut((acertos.data ?? []) as never[]);
        await banco.impressoes.bulkPut((impressoes.data ?? []) as never[]);
        // O que ainda não subiu continua valendo na tela.
        for (const op of await banco.fila.orderBy('seq').toArray()) await aplicarLocal(banco, op, { usuarioId });
      });
      this.ultimaBaixa = Date.now();
      await banco.gravarMeta('ultima_sinc', new Date().toISOString());
      this.assinar(noite?.id ?? null);
      return true;
    } catch (erro) {
      if (!ehFalhaDeRede(erro) && !ehTransitorio(erro)) this.o.aoErro?.(erro, 'baixar noite');
      return false;
    }
  }

  private agendarBaixa() {
    clearTimeout(this.agendado);
    this.agendado = setTimeout(() => void this.baixar(), 400);
  }

  /** Escuta desde o login: as tabelas gerais sempre; as da noite quando há uma. Nada de dinheiro é apagado (OPE3). */
  private assinar(noiteId: string | null) {
    if (this.noiteDoCanal === noiteId && this.canal) return;
    void this.canal?.unsubscribe();
    const canal = this.o.supabase.channel(`noite-${noiteId ?? 'geral'}`);
    for (const table of noiteId ? TABELAS_DA_NOITE : []) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table, filter: `noite_id=eq.${noiteId}` }, () =>
        this.agendarBaixa(),
      );
    }
    for (const table of TABELAS_GERAIS) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.agendarBaixa());
    }
    canal.subscribe((status) => {
      this.realtimeOk = status === 'SUBSCRIBED';
      // Canal caiu (Realtime reiniciando, rede): solta e deixa o relógio recriar e baixar de novo.
      // Só o canal atual: remover dispara CLOSED de novo, e o canal antigo já foi trocado.
      const caiu = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
      if (caiu && this.canal === canal) {
        this.canal = undefined;
        this.noiteDoCanal = undefined;
        void this.o.supabase.removeChannel(canal);
      }
    });
    this.canal = canal;
    this.noiteDoCanal = noiteId;
  }

  private aoVoltarInternet = () => {
    void this.enviar().then(() => this.baixar());
  };

  private aoVoltarParaTela = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') void this.baixar();
  };

  /** Depois do login: baixa a noite, sobe a fila e fica ouvindo. */
  async iniciar(usuarioId: string) {
    this.usuarioId = usuarioId;
    await this.enviar();
    await this.baixar();
    clearInterval(this.relogio);
    // Sem Realtime, baixa de novo a cada 10 s; com Realtime, a cada minuto (ARQUITETURA, Funcionar sem internet).
    this.relogio = setInterval(() => {
      void this.enviar();
      if (!this.realtimeOk || Date.now() - this.ultimaBaixa > 60_000) void this.baixar();
    }, 10_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.aoVoltarInternet);
      document.addEventListener('visibilitychange', this.aoVoltarParaTela);
    }
  }

  async parar() {
    clearInterval(this.relogio);
    clearTimeout(this.agendado);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.aoVoltarInternet);
      document.removeEventListener('visibilitychange', this.aoVoltarParaTela);
    }
    await this.canal?.unsubscribe();
    this.canal = undefined;
    this.noiteDoCanal = undefined;
    this.usuarioId = undefined;
  }
}
