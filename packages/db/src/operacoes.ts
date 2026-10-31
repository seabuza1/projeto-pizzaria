// Formato das operações da fila (ARQUITETURA, Funcionar sem internet).
// O mesmo formato que public.aplicar_operacao valida no servidor.
import { z } from 'zod';

const id = z.uuid();
const versao = z.number().int().positive();
const motivo = z.string().trim().min(1).max(300);
const centavos = z.number().int().nonnegative().max(2_000_000_000);
const positivo = z.number().int().positive().max(2_000_000_000);

const faixaPizza = z.enum(['tradicional', 'especial', 'premium', 'doce', 'doce_especial']);
const nomeItem = z.string().trim().min(1).max(80);
const apelidos = z.array(z.string().trim().min(1).max(40)).max(20);
const ordem = z.number().int().min(0).max(999).optional();
const textoOpcional = (max: number) => z.string().trim().max(max).nullable().optional();

export const formaPagamento = z.enum(['dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado']);

export const pagamentoLancado = z.object({
  id,
  forma: formaPagamento,
  valor: positivo,
  troco_pix: centavos.optional(),
});
export type PagamentoLancadoDb = z.infer<typeof pagamentoLancado>;

/** Linha do pedido: o item como foi pedido e a fotografia do preço (packages/dominio/src/preco.ts). */
const linhaDoPedido = z.object({
  item: z.record(z.string(), z.unknown()),
  nome: z.string().trim().min(1).max(200),
  detalhes: z.array(z.string().max(100)).max(20),
  faixa_cobrada: faixaPizza.nullable(),
  unitario: centavos,
  desconto: centavos,
  quantidade: z.number().int().min(1).max(99),
  total: centavos,
});
const aparelho = z.string().max(80);

const dadosPorTipo = {
  abrir_noite: z.object({ noite_id: id }),
  fechar_noite: z.object({ noite_id: id }),
  reabrir_noite: z.object({ noite_id: id }),
  abrir_caixa: z.object({
    caixa_id: id,
    noite_id: id,
    motoboy_id: id,
    caixa_inicial: centavos.optional(),
    diaria: centavos.optional(),
  }),
  editar_caixa: z.object({ caixa_id: id, caixa_inicial: centavos.optional(), diaria: centavos.optional() }),
  mudar_ordem_caixa: z.object({ caixa_id: id, ordem: z.number().int().min(1).max(99) }),
  despachar: z.object({
    caixa_id: id,
    saidas: z
      .array(z.object({ pedido_id: id, saida_id: id }))
      .min(1)
      .max(10),
  }),
  lancar_saida: z.object({
    caixa_id: id,
    pedido_id: id,
    saida_id: id,
    codigo: z.string().regex(/^\d{4}$/),
    total: positivo,
    area_id: id,
    pagamentos: z.array(pagamentoLancado).min(1).max(6),
  }),
  cancelar_saida: z.object({ saida_id: id, versao_esperada: versao, motivo: motivo.optional() }),
  mudar_estado_saida: z.object({ saida_id: id, estado: z.enum(['em_rota', 'entregue', 'voltou']) }),
  trocar_pagamento: z.object({ saida_id: id, versao_esperada: versao, pagamentos: z.array(pagamentoLancado).max(6) }),
  sair_de_novo: z.object({ saida_id: id, saida_anterior_id: id, caixa_id: id, area_id: id.optional() }),
  conferir_papel: z.object({ saida_id: id, conferido: z.boolean() }),
  informar_contado: z.object({ caixa_id: id, dinheiro_contado: centavos.nullable() }),
  confirmar_acerto: z.object({
    caixa_id: id,
    acerto_id: id,
    versao_esperada: versao,
    esperado: z.object({
      devolver: z.number().int(),
      maquininha: z.number().int(),
      receber: z.number().int(),
      dinheiroContado: z.number().int(),
      pagar: z.number().int(),
      doCaixaDele: z.number().int(),
      retiradoCaixaEmpresa: z.number().int(),
      vaiParaEmpresa: z.number().int(),
    }),
    conta: z.record(z.string(), z.unknown()).optional(),
  }),
  reabrir_acerto: z.object({ caixa_id: id, motivo }),
  marcar_pix: z.object({ pagamento_id: id, confirmado: z.boolean(), motivo: motivo.optional() }),
  pedir_impressao: z.object({
    impressao_id: id,
    tipo: z.enum(['recibo_acerto', 'folha_noite', 'comanda']),
    conteudo: z.string().min(1).max(20000),
    noite_id: id.optional(),
    caixa_id: id.optional(),
    pedido_id: id.optional(),
    impressora: z.string().max(40).optional(),
    impressa: z.boolean().optional(),
  }),
  atualizar_impressao: z.object({
    impressao_id: id,
    estado: z.enum(['pendente', 'imprimindo', 'impresso', 'erro']),
    erro: z.string().max(500).optional(),
  }),
  registrar_impressao_local: z.object({
    impressao_id: id,
    tipo: z.enum(['recibo_acerto', 'folha_noite', 'comanda']),
    conteudo: z.string().min(1).max(20000),
    noite_id: id.optional(),
    caixa_id: id.optional(),
    pedido_id: id.optional(),
  }),
  salvar_area: z.object({
    area_id: id,
    nome: z.string().trim().min(1).max(40),
    cidade: z.string().trim().min(1).max(60),
    taxa: centavos,
    ativa: z.boolean(),
    ordem: z.number().int().min(0).max(999).optional(),
  }),
  salvar_config: z.object({
    fuso: z.string().optional(),
    ambiente: z.enum(['producao', 'teste']).optional(),
    caixa_inicial_padrao: centavos.optional(),
    diaria_padrao: centavos.optional(),
    funcionalidades_desligadas: z
      .array(z.string().regex(/^[a-z_]{1,40}$/))
      .max(30)
      .optional(),
  }),
  salvar_preco_faixa: z.object({ faixa: faixaPizza, tamanho: z.enum(['B', 'P', 'M', 'G']), preco: positivo }),
  salvar_item_cardapio: z.discriminatedUnion('tipo', [
    z.object({
      tipo: z.literal('sabor'),
      item_id: id,
      nome: nomeItem,
      faixa: faixaPizza,
      ingredientes: z.string().trim().max(300).optional(),
      apelidos: apelidos.optional(),
      ativo: z.boolean(),
      ordem,
    }),
    z.object({ tipo: z.literal('borda'), item_id: id, nome: nomeItem, preco: centavos, ativo: z.boolean(), ordem }),
    z.object({
      tipo: z.literal('adicional'),
      item_id: id,
      nome: nomeItem,
      preco: centavos,
      avulso: z.boolean().optional(),
      ativo: z.boolean(),
      ordem,
    }),
    z.object({
      tipo: z.literal('bebida'),
      item_id: id,
      nome: nomeItem,
      preco: centavos,
      grupo: z.string().trim().min(1).max(40).optional(),
      apelidos: apelidos.optional(),
      ativo: z.boolean(),
      ordem,
    }),
    z.object({
      tipo: z.literal('combo'),
      item_id: id,
      nome: z.string().regex(/^\d{2}$/),
      itens: z.array(nomeItem).min(1).max(10),
      preco: positivo,
      ativo: z.boolean(),
      ordem,
    }),
  ]),
  marcar_acabou: z.object({
    noite_id: id,
    tipo: z.enum(['sabor', 'borda', 'adicional', 'bebida', 'combo']),
    item_id: id,
    acabou: z.boolean(),
  }),
  /** PED4: 0 = sem promoção; senão, de R$ 3 a R$ 23. */
  definir_promocao: z.object({ noite_id: id, desconto: z.union([z.literal(0), z.number().int().min(300).max(2300)]) }),
  salvar_cliente: z.object({
    cliente_id: id,
    telefone: z.string().regex(/^\d{10,11}$/),
    nome: textoOpcional(80),
    local_link: textoOpcional(500),
    local_endereco: textoOpcional(300),
    local_referencia: textoOpcional(300),
    area_id: id.nullable().optional(),
  }),
  salvar_pedido: z.object({
    pedido_id: id,
    noite_id: id.optional(),
    /** rascunho (digitando), aguardando (resumo mandado) ou autorizar (vai para a produção; PED6). */
    etapa: z.enum(['rascunho', 'aguardando', 'autorizar']),
    telefone: z.string().regex(/^\d{10,11}$/),
    tipo: z.enum(['entrega', 'retirada']),
    area_id: id.nullable().optional(),
    itens: z.array(linhaDoPedido).max(40),
    pagamentos: z.array(pagamentoLancado).max(6),
    troco_para: positivo.nullable().optional(),
    promocao: z.boolean(),
    endereco_link: textoOpcional(500),
    endereco_texto: textoOpcional(300),
    endereco_referencia: textoOpcional(300),
    local_pendente: z.boolean(),
    obs: textoOpcional(500),
    aparelho,
    /** Só para alterar um pedido já autorizado. */
    versao_esperada: versao.optional(),
  }),
  assumir_pedido: z.object({ pedido_id: id, aparelho }),
  cancelar_pedido: z.object({ pedido_id: id, motivo, versao_esperada: versao }),
  marcar_retirado: z.object({
    pedido_id: id,
    versao_esperada: versao,
    pagamentos: z.array(pagamentoLancado).max(6).optional(),
  }),
  salvar_motoboy: z.object({ motoboy_id: id, nome: z.string().trim().min(1).max(60), ativo: z.boolean() }),
  salvar_perfil: z.object({
    perfil_id: id,
    nome: z.string().trim().min(1).max(60).optional(),
    papeis: z
      .array(z.enum(['admin', 'gerente', 'expedicao', 'atendente', 'cozinha', 'garcom', 'agente']))
      .min(1)
      .optional(),
    ativo: z.boolean().optional(),
  }),
} as const;

export type TipoOperacao = keyof typeof dadosPorTipo;

/**
 * PADROES, Módulos removíveis (tudo tem dono): a funcionalidade de cada operação.
 * "nucleo" é das tabelas que todos usam e nunca sai junto com um módulo.
 */
export const donoDaOperacao: Record<TipoOperacao, string> = {
  abrir_noite: 'expedicao',
  fechar_noite: 'expedicao',
  reabrir_noite: 'expedicao',
  abrir_caixa: 'expedicao',
  editar_caixa: 'expedicao',
  mudar_ordem_caixa: 'expedicao',
  despachar: 'expedicao',
  lancar_saida: 'expedicao',
  cancelar_saida: 'expedicao',
  mudar_estado_saida: 'expedicao',
  trocar_pagamento: 'expedicao',
  sair_de_novo: 'expedicao',
  conferir_papel: 'expedicao',
  informar_contado: 'expedicao',
  confirmar_acerto: 'expedicao',
  reabrir_acerto: 'expedicao',
  marcar_pix: 'expedicao',
  pedir_impressao: 'nucleo',
  atualizar_impressao: 'nucleo',
  registrar_impressao_local: 'nucleo',
  salvar_area: 'nucleo',
  salvar_config: 'nucleo',
  salvar_perfil: 'nucleo',
  salvar_motoboy: 'motoboys',
  salvar_preco_faixa: 'cardapio',
  salvar_item_cardapio: 'cardapio',
  marcar_acabou: 'cardapio',
  definir_promocao: 'expedicao',
  salvar_cliente: 'nucleo',
  salvar_pedido: 'atendimento',
  assumir_pedido: 'atendimento',
  cancelar_pedido: 'atendimento',
  marcar_retirado: 'atendimento',
};

/** Versão do formato das operações. O servidor aceita esta e a anterior (interno.versao_op_atual). */
export const VERSAO_OP = 1;
export type DadosDe<T extends TipoOperacao> = z.infer<(typeof dadosPorTipo)[T]>;

export interface Operacao<T extends TipoOperacao = TipoOperacao> {
  id: string;
  tipo: T;
  dados: DadosDe<T>;
  /** ISO 8601, relógio do aparelho: só ordena a fila. A hora que vale é a do servidor. */
  criada_em: string;
  versao_op: number;
  aparelho?: string;
}

export const tiposDeOperacao = Object.keys(dadosPorTipo) as TipoOperacao[];

/** Valida os dados antes de pôr a operação na fila. Lança se o formato estiver errado. */
export function validarDados<T extends TipoOperacao>(tipo: T, dados: unknown): DadosDe<T> {
  return dadosPorTipo[tipo].parse(dados) as DadosDe<T>;
}

export interface RespostaOperacao {
  id: string;
  status: 'aplicada' | 'recusada';
  motivo: string | null;
  /** Código da regra que recusou (PADROES, Erros). */
  codigo: string | null;
  resultado: Record<string, unknown> | null;
  repetida?: boolean;
}
