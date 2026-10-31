// Apoio dos testes de banco: contas do seed.sql, operações e limpeza entre testes.
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  type DadosDe,
  type Database,
  entradaDoCaixa,
  type RespostaOperacao,
  type TipoOperacao,
  VERSAO_OP,
} from '@mel/db';
import { calcularAcerto } from '@mel/dominio';
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

// Conexão direta só para limpar e conferir. A única escrita é o pedido do balcão (pedidoDoBalcao).
export const sql = postgres(ambiente.dbUrl, { max: 2, onnotice: () => {} });

export const SENHA = 'Mel12345teste';
// Segredo TOTP de teste do seed.sql (admin e gerente entram com MFA).
export const SEGREDO_TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function base32(texto: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...texto].map((ch) => alfabeto.indexOf(ch).toString(2).padStart(5, '0')).join('');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Código do app autenticador (RFC 6238: SHA-1, 30 s, 6 dígitos). */
export function codigoTotp(segredo = SEGREDO_TOTP, agora = Date.now()): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)));
  const h = createHmac('sha1', base32(segredo)).update(contador).digest();
  const o = (h[h.length - 1] ?? 0) & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export const CONTAS = {
  felipe: { id: 'a0000000-0000-4000-8000-000000000001', email: 'felipe@mel.test' },
  luan: { id: 'a0000000-0000-4000-8000-000000000002', email: 'luan@mel.test' },
  dona: { id: 'a0000000-0000-4000-8000-000000000003', email: 'dona@mel.test' },
  agente: { id: 'a0000000-0000-4000-8000-000000000006', email: 'agente@mel.test' },
  atendimento: { id: 'a0000000-0000-4000-8000-000000000008', email: 'atendimento@mel.test' },
} as const;
export type Conta = keyof typeof CONTAS;

/** Cadastro de motoboys do seed.sql: sem login (decisão 0007). */
export const MOTOBOYS = {
  joao: 'a0000000-0000-4000-8000-000000000004',
  pedro: 'a0000000-0000-4000-8000-000000000005',
  felipe: 'a0000000-0000-4000-8000-000000000007',
} as const;
export type Motoboy = keyof typeof MOTOBOYS;

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
  op<T extends TipoOperacao>(
    tipo: T,
    dados: DadosDe<T>,
    opcoes?: { id?: string; criadaEm?: string; versaoOp?: number | null },
  ): Promise<RespostaOperacao>;
  /** Operação que um app antigo ainda pode mandar: o servidor aceita até contrair (PADROES, migrações). */
  opAntiga(
    tipo: string,
    dados: Record<string, unknown>,
    opcoes?: { id?: string; criadaEm?: string; versaoOp?: number | null },
  ): Promise<RespostaOperacao>;
}

/** Entra com e-mail e senha; admin e gerente confirmam o código TOTP, a menos que `semMfa`. */
export async function entrar(conta: Conta, opcoes: { semMfa?: boolean } = {}): Promise<Sessao> {
  const db = clienteAnonimo();
  const { error } = await db.auth.signInWithPassword({ email: CONTAS[conta].email, password: SENHA });
  if (error) throw error;
  if ((conta === 'felipe' || conta === 'dona') && !opcoes.semMfa) {
    const fatores = await db.auth.mfa.listFactors();
    const fator = fatores.data?.totp[0];
    if (!fator) throw new Error(`${conta} sem fator TOTP no seed`);
    const r = await db.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigoTotp() });
    if (r.error) throw r.error;
  }
  const opAntiga: Sessao['opAntiga'] = async (tipo, dados, opcoes) => {
    const operacao = {
      id: opcoes?.id ?? novoId(),
      tipo,
      dados,
      criada_em: opcoes?.criadaEm ?? new Date().toISOString(),
      aparelho: 'teste',
      versao_op: opcoes?.versaoOp === undefined ? VERSAO_OP : opcoes.versaoOp,
    };
    const { data, error: erro } = await db.rpc('aplicar_operacao', { op: operacao as never });
    if (erro) throw erro;
    return data as unknown as RespostaOperacao;
  };
  return {
    conta,
    id: CONTAS[conta].id,
    db,
    op: (tipo, dados, opcoes) => opAntiga(tipo, dados as Record<string, unknown>, opcoes),
    opAntiga,
  };
}

/** Garante que a operação foi aplicada; senão mostra o motivo. */
export function aplicada(r: RespostaOperacao): RespostaOperacao {
  if (r.status !== 'aplicada') throw new Error(`Operação recusada: ${r.motivo}`);
  return r;
}

// O TRUNCATE trava várias tabelas de uma vez e pode cruzar com o Realtime, que lê as mesmas tabelas
// para conferir a RLS dos assinantes. Se o Postgres acusar deadlock, tenta de novo.
export async function limpar(tentativa = 1): Promise<void> {
  try {
    await sql`
      truncate public.cardapio_acabou, public.cardapio_faixas, public.cardapio_sabores, public.cardapio_bordas,
        public.cardapio_adicionais, public.cardapio_bebidas, public.cardapio_combos, public.clientes, public.pedido_itens,
        public.eventos, public.operacoes, public.impressoes, public.sobras, public.faltas, public.acertos,
        public.pagamentos, public.saidas, public.pedidos, public.caixas, public.noites, public.erros cascade`;
    // O cardápio volta ao do JSON (o mesmo seed do supabase db reset).
    await sql.file(fileURLToPath(new URL('../seeds/cardapio.sql', import.meta.url)));
    await sql`update public.areas set taxa = case nome
      when 'Aragarças' then 500 when 'Barra' then 1200 when 'Pontal' then 1000 when 'Parque de Exposições' then 1500
      else taxa end`;
  } catch (erro) {
    if ((erro as { code?: string }).code === '40P01' && tentativa < 5) return limpar(tentativa + 1);
    throw erro;
  }
}

export async function areas(): Promise<Record<string, string>> {
  const linhas = await sql<{ id: string; nome: string }[]>`select id, nome from public.areas`;
  return Object.fromEntries(linhas.map((a) => [a.nome, a.id]));
}

/** Abre a noite (Luan) e os caixas dos motoboys pedidos, na ordem de chegada. */
export async function abrirNoite(luan: Sessao, motoboys: Motoboy[]) {
  const noiteId = novoId();
  aplicada(await luan.op('abrir_noite', { noite_id: noiteId }));
  const caixas: Record<string, string> = {};
  for (const m of motoboys) {
    const caixaId = novoId();
    aplicada(await luan.op('abrir_caixa', { caixa_id: caixaId, noite_id: noiteId, motoboy_id: MOTOBOYS[m] }));
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

export async function versaoDoPedido(pedidoId: string): Promise<number> {
  const [linha] = await sql<{ versao: number }[]>`select versao from public.pedidos where id = ${pedidoId}`;
  return linha?.versao ?? -1;
}

export async function versaoDoCaixa(caixaId: string): Promise<number> {
  const [linha] = await sql<{ versao: number }[]>`select versao from public.caixas where id = ${caixaId}`;
  return linha?.versao ?? -1;
}

export async function pedidoDaSaida(saidaId: string): Promise<string> {
  const [linha] = await sql<{ pedido_id: string }[]>`select pedido_id from public.saidas where id = ${saidaId}`;
  return linha?.pedido_id ?? '';
}

/**
 * Pedido do balcão, já autorizado, com os pagamentos previstos na comanda (PAG3).
 * Até a tela de pedido existir (F2, etapa 7 do MVP), ele nasce direto no banco.
 */
export async function pedidoDoBalcao(
  noiteId: string,
  codigo: string,
  totalReais: number,
  areaId: string,
  pagamentos: ReturnType<typeof pg>[],
): Promise<string> {
  const pedidoId = novoId();
  await sql`insert into public.pedidos (id, noite_id, codigo, origem, tipo, area_id, total, estado)
    values (${pedidoId}, ${noiteId}, ${codigo}, 'whatsapp', 'entrega', ${areaId}, ${Math.round(totalReais * 100)},
      'em_producao')`;
  for (const p of pagamentos) {
    await sql`insert into public.pagamentos (id, noite_id, pedido_id, forma, valor, troco_pix)
      values (${p.id}, ${noiteId}, ${pedidoId}, ${p.forma}, ${p.valor}, ${p.troco_pix ?? 0})`;
  }
  return pedidoId;
}

/** Confirma o acerto com a conta do domínio (ACE9). O dinheiro contado já tem de estar informado. */
export async function confirmarAcerto(quem: Sessao, caixaId: string) {
  const [caixa] =
    await sql`select id, caixa_inicial, diaria, dinheiro_contado from public.caixas where id = ${caixaId}`;
  const linhas = {
    pedidos: await sql`select id, codigo from public.pedidos`,
    saidas: await sql`select * from public.saidas`,
    pagamentos: await sql`select * from public.pagamentos`,
  };
  // biome-ignore lint/suspicious/noExplicitAny: linhas cruas do postgres
  const conta = calcularAcerto(entradaDoCaixa(caixa as any, linhas as any));
  const l = conta.liquidacao;
  if (!l) throw new Error('sem dinheiro contado');
  return quem.op('confirmar_acerto', {
    caixa_id: caixaId,
    acerto_id: novoId(),
    versao_esperada: await versaoDoCaixa(caixaId),
    esperado: {
      devolver: conta.devolver,
      maquininha: conta.maquininha,
      receber: conta.receber,
      dinheiroContado: l.dinheiroContado,
      pagar: l.pagar,
      doCaixaDele: l.doCaixaDele,
      retiradoCaixaEmpresa: l.retiradoCaixaEmpresa,
      vaiParaEmpresa: l.vaiParaEmpresa,
    },
    conta: { porArea: conta.porArea },
  });
}
