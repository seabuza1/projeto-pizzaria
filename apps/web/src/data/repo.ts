// Única porta de dados das telas (CLAUDE.md, Dados). Esconde o IndexedDB, a fila e o Supabase.
// As telas leem com os hooks daqui e escrevem com `acoes`; as contas vêm de @mel/dominio.
import {
  cardapioDasLinhas,
  type DadosDe,
  entradaDoCaixa,
  type LinhasCardapio,
  type PagamentoLancadoDb,
  pagamentoParaDominio,
  saidaParaDominio,
  type TipoOperacao,
} from '@mel/db';
import {
  type Cardapio,
  type ContaAcerto,
  calcularAcerto,
  type Forma,
  type ItemPedido,
  type LinhaDoPedido,
  pagamentosDaSaida,
  pendenciasDaNoite,
  prontosParaSair,
} from '@mel/dominio';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { mostrarAviso } from '../compartilhado/avisos';
import {
  type Acerto,
  BancoLocal,
  type Caixa,
  type Noite,
  type Pagamento,
  type Pedido,
  type PedidoItem,
  type Perfil,
  type Saida,
} from './banco-local';
import { type Bloqueio, Motor } from './motor';
import { supabase } from './supabase';

export type {
  Acabou,
  Acerto,
  Adicional,
  Area,
  Bebida,
  Borda,
  Caixa,
  Cliente,
  Combo,
  Config,
  FaixaPreco,
  Impressao,
  Motoboy,
  Noite,
  Pagamento,
  Pedido,
  PedidoItem,
  Perfil,
  Sabor,
  Saida,
} from './banco-local';

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
/** Sobe quando o app deixa de funcionar com o servidor antigo; comparada com config.versao_minima_app. */
export const VERSAO_APP = 1;

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

const aparelho = idDoAparelho();
const motor = new Motor({
  supabase,
  banco,
  aparelho,
  aoRecusar: (motivo) => mostrarAviso(motivo, { tipo: 'erro' }),
  aoBloquear: (b) => mudarBloqueio(b),
  aoErro: (erro, contexto) => void registrarErro(erro, contexto),
});

// Sessão -----------------------------------------------------------------------

export type Sessao =
  | { estado: 'carregando' }
  | { estado: 'fora'; erro?: string }
  // MFA obrigatório para admin e gerente (ARQUITETURA, Segurança).
  | { estado: 'mfa'; fatorId: string; erro?: string }
  | { estado: 'cadastrar_mfa'; fatorId: string; qrCode: string; segredo: string; erro?: string }
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

const precisaMfa = (perfil: Perfil) => perfil.papeis.some((p) => p === 'admin' || p === 'gerente');

/** Admin e gerente: confirma o código do autenticador ou cadastra o primeiro. Devolve true se já está em aal2. */
async function conferirMfa(): Promise<boolean> {
  const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel.data?.currentLevel === 'aal2') return true;
  const fatores = await supabase.auth.mfa.listFactors();
  const verificado = fatores.data?.totp.find((f) => f.status === 'verified');
  if (verificado) {
    mudarSessao({ estado: 'mfa', fatorId: verificado.id });
    return false;
  }
  const novo = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Mel PDV' });
  if (novo.error || !novo.data) {
    mudarSessao({ estado: 'fora', erro: 'Sem conexão para cadastrar o autenticador. Tente de novo.' });
    return false;
  }
  mudarSessao({
    estado: 'cadastrar_mfa',
    fatorId: novo.data.id,
    qrCode: novo.data.totp.qr_code,
    segredo: novo.data.totp.secret,
  });
  return false;
}

/** Código de 6 dígitos do app autenticador. */
export async function confirmarCodigo(codigo: string): Promise<string | null> {
  const atual = sessao;
  if (atual.estado !== 'mfa' && atual.estado !== 'cadastrar_mfa') return null;
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: atual.fatorId, code: codigo.trim() });
  if (error)
    return /invalid|expired/i.test(error.message) ? 'Código errado ou vencido.' : 'Sem conexão. Tente de novo.';
  const { data } = await supabase.auth.getUser();
  mudarBloqueio(null);
  if (data.user) await comecar(data.user.id);
  return null;
}

async function comecar(usuarioId: string) {
  const perfil = await carregarPerfil(usuarioId);
  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    mudarSessao({ estado: 'fora', erro: 'Conta sem acesso. Fale com o admin.' });
    return;
  }
  if (precisaMfa(perfil) && !(await conferirMfa())) return;
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

// Fila parada até a pessoa agir (app antigo ou MFA) ----------------------------

let bloqueio: Bloqueio | null = null;
const ouvintesBloqueio = new Set<() => void>();
function mudarBloqueio(novo: Bloqueio | null) {
  bloqueio = novo;
  for (const o of ouvintesBloqueio) o();
}

export function useBloqueio(): Bloqueio | null {
  return useSyncExternalStore(
    (f) => {
      ouvintesBloqueio.add(f);
      return () => ouvintesBloqueio.delete(f);
    },
    () => bloqueio,
  );
}

/** Robustez: abaixo da versão mínima, o app envia a fila e pede para atualizar. */
export function useAppDesatualizado(): boolean {
  const cfg = useConfig();
  return (cfg?.versao_minima_app ?? 1) > VERSAO_APP;
}

// Leitura ----------------------------------------------------------------------

export const usePendentes = () => useLiveQuery(() => banco.fila.count(), [], 0);
export const useUltimaSinc = () => useLiveQuery(() => banco.lerMeta<string>('ultima_sinc'), []);
export const useConfig = () => useLiveQuery(() => banco.config.toCollection().first(), []);
export const usePerfis = () => useLiveQuery(() => banco.perfis.toArray(), [], []);
/** Cadastro de motoboys (decisão 0007), em ordem alfabética. */
export const useMotoboys = () =>
  useLiveQuery(async () => (await banco.motoboys.toArray()).sort((a, b) => a.nome.localeCompare(b.nome)), [], []);

/** Cardápio como está no banco (com inativos), para a tela da gerente. */
export function useLinhasCardapio(): LinhasCardapio | undefined {
  return useLiveQuery(async () => {
    const [faixas, sabores, bordas, adicionais, bebidas, combos] = await Promise.all([
      banco.cardapio_faixas.toArray(),
      banco.cardapio_sabores.toArray(),
      banco.cardapio_bordas.toArray(),
      banco.cardapio_adicionais.toArray(),
      banco.cardapio_bebidas.toArray(),
      banco.cardapio_combos.toArray(),
    ]);
    const emOrdem = <T extends { ordem: number; nome?: string }>(l: T[]) => l.sort((a, b) => a.ordem - b.ordem);
    return {
      faixas,
      sabores: emOrdem(sabores),
      bordas: emOrdem(bordas),
      adicionais: emOrdem(adicionais),
      bebidas: emOrdem(bebidas),
      combos: emOrdem(combos),
    };
  }, []);
}

/** "Acabou hoje": os itens marcados na noite. */
export const useAcabou = (noiteId: string | undefined) =>
  useLiveQuery(
    async () =>
      new Set(
        noiteId ? (await banco.cardapio_acabou.where('noite_id').equals(noiteId).toArray()).map((a) => a.item_id) : [],
      ),
    [noiteId],
    new Set<string>(),
  );

/** O cardápio de venda da noite: sem inativos nem o que acabou hoje. */
export function useCardapioDeVenda(noiteId: string | undefined): Cardapio | null | undefined {
  const linhas = useLinhasCardapio();
  const acabou = useAcabou(noiteId);
  return linhas && cardapioDeVenda(linhas, acabou);
}

/** Cliente pelo telefone completo (F2, 2a), do aparelho. */
export const useCliente = (telefone: string | null) =>
  useLiveQuery(
    async () => (telefone ? ((await banco.clientes.where('telefone').equals(telefone).first()) ?? null) : null),
    [telefone],
  );

export interface PedidoAnterior {
  pedido: Pedido;
  itens: PedidoItem[];
}

/** Os últimos 5 pedidos do telefone, de qualquer noite (precisa de internet; sem ela, a lista fica vazia). */
export function useUltimosPedidos(telefone: string | null): PedidoAnterior[] {
  const [lista, setLista] = useState<PedidoAnterior[]>([]);
  useEffect(() => {
    setLista([]);
    if (!telefone) return;
    let vale = true;
    void (async () => {
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('*')
        .eq('telefone', telefone)
        .not('autorizado_em', 'is', null)
        .order('criado_em', { ascending: false })
        .limit(5);
      if (!pedidos?.length) return;
      const { data: itens } = await supabase
        .from('pedido_itens')
        .select('*')
        .in(
          'pedido_id',
          pedidos.map((p) => p.id),
        )
        .is('anulado_em', null)
        .order('ordem');
      if (vale) {
        setLista(pedidos.map((pedido) => ({ pedido, itens: (itens ?? []).filter((i) => i.pedido_id === pedido.id) })));
      }
    })();
    return () => {
      vale = false;
    };
  }, [telefone]);
  return lista;
}

/** Este aparelho, para a trava de atendimento. */
export const meuAparelho = () => aparelho;

/** Cardápio de venda (sem inativos nem o que acabou hoje), já no formato de @mel/dominio. */
export function cardapioDeVenda(linhas: LinhasCardapio, acabou: ReadonlySet<string>): Cardapio | null {
  return linhas.faixas.length === 0 ? null : cardapioDasLinhas(linhas, acabou);
}

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
  /** Itens dos pedidos autorizados (a fotografia do preço). */
  itens?: PedidoItem[];
  saidas: Saida[];
  pagamentos: Pagamento[];
  acertos: Acerto[];
}

export function useDadosNoite(noiteId: string | undefined): DadosNoite | undefined {
  return useLiveQuery(async () => {
    if (!noiteId) return { caixas: [], pedidos: [], itens: [], saidas: [], pagamentos: [], acertos: [] };
    const [caixas, pedidos, saidas, pagamentos, acertos, itens] = await Promise.all([
      banco.caixas.where('noite_id').equals(noiteId).toArray(),
      banco.pedidos.where('noite_id').equals(noiteId).toArray(),
      banco.saidas.where('noite_id').equals(noiteId).toArray(),
      banco.pagamentos.where('noite_id').equals(noiteId).toArray(),
      banco.acertos.where('noite_id').equals(noiteId).toArray(),
      banco.pedido_itens.where('noite_id').equals(noiteId).toArray(),
    ]);
    return {
      caixas: caixas.sort((a, b) => a.ordem_chegada - b.ordem_chegada),
      pedidos,
      itens: itens.filter((i) => !i.anulado_em).sort((a, b) => a.ordem - b.ordem),
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
    pagamentosDaSaida(saidaParaDominio(saida), doPedido.map(pagamentoParaDominio)).map((p) => p.id),
  );
  return doPedido.filter((p) => vigentes.has(p.id));
}

// Escrita ----------------------------------------------------------------------

const novoId = () => uuidv7();
/** Item novo do cardápio: o id nasce aqui, no aparelho. */
type SemId<T> = T extends unknown ? Omit<T, 'item_id'> & { item_id?: string } : never;

/** A versão do pedido que a tela mostrou (Conflitos e concorrência). */
async function versaoDoPedidoDa(saidaId: string): Promise<number> {
  const saida = await banco.saidas.get(saidaId);
  return (saida && (await banco.pedidos.get(saida.pedido_id))?.versao) ?? 0;
}
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
  async cancelarSaida(saidaId: string, motivo?: string) {
    return executar('cancelar_saida', {
      saida_id: saidaId,
      versao_esperada: await versaoDoPedidoDa(saidaId),
      ...(motivo ? { motivo } : {}),
    });
  },
  mudarEstado: (saidaId: string, estado: 'em_rota' | 'entregue' | 'voltou') =>
    executar('mudar_estado_saida', { saida_id: saidaId, estado }),
  async trocarPagamento(saidaId: string, linhas: LinhaPagamento[]) {
    return executar('trocar_pagamento', {
      saida_id: saidaId,
      versao_esperada: await versaoDoPedidoDa(saidaId),
      pagamentos: paraLinhasDb(linhas),
    });
  },
  async sairDeNovo(saidaAnteriorId: string, opcoes: { caixaId: string; areaId?: string }) {
    const saidaId = novoId();
    await executar('sair_de_novo', {
      saida_id: saidaId,
      saida_anterior_id: saidaAnteriorId,
      caixa_id: opcoes.caixaId,
      ...(opcoes.areaId ? { area_id: opcoes.areaId } : {}),
    });
    return saidaId;
  },
  async abrirNoite() {
    const noiteId = novoId();
    await executar('abrir_noite', { noite_id: noiteId });
    return noiteId;
  },
  /** Despacho (F1): uma saída para cada pedido, com o motoboy do caixa. Devolve as saídas, para o "Desfazer". */
  async despachar(caixaId: string, pedidoIds: readonly string[]) {
    const saidas = pedidoIds.map((pedido_id) => ({ pedido_id, saida_id: novoId() }));
    await executar('despachar', { caixa_id: caixaId, saidas });
    return saidas.map((s) => s.saida_id);
  },
  mudarOrdem: (caixaId: string, ordem: number) => executar('mudar_ordem_caixa', { caixa_id: caixaId, ordem }),
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
      // Conflitos e concorrência: se alguém mexeu no caixa depois, o servidor recusa.
      versao_esperada: (await banco.caixas.get(caixaId))?.versao ?? 0,
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
  reabrirAcerto: (caixaId: string, motivo: string) => executar('reabrir_acerto', { caixa_id: caixaId, motivo }),
  /** Desmarcar o "caiu" pede o motivo (OPE3). */
  marcarPix: (pagamentoId: string, confirmado: boolean, motivo?: string) =>
    executar('marcar_pix', { pagamento_id: pagamentoId, confirmado, ...(motivo ? { motivo } : {}) }),
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
  salvarPrecoFaixa: (p: DadosDe<'salvar_preco_faixa'>) => executar('salvar_preco_faixa', p),
  salvarItemCardapio: (item: SemId<DadosDe<'salvar_item_cardapio'>>) =>
    executar('salvar_item_cardapio', { ...item, item_id: item.item_id ?? novoId() } as DadosDe<'salvar_item_cardapio'>),
  marcarAcabou: (p: DadosDe<'marcar_acabou'>) => executar('marcar_acabou', p),
  /** PED4: 0 = sem promoção. */
  definirPromocao: (noiteId: string, desconto: number) => executar('definir_promocao', { noite_id: noiteId, desconto }),
  /** F2, 2b: rascunho, aguardando cliente ou autorizar. Devolve o id do pedido. */
  async salvarPedido(
    p: Omit<DadosDe<'salvar_pedido'>, 'aparelho' | 'pedido_id' | 'versao_esperada' | 'itens' | 'pagamentos'> & {
      pedido_id?: string;
      itens: readonly { item: ItemPedido; linha: LinhaDoPedido }[];
      pagamentos: readonly LinhaPagamento[];
    },
  ) {
    const pedidoId = p.pedido_id ?? novoId();
    const atual = await banco.pedidos.get(pedidoId);
    await executar('salvar_pedido', {
      ...p,
      pedido_id: pedidoId,
      // Sem noite aberta, o primeiro pedido abre uma (o servidor usa a de hoje, se já houver).
      noite_id: p.noite_id ?? atual?.noite_id ?? novoId(),
      // A fotografia de cada linha, calculada por @mel/dominio (preco.ts).
      itens: p.itens.map(({ item, linha }) => ({
        item: item as unknown as Record<string, unknown>,
        nome: linha.nome,
        detalhes: linha.detalhes,
        faixa_cobrada: linha.faixaCobrada,
        unitario: linha.unitario,
        desconto: linha.desconto,
        quantidade: linha.quantidade,
        total: linha.total,
      })),
      pagamentos: paraLinhasDb(p.pagamentos),
      aparelho,
      // Alterar depois de autorizado confere a versão (Conflitos e concorrência).
      ...(atual?.estado === 'em_producao' ? { versao_esperada: atual.versao } : {}),
    });
    return pedidoId;
  },
  assumirPedido: (pedidoId: string) => executar('assumir_pedido', { pedido_id: pedidoId, aparelho }),
  async cancelarPedido(pedidoId: string, motivo: string) {
    return executar('cancelar_pedido', {
      pedido_id: pedidoId,
      motivo,
      versao_esperada: (await banco.pedidos.get(pedidoId))?.versao ?? 0,
    });
  },
  async marcarRetirado(pedidoId: string, linhas?: LinhaPagamento[]) {
    return executar('marcar_retirado', {
      pedido_id: pedidoId,
      versao_esperada: (await banco.pedidos.get(pedidoId))?.versao ?? 0,
      ...(linhas?.length ? { pagamentos: paraLinhasDb(linhas) } : {}),
    });
  },
  salvarCliente: (c: Omit<DadosDe<'salvar_cliente'>, 'cliente_id'>) =>
    executar('salvar_cliente', { ...c, cliente_id: novoId() }),
  salvarMotoboy: (m: { id?: string; nome: string; ativo: boolean }) =>
    executar('salvar_motoboy', { motoboy_id: m.id ?? novoId(), nome: m.nome, ativo: m.ativo }),
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

/** Noites antigas (F1): só leitura, direto do servidor. Sem internet, a tela diz que precisa dela. */
export function useNoitesFechadas(): Noite[] | 'sem_internet' | undefined {
  const [noites, setNoites] = useState<Noite[] | 'sem_internet'>();
  useEffect(() => {
    supabase
      .from('noites')
      .select('*')
      .not('fechada_em', 'is', null)
      .order('data', { ascending: false })
      .limit(90)
      .then(({ data, error }) => setNoites(error ? 'sem_internet' : data));
  }, []);
  return noites;
}

export function useNoiteAntiga(
  noiteId: string | undefined,
): { noite: Noite; dados: DadosNoite } | 'sem_internet' | undefined {
  const [estado, setEstado] = useState<{ noite: Noite; dados: DadosNoite } | 'sem_internet'>();
  useEffect(() => {
    if (!noiteId) return;
    void (async () => {
      const [noite, caixas, pedidos, saidas, pagamentos, acertos] = await Promise.all([
        supabase.from('noites').select('*').eq('id', noiteId).single(),
        supabase.from('caixas').select('*').eq('noite_id', noiteId).order('ordem_chegada'),
        supabase.from('pedidos').select('*').eq('noite_id', noiteId),
        supabase.from('saidas').select('*').eq('noite_id', noiteId).order('criado_em'),
        supabase.from('pagamentos').select('*').eq('noite_id', noiteId),
        supabase.from('acertos').select('*').eq('noite_id', noiteId).is('reaberto_em', null),
      ]);
      const erro = [noite, caixas, pedidos, saidas, pagamentos, acertos].some((r) => r.error);
      if (erro || !noite.data) return setEstado('sem_internet');
      setEstado({
        noite: noite.data,
        dados: {
          caixas: caixas.data ?? [],
          pedidos: pedidos.data ?? [],
          saidas: saidas.data ?? [],
          pagamentos: pagamentos.data ?? [],
          acertos: acertos.data ?? [],
        },
      });
    })();
  }, [noiteId]);
  return estado;
}

/** Recusas recentes do servidor, para a tela mostrar o motivo. */
export const useRecusas = () =>
  useLiveQuery(async () => (await banco.recusas.orderBy('em').reverse().limit(5).toArray()) ?? [], [], []);

function paraDespacho(dados: DadosNoite) {
  return {
    pedidos: dados.pedidos.map((p) => ({ ...p, criadoEm: p.criado_em })),
    saidas: dados.saidas.map((s) => ({ pedidoId: s.pedido_id, cancelada: Boolean(s.cancelada_em) })),
    pagamentos: dados.pagamentos.map((p) => ({
      pedidoId: p.pedido_id,
      forma: p.forma,
      pixConfirmado: p.pix_confirmado,
      real: p.real,
      anulado: Boolean(p.anulado_em),
    })),
  };
}

/** Despacho (F1): as entregas que ainda não saíram, por ordem de balcão, com a situação do Pix. */
export function prontosDaNoite(dados: DadosNoite) {
  const d = paraDespacho(dados);
  return prontosParaSair(d.pedidos, d.saidas, d.pagamentos);
}

/** O que o fechamento da noite lista (F1, Fluxo da noite, 7). */
export function pendenciasDe(dados: DadosNoite) {
  return pendenciasDaNoite({
    ...paraDespacho(dados),
    caixas: dados.caixas,
    acertos: dados.acertos.map((a) => ({ caixaId: a.caixa_id })),
  });
}

/** Coluna PIX: todos os Pix antecipados que valem na noite, inclusive dos pedidos que ainda não saíram. */
export function pixDaNoite(dados: DadosNoite): { pagamento: Pagamento; pedido: Pedido }[] {
  const ultima = new Map<string, Saida>();
  for (const s of dados.saidas) if (!s.cancelada_em) ultima.set(s.pedido_id, s);
  return dados.pedidos.flatMap((pedido) => {
    if (pedido.estado === 'cancelado') return [];
    const saida = ultima.get(pedido.id);
    const doPedido = dados.pagamentos.filter((p) => p.pedido_id === pedido.id && !p.anulado_em);
    const reais = doPedido.filter((p) => p.real);
    const vigentes = saida ? pagamentosVigentes(saida, dados.pagamentos) : reais.length > 0 ? reais : doPedido;
    return vigentes.filter((p) => p.forma === 'pix_antecipado').map((pagamento) => ({ pagamento, pedido }));
  });
}
