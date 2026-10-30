// Apoio dos testes de banco: contas do seed.sql, operações e limpeza entre testes.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { DadosDe, Database, RespostaOperacao, TipoOperacao } from '@mel/db';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';

interface Ambiente {
  url: string;
  anonKey: string;
  dbUrl: string;
}

// No CI vem das variáveis; na máquina, do `supabase status` (chaves locais de demonstração).
function carregarAmbiente(): Ambiente {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DB_URL } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_DB_URL) {
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, dbUrl: SUPABASE_DB_URL };
  }
  const raiz = fileURLToPath(new URL('../..', import.meta.url));
  const status = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { cwd: raiz, encoding: 'utf8' }),
  ) as Record<string, string>;
  const url = status.API_URL;
  const anonKey = status.ANON_KEY;
  const dbUrl = status.DB_URL;
  if (!url || !anonKey || !dbUrl) throw new Error('Supabase local não está rodando (supabase start).');
  return { url, anonKey, dbUrl };
}

export const ambiente = carregarAmbiente();

// Conexão direta só para limpar e conferir. Nunca é usada para escrever dados de teste.
export const sql = postgres(ambiente.dbUrl, { max: 2, onnotice: () => {} });

export const SENHA = 'Mel12345teste';
export const CONTAS = {
  felipe: { id: 'a0000000-0000-4000-8000-000000000001', email: 'felipe@mel.test' },
  luan: { id: 'a0000000-0000-4000-8000-000000000002', email: 'luan@mel.test' },
  dona: { id: 'a0000000-0000-4000-8000-000000000003', email: 'dona@mel.test' },
  joao: { id: 'a0000000-0000-4000-8000-000000000004', email: 'joao@mel.test' },
  pedro: { id: 'a0000000-0000-4000-8000-000000000005', email: 'pedro@mel.test' },
  agente: { id: 'a0000000-0000-4000-8000-000000000006', email: 'agente@mel.test' },
} as const;
export type Conta = keyof typeof CONTAS;

export const novoId = () => randomUUID();

export function clienteAnonimo(): SupabaseClient<Database> {
  return createClient<Database>(ambiente.url, ambiente.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Sessao {
  conta: Conta;
  id: string;
  db: SupabaseClient<Database>;
  op<T extends TipoOperacao>(tipo: T, dados: DadosDe<T>, opcoes?: { id?: string }): Promise<RespostaOperacao>;
}

export async function entrar(conta: Conta): Promise<Sessao> {
  const db = clienteAnonimo();
  const { error } = await db.auth.signInWithPassword({ email: CONTAS[conta].email, password: SENHA });
  if (error) throw error;
  return {
    conta,
    id: CONTAS[conta].id,
    db,
    async op(tipo, dados, opcoes) {
      const operacao = {
        id: opcoes?.id ?? novoId(),
        tipo,
        dados,
        criada_em: new Date().toISOString(),
        aparelho: 'teste',
      };
      const { data, error: erro } = await db.rpc('aplicar_operacao', { op: operacao as never });
      if (erro) throw erro;
      return data as unknown as RespostaOperacao;
    },
  };
}

/** Garante que a operação foi aplicada; senão mostra o motivo. */
export function aplicada(r: RespostaOperacao): RespostaOperacao {
  if (r.status !== 'aplicada') throw new Error(`Operação recusada: ${r.motivo}`);
  return r;
}

export async function limpar() {
  await sql`
    truncate public.eventos, public.operacoes, public.impressoes, public.sobras, public.faltas, public.acertos,
      public.pagamentos, public.saidas, public.pedidos, public.caixas, public.noites, public.erros cascade`;
  await sql`update public.areas set taxa = case nome
    when 'Aragarças' then 500 when 'Barra' then 1200 when 'Pontal' then 1000 when 'Parque de Exposições' then 1500
    else taxa end`;
}

export async function areas(): Promise<Record<string, string>> {
  const linhas = await sql<{ id: string; nome: string }[]>`select id, nome from public.areas`;
  return Object.fromEntries(linhas.map((a) => [a.nome, a.id]));
}

/** Abre a noite (Luan) e os caixas dos motoboys pedidos, na ordem de chegada. */
export async function abrirNoite(luan: Sessao, motoboys: Conta[]) {
  const noiteId = novoId();
  aplicada(await luan.op('abrir_noite', { noite_id: noiteId }));
  const caixas: Record<string, string> = {};
  for (const m of motoboys) {
    const caixaId = novoId();
    aplicada(await luan.op('abrir_caixa', { caixa_id: caixaId, noite_id: noiteId, motoboy_id: CONTAS[m].id }));
    caixas[m] = caixaId;
  }
  return { noiteId, caixas };
}

type Forma = 'dinheiro' | 'cartao' | 'pix_maquininha' | 'pix_antecipado';
export const pg = (forma: Forma, reais: number, trocoReais = 0) => ({
  id: novoId(),
  forma,
  valor: Math.round(reais * 100),
  ...(trocoReais > 0 ? { troco_pix: Math.round(trocoReais * 100) } : {}),
});

export async function lancar(
  quem: Sessao,
  caixaId: string,
  codigo: string,
  totalReais: number,
  areaId: string,
  pagamentos: ReturnType<typeof pg>[],
) {
  const saidaId = novoId();
  const pedidoId = novoId();
  const r = await quem.op('lancar_saida', {
    caixa_id: caixaId,
    pedido_id: pedidoId,
    saida_id: saidaId,
    codigo,
    total: Math.round(totalReais * 100),
    area_id: areaId,
    pagamentos,
  });
  return { r, saidaId, pedidoId };
}
