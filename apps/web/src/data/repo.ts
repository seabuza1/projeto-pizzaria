// Única porta de dados das telas (CLAUDE.md, Dados). Esconde o IndexedDB, a fila e o Supabase.
// As telas leem com os hooks daqui e escrevem com `acoes`; as contas vêm de @mel/dominio.
import { type DadosDe, entradaDoCaixa, type PagamentoLancadoDb, type TipoOperacao } from '@mel/db';
import {
  type ContaAcerto,
  calcularAcerto,
  type Forma,
  type NoiteDoHistorico,
  type PagamentoAcerto,
  pagamentosDaSaida,
} from '@mel/dominio';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { mostrarAviso } from './avisos';
import {
  type Acerto,
  BancoLocal,
  type Caixa,
  type Pagamento,
  type Pedido,
  type Perfil,
  type Saida,
} from './banco-local';
import { Motor } from './motor';
import { supabase } from './supabase';

export type { Acerto, Area, Caixa, Config, Impressao, Noite, Pagamento, Pedido, Perfil, Saida } from './banco-local';

const banco = new BancoLocal();

function idDoAparelho(): string {
  try {
    const salvo = localStorage.getItem('mel-aparelho');
    if (salvo) return salvo;
    const novo = `web-${uuidv7().slice(-12)}`;
    localStorage.setItem('mel-aparelho', novo);
    return novo;
  } catch {
    return 'web';
  }
}

export const VERSAO = import.meta.env.VITE_VERSAO ?? 'dev';

/** Registro de erros sem dados de cliente (tabela erros). Offline, guarda e manda depois. */
export async function registrarErro(erro: unknown, contexto: string) {
  const e = erro as { message?: string; stack?: string } | null;
  const item = {
    origem: 'web',
    mensagem: `${contexto}: ${e?.message ?? String(erro)}`.slice(0, 1000),
    pilha: e?.stack?.slice(0, 8000) ?? null,
    contexto: { rota: typeof location !== 'undefined' ? location.pathname : '' },
    versao: VERSAO,
  };
  try {
    const { error } = await supabase.rpc('registrar_erro', { p_erro: item });
    if (error) throw error;
  } catch {
    const guardados = ((await banco.lerMeta<unknown[]>('erros')) ?? []).slice(-19);
    await banco.gravarMeta('erros', [...guardados, item]);
  }
}

async function enviarErrosGuardados() {
  const guardados = (await banco.lerMeta<object[]>('erros')) ?? [];
  if (guardados.length === 0) return;
  await banco.gravarMeta('erros', []);
  for (const item of guardados) await supabase.rpc('registrar_erro', { p_erro: item as never });
}

const motor = new Motor({
  supabase,
  banco,
  aparelho: idDoAparelho(),
  aoRecusar: (motivo) => mostrarAviso(motivo, { tipo: 'erro' }),
  aoErro: (erro, contexto) => void registrarErro(erro, contexto),
});

// Sessão -----------------------------------------------------------------------

export type Sessao =
  | { estado: 'carregando' }
  | { estado: 'fora'; erro?: string }
  | { estado: 'dentro'; perfil: Perfil };

let sessao: Sessao = { estado: 'carregando' };
const ouvintesSessao = new Set<() => void>();
function mudarSessao(nova: Sessao) {
  sessao = nova;
  for (const o of ouvintesSessao) o();
}

export function useSessao(): Sessao {
  return useSyncExternalStore(
    (f) => {
      ouvintesSessao.add(f);
      return () => ouvintesSessao.delete(f);
    },
    () => sessao,
  );
}

async function carregarPerfil(usuarioId: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfis').select('*').eq('id', usuarioId).maybeSingle();
  if (!error && data) {
    await banco.gravarMeta('perfil', data);
    return data;
  }
  // Sem internet: o perfil guardado no aparelho.
  const guardado = await banco.lerMeta<Perfil>('perfil');
  return guardado?.id === usuarioId ? guardado : null;
}

async function comecar(usuarioId: string) {
  const perfil = await carregarPerfil(usuarioId);
  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    mudarSessao({ estado: 'fora', erro: 'Conta sem acesso. Fale com o admin.' });
    return;
  }
  mudarSessao({ estado: 'dentro', perfil });
  await motor.iniciar(usuarioId);
  void enviarErrosGuardados();
}

/** Na abertura do app: usa a sessão guardada (funciona sem internet). */
export async function iniciarSessao() {
  const { data } = await supabase.auth.getSession();
  const usuario = data.session?.user;
  if (usuario) await comecar(usuario.id);
  else mudarSessao({ estado: 'fora' });
}

export async function entrar(email: string, senha: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error || !data.user) {
    return /Invalid login/i.test(error?.message ?? '') ? 'E-mail ou senha errados.' : 'Sem conexão. Tente de novo.';
  }
  await comecar(data.user.id);
  return null;
}

/** Sai e apaga os dados do aparelho. Com alterações na fila, só sai se `forcar`. */
export async function sair(forcar = false): Promise<'ok' | 'pendente'> {
  if (!forcar && (await banco.fila.count()) > 0) return 'pendente';
  await motor.parar();
  await supabase.auth.signOut().catch(() => undefined);
  await Promise.all([...banco.tabelasDeDados, banco.fila, banco.recusas, banco.meta].map((t) => t.clear()));
  mudarSessao({ estado: 'fora' });
  return 'ok';
}

export const sincronizar = () => motor.enviar().then(() => motor.baixar());

// Leitura ----------------------------------------------------------------------

export const usePendentes = () => useLiveQuery(() => banco.fila.count(), [], 0);
export const useUltimaSinc = () => useLiveQuery(() => banco.lerMeta<string>('ultima_sinc'), []);
export const useConfig = () => useLiveQuery(() => banco.config.toCollection().first(), []);
export const usePerfis = () => useLiveQuery(() => banco.perfis.toArray(), [], []);

export function useAreas(todas = false) {
  return useLiveQuery(
    async () => (await banco.areas.toArray()).filter((a) => todas || a.ativa).sort((a, b) => a.ordem - b.ordem),
    [todas],
    [],
  );
}

/** A noite aberta mais recente (ou a última, se todas fecharam). */
export function useNoite() {
  return useLiveQuery(async () => {
    const noites = (await banco.noites.toArray()).sort((a, b) => b.data.localeCompare(a.data));
    return noites.find((n) => !n.fechada_em) ?? noites[0] ?? null;
  }, []);
}

export interface DadosNoite {
  caixas: Caixa[];
  pedidos: Pedido[];
  saidas: Saida[];
  pagamentos: Pagamento[];
  acertos: Acerto[];
}

export function useDadosNoite(noiteId: string | undefined): DadosNoite | undefined {
  return useLiveQuery(async () => {
    if (!noiteId) return { caixas: [], pedidos: [], saidas: [], pagamentos: [], acertos: [] };
    const [caixas, pedidos, saidas, pagamentos, acertos] = await Promise.all([
      banco.caixas.where('noite_id').equals(noiteId).toArray(),
      banco.pedidos.where('noite_id').equals(noiteId).toArray(),
      banco.saidas.where('noite_id').equals(noiteId).toArray(),
      banco.pagamentos.where('noite_id').equals(noiteId).toArray(),
      banco.acertos.where('noite_id').equals(noiteId).toArray(),
    ]);
    return {
      caixas: caixas.sort((a, b) => a.ordem_chegada - b.ordem_chegada),
      pedidos,
      saidas: saidas.sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
      pagamentos,
      acertos: acertos.filter((a) => !a.reaberto_em),
    };
  }, [noiteId]);
}

export const useImpressoes = (noiteId: string | undefined) =>
  useLiveQuery(
    async () =>
      noiteId
        ? (await banco.impressoes.where('noite_id').equals(noiteId).toArray()).sort((a, b) =>
            b.criado_em.localeCompare(a.criado_em),
          )
        : [],
    [noiteId],
    [],
  );

/** Conta do acerto de um caixa, sempre por @mel/dominio. */
export function contaDoCaixa(caixa: Caixa, dados: DadosNoite): ContaAcerto {
  return calcularAcerto(entradaDoCaixa(caixa, dados));
}

/** Pagamentos que valem para uma saída (PAG3: os reais, se houver). */
export function pagamentosVigentes(saida: Saida, pagamentos: readonly Pagamento[]): Pagamento[] {
  const doPedido = pagamentos.filter((p) => p.pedido_id === saida.pedido_id);
  const vigentes = new Set(
    pagamentosDaSaida(
      {
        id: saida.id,
        pedidoId: saida.pedido_id,
        area: saida.area_id,
        taxa: saida.taxa,
        estado: saida.estado,
        papelConferido: saida.papel_conferido,
      },
      doPedido.map(
        (p): PagamentoAcerto => ({
          id: p.id,
          pedidoId: p.pedido_id,
          saidaId: p.saida_id,
          forma: p.forma,
          valor: p.valor,
          trocoPix: p.troco_pix,
          real: p.real,
          criadoEm: p.registrado_em,
        }),
      ),
    ).map((p) => p.id),
  );
  return doPedido.filter((p) => vigentes.has(p.id));
}

// Escrita ----------------------------------------------------------------------

const novoId = () => uuidv7();
const executar = <T extends TipoOperacao>(tipo: T, dados: DadosDe<T>) => motor.executar(tipo, dados);

export interface LinhaPagamento {
  forma: Forma;
  valor: number;
  trocoPix?: number;
}

const paraLinhasDb = (linhas: readonly LinhaPagamento[]): PagamentoLancadoDb[] =>
  linhas.map((l) => ({
    id: novoId(),
    forma: l.forma,
    valor: l.valor,
    ...(l.trocoPix ? { troco_pix: l.trocoPix } : {}),
  }));

export const acoes = {
  async lancar(p: { caixaId: string; codigo: string; total: number; areaId: string; pagamentos: LinhaPagamento[] }) {
    const saidaId = novoId();
    await executar('lancar_saida', {
      caixa_id: p.caixaId,
      pedido_id: novoId(),
      saida_id: saidaId,
      codigo: p.codigo,
      total: p.total,
      area_id: p.areaId,
      pagamentos: paraLinhasDb(p.pagamentos),
    });
    return saidaId;
  },
  cancelarSaida: (saidaId: string) => executar('cancelar_saida', { saida_id: saidaId }),
  mudarEstado: (saidaId: string, estado: 'em_rota' | 'entregue' | 'voltou') =>
    executar('mudar_estado_saida', { saida_id: saidaId, estado }),
  trocarPagamento: (saidaId: string, linhas: LinhaPagamento[]) =>
    executar('trocar_pagamento', { saida_id: saidaId, pagamentos: paraLinhasDb(linhas) }),
  async sairDeNovo(saidaAnteriorId: string, opcoes: { caixaId?: string; areaId?: string } = {}) {
    const saidaId = novoId();
    await executar('sair_de_novo', {
      saida_id: saidaId,
      saida_anterior_id: saidaAnteriorId,
      ...(opcoes.caixaId ? { caixa_id: opcoes.caixaId } : {}),
      ...(opcoes.areaId ? { area_id: opcoes.areaId } : {}),
    });
    return saidaId;
  },
  avisarRetorno: (caixaId: string, minutos: number | null) =>
    executar('avisar_retorno', { caixa_id: caixaId, minutos }),
  async abrirNoite() {
    const noiteId = novoId();
    await executar('abrir_noite', { noite_id: noiteId });
    return noiteId;
  },
  abrirCaixa: (noiteId: string, motoboyId: string) =>
    executar('abrir_caixa', { caixa_id: novoId(), noite_id: noiteId, motoboy_id: motoboyId }),
  editarCaixa: (caixaId: string, valores: { caixa_inicial?: number; diaria?: number }) =>
    executar('editar_caixa', { caixa_id: caixaId, ...valores }),
  conferirPapel: (saidaId: string, conferido: boolean) => executar('conferir_papel', { saida_id: saidaId, conferido }),
  informarContado: (caixaId: string, contado: number | null) =>
    executar('informar_contado', { caixa_id: caixaId, dinheiro_contado: contado }),
  async confirmarAcerto(caixaId: string, conta: ContaAcerto) {
    const l = conta.liquidacao;
    if (!l) throw new Error('Informe o dinheiro contado.');
    const acertoId = novoId();
    await executar('confirmar_acerto', {
      caixa_id: caixaId,
      acerto_id: acertoId,
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
      conta: conta as unknown as Record<string, unknown>,
    });
    return acertoId;
  },
  reabrirAcerto: (caixaId: string) => executar('reabrir_acerto', { caixa_id: caixaId }),
  marcarPix: (pagamentoId: string, confirmado: boolean) =>
    executar('marcar_pix', { pagamento_id: pagamentoId, confirmado }),
  fecharNoite: (noiteId: string) => executar('fechar_noite', { noite_id: noiteId }),
  reabrirNoite: (noiteId: string) => executar('reabrir_noite', { noite_id: noiteId }),
  async pedirImpressao(p: {
    tipo: 'recibo_acerto' | 'folha_noite';
    conteudo: string;
    noiteId?: string;
    caixaId?: string;
    impressa?: boolean;
  }) {
    const impressaoId = novoId();
    await executar('pedir_impressao', {
      impressao_id: impressaoId,
      tipo: p.tipo,
      conteudo: p.conteudo,
      ...(p.noiteId ? { noite_id: p.noiteId } : {}),
      ...(p.caixaId ? { caixa_id: p.caixaId } : {}),
      ...(p.impressa ? { impressa: true } : {}),
    });
    return impressaoId;
  },
  salvarArea: (a: { id?: string; nome: string; cidade: string; taxa: number; ativa: boolean; ordem?: number }) =>
    executar('salvar_area', {
      area_id: a.id ?? novoId(),
      nome: a.nome,
      cidade: a.cidade,
      taxa: a.taxa,
      ativa: a.ativa,
      ...(a.ordem !== undefined ? { ordem: a.ordem } : {}),
    }),
  salvarConfig: (c: DadosDe<'salvar_config'>) => executar('salvar_config', c),
  salvarPerfil: (p: DadosDe<'salvar_perfil'>) => executar('salvar_perfil', p),
};

// Consultas que só existem com internet ---------------------------------------

/** Área do último pedido com o mesmo código: primeiro no aparelho, depois no servidor. */
export async function areaSugerida(codigo: string): Promise<string | null> {
  const locais = (await banco.pedidos.where('codigo').equals(codigo).toArray()).sort((a, b) =>
    b.criado_em.localeCompare(a.criado_em),
  );
  if (locais[0]?.area_id) return locais[0].area_id;
  try {
    const { data } = await supabase.rpc('area_sugerida', { p_codigo: codigo });
    return data ?? null;
  } catch {
    return null;
  }
}

export interface NoiteHistorico extends NoiteDoHistorico {
  caixaId: string;
  confirmadoPor: string | null;
  confirmadoEm: string | null;
}

/** Histórico do motoboy: noites dele com o acerto congelado. Guardado para ver offline. */
export async function carregarHistorico(motoboyId: string): Promise<NoiteHistorico[]> {
  const { data, error } = await supabase
    .from('caixas')
    .select('id, diaria, noites(data), acertos(conta, reaberto_em, confirmado_por, confirmado_em)')
    .eq('motoboy_id', motoboyId);
  if (error || !data) return (await banco.lerMeta<NoiteHistorico[]>(`historico-${motoboyId}`)) ?? [];
  const itens: NoiteHistorico[] = data.flatMap((c) => {
    const data = c.noites?.data;
    if (!data) return [];
    const acerto = c.acertos.find((a) => !a.reaberto_em);
    const conta = acerto?.conta as unknown as ContaAcerto | undefined;
    return [
      {
        caixaId: c.id,
        data,
        confirmadoPor: acerto?.confirmado_por ?? null,
        confirmadoEm: acerto?.confirmado_em ?? null,
        conta: conta ?? { diaria: c.diaria, taxas: 0, entregues: 0, voltaram: 0, porArea: {}, liquidacao: null },
      },
    ];
  });
  itens.sort((a, b) => b.data.localeCompare(a.data));
  await banco.gravarMeta(`historico-${motoboyId}`, itens);
  return itens;
}

/** Recusas recentes do servidor, para a tela mostrar o motivo. */
export const useRecusas = () =>
  useLiveQuery(async () => (await banco.recusas.orderBy('em').reverse().limit(5).toArray()) ?? [], [], []);
