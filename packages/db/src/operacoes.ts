// Formato das operações da fila (ARQUITETURA, Funcionar sem internet).
// O mesmo formato que public.aplicar_operacao valida no servidor.
import { z } from 'zod';

const id = z.uuid();
const centavos = z.number().int().nonnegative().max(2_000_000_000);
const positivo = z.number().int().positive().max(2_000_000_000);

export const formaPagamento = z.enum(['dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado']);

export const pagamentoLancado = z.object({
  id,
  forma: formaPagamento,
  valor: positivo,
  troco_pix: centavos.optional(),
});
export type PagamentoLancadoDb = z.infer<typeof pagamentoLancado>;

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
  avisar_retorno: z.object({ caixa_id: id, minutos: z.number().int().min(1).max(60).nullable() }),
  lancar_saida: z.object({
    caixa_id: id,
    pedido_id: id,
    saida_id: id,
    codigo: z.string().regex(/^\d{4}$/),
    total: positivo,
    area_id: id,
    pagamentos: z.array(pagamentoLancado).min(1).max(6),
  }),
  cancelar_saida: z.object({ saida_id: id }),
  mudar_estado_saida: z.object({ saida_id: id, estado: z.enum(['em_rota', 'entregue', 'voltou']) }),
  trocar_pagamento: z.object({ saida_id: id, pagamentos: z.array(pagamentoLancado).max(6) }),
  sair_de_novo: z.object({ saida_id: id, saida_anterior_id: id, caixa_id: id.optional(), area_id: id.optional() }),
  conferir_papel: z.object({ saida_id: id, conferido: z.boolean() }),
  informar_contado: z.object({ caixa_id: id, dinheiro_contado: centavos.nullable() }),
  confirmar_acerto: z.object({
    caixa_id: id,
    acerto_id: id,
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
  reabrir_acerto: z.object({ caixa_id: id }),
  marcar_pix: z.object({ pagamento_id: id, confirmado: z.boolean() }),
  pedir_impressao: z.object({
    impressao_id: id,
    tipo: z.enum(['recibo_acerto', 'folha_noite']),
    conteudo: z.string().min(1).max(20000),
    noite_id: id.optional(),
    caixa_id: id.optional(),
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
    tipo: z.enum(['recibo_acerto', 'folha_noite']),
    conteudo: z.string().min(1).max(20000),
    noite_id: id.optional(),
    caixa_id: id.optional(),
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
  }),
  salvar_perfil: z.object({
    perfil_id: id,
    nome: z.string().trim().min(1).max(60).optional(),
    papeis: z
      .array(z.enum(['admin', 'gerente', 'expedicao', 'atendente', 'motoboy', 'cozinha', 'garcom', 'agente']))
      .min(1)
      .optional(),
    ativo: z.boolean().optional(),
  }),
} as const;

export type TipoOperacao = keyof typeof dadosPorTipo;
export type DadosDe<T extends TipoOperacao> = z.infer<(typeof dadosPorTipo)[T]>;

export interface Operacao<T extends TipoOperacao = TipoOperacao> {
  id: string;
  tipo: T;
  dados: DadosDe<T>;
  /** ISO 8601, relógio do aparelho. */
  criada_em: string;
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
  resultado: Record<string, unknown> | null;
  repetida?: boolean;
}
