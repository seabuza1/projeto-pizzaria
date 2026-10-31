// Efeito local de cada operação, aplicado na hora no IndexedDB (a tela não espera a rede).
// Espelha as op_* de supabase/migrations, inclusive as versões e as anulações (OPE3).
// O servidor é a verdade: depois de cada sincronização, as operações ainda na fila são reaplicadas por cima.
import type { DadosDe, Operacao, PagamentoLancadoDb, TipoOperacao } from '@mel/db';
import { dataDaNoite, FUSO_PADRAO } from '@mel/dominio';
import type { BancoLocal, Pagamento, Pedido, Saida } from './banco-local';

export interface Contexto {
  usuarioId: string;
}

type Aplicador<T extends TipoOperacao> = (
  db: BancoLocal,
  dados: DadosDe<T>,
  op: Operacao<T>,
  ctx: Contexto,
) => Promise<void>;

const ativas = (saidas: Saida[]) =>
  saidas
    .filter((s) => !s.cancelada_em)
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id));

export async function saidaMaisRecente(db: BancoLocal, pedidoId: string): Promise<Saida | undefined> {
  return ativas(await db.saidas.where('pedido_id').equals(pedidoId).toArray()).at(-1);
}

// A comanda de papel sem saída foi desfeita; o pedido do balcão sem saída volta para o despacho.
async function atualizarEstadoPedido(db: BancoLocal, pedidoId: string) {
  const pedido = await db.pedidos.get(pedidoId);
  if (!pedido || pedido.estado === 'cancelado') return;
  const saidas = ativas(await db.saidas.where('pedido_id').equals(pedidoId).toArray());
  const estado =
    saidas.length === 0
      ? pedido.origem === 'papel'
        ? 'cancelado'
        : 'aberto'
      : saidas.some((s) => s.estado === 'entregue')
        ? 'entregue'
        : 'aberto';
  await db.pedidos.update(pedidoId, { estado });
}

function novaSaida(
  pedido: Pedido,
  caixa: { id: string; noite_id: string; motoboy_id: string },
  area: { id: string; taxa: number },
  saidaId: string,
  hora: string,
): Saida {
  return {
    id: saidaId,
    noite_id: caixa.noite_id,
    pedido_id: pedido.id,
    caixa_id: caixa.id,
    motoboy_id: caixa.motoboy_id,
    area_id: area.id,
    taxa: area.taxa,
    estado: 'em_rota',
    saiu_em: hora,
    entregue_em: null,
    voltou_em: null,
    papel_conferido: false,
    cancelada_em: null,
    cancelada_por: null,
    motivo_cancelamento: null,
    criado_em: hora,
    atualizado_em: hora,
  };
}

// Conflitos e concorrência: as mesmas operações que sobem a versão no servidor sobem aqui.
async function tocarPedido(db: BancoLocal, pedidoId: string, ctx: Contexto) {
  const p = await db.pedidos.get(pedidoId);
  if (p) await db.pedidos.update(pedidoId, { versao: p.versao + 1, atualizado_por: ctx.usuarioId });
}

async function tocarCaixa(db: BancoLocal, caixaId: string, ctx: Contexto) {
  const c = await db.caixas.get(caixaId);
  if (c) await db.caixas.update(caixaId, { versao: c.versao + 1, atualizado_por: ctx.usuarioId });
}

async function anular(db: BancoLocal, ids: string[], motivo: string, op: Operacao, ctx: Contexto) {
  for (const id of ids) {
    await db.pagamentos.update(id, { anulado_em: op.criada_em, anulado_por: ctx.usuarioId, motivo_anulacao: motivo });
  }
}

function novosPagamentos(
  pedido: Pedido,
  saidaId: string,
  linhas: readonly PagamentoLancadoDb[],
  real: boolean,
  hora: string,
  confirmados: readonly Pagamento[] = [],
): Pagamento[] {
  return linhas.map((l) => {
    const conf = l.forma === 'pix_antecipado' ? confirmados.find((c) => c.valor === l.valor) : undefined;
    return {
      id: l.id,
      noite_id: pedido.noite_id,
      pedido_id: pedido.id,
      saida_id: l.forma === 'pix_antecipado' ? null : saidaId,
      forma: l.forma,
      valor: l.valor,
      troco_pix: l.troco_pix ?? 0,
      real,
      pix_confirmado: Boolean(conf),
      pix_confirmado_por: conf?.pix_confirmado_por ?? null,
      pix_confirmado_em: conf?.pix_confirmado_em ?? null,
      origem: 'manual',
      referencia_externa: null,
      registrado_em: hora,
      anulado_em: null,
      anulado_por: null,
      motivo_anulacao: null,
      criado_em: hora,
      atualizado_em: hora,
    };
  });
}

const aplicadores: { [T in TipoOperacao]: Aplicador<T> } = {
  async abrir_noite(db, d, op, ctx) {
    const cfg = await db.config.toCollection().first();
    const data = dataDaNoite(new Date(op.criada_em), cfg?.fuso ?? FUSO_PADRAO);
    await db.noites.put({
      id: d.noite_id,
      data,
      promo_desconto: null,
      aberta_em: op.criada_em,
      aberta_por: ctx.usuarioId,
      fechada_em: null,
      fechada_por: null,
      criado_em: op.criada_em,
      atualizado_em: op.criada_em,
    });
  },
  async fechar_noite(db, d, op, ctx) {
    await db.noites.update(d.noite_id, { fechada_em: op.criada_em, fechada_por: ctx.usuarioId });
  },
  async reabrir_noite(db, d) {
    await db.noites.update(d.noite_id, { fechada_em: null, fechada_por: null });
  },
  async abrir_caixa(db, d, op, ctx) {
    if (await db.caixas.get(d.caixa_id)) return;
    const cfg = await db.config.toCollection().first();
    const ordens = (await db.caixas.where('noite_id').equals(d.noite_id).toArray()).map((c) => c.ordem_chegada);
    await db.caixas.put({
      id: d.caixa_id,
      noite_id: d.noite_id,
      motoboy_id: d.motoboy_id,
      caixa_inicial: d.caixa_inicial ?? cfg?.caixa_inicial_padrao ?? 8000,
      diaria: d.diaria ?? cfg?.diaria_padrao ?? 3000,
      ordem_chegada: Math.max(0, ...ordens) + 1,
      dinheiro_contado: null,
      retorno_em: null,
      fechado_em: null,
      versao: 1,
      atualizado_por: ctx.usuarioId,
      criado_em: op.criada_em,
      atualizado_em: op.criada_em,
    });
  },
  async editar_caixa(db, d, _op, ctx) {
    await db.caixas.update(d.caixa_id, {
      ...(d.caixa_inicial !== undefined ? { caixa_inicial: d.caixa_inicial } : {}),
      ...(d.diaria !== undefined ? { diaria: d.diaria } : {}),
    });
    await tocarCaixa(db, d.caixa_id, ctx);
  },
  async mudar_ordem_caixa(db, d, _op, ctx) {
    const caixa = await db.caixas.get(d.caixa_id);
    if (!caixa) return;
    const outros = (await db.caixas.where('noite_id').equals(caixa.noite_id).toArray())
      .filter((c) => c.id !== caixa.id)
      .sort((a, b) => a.ordem_chegada - b.ordem_chegada);
    outros.splice(d.ordem - 1, 0, caixa);
    for (const [i, c] of outros.entries()) {
      await db.caixas.update(c.id, { ordem_chegada: i + 1 });
      await tocarCaixa(db, c.id, ctx);
    }
  },
  async despachar(db, d, op, ctx) {
    const caixa = await db.caixas.get(d.caixa_id);
    if (!caixa) return;
    for (const { pedido_id, saida_id } of d.saidas) {
      const pedido = await db.pedidos.get(pedido_id);
      const area = pedido?.area_id ? await db.areas.get(pedido.area_id) : undefined;
      if (!pedido || !area || (await saidaMaisRecente(db, pedido.id))) continue;
      await db.saidas.put(novaSaida(pedido, caixa, area, saida_id, op.criada_em));
      // Os pagamentos previstos passam a ser da saída; o Pix antecipado fica no pedido.
      for (const p of await db.pagamentos.where('pedido_id').equals(pedido.id).toArray()) {
        if (!p.saida_id && !p.anulado_em && p.forma !== 'pix_antecipado') {
          await db.pagamentos.update(p.id, { saida_id });
        }
      }
      await atualizarEstadoPedido(db, pedido.id);
      await tocarPedido(db, pedido.id, ctx);
    }
    await tocarCaixa(db, caixa.id, ctx);
  },

  async lancar_saida(db, d, op, ctx) {
    const caixa = await db.caixas.get(d.caixa_id);
    const area = await db.areas.get(d.area_id);
    if (!caixa || !area) return;
    const pedido: Pedido = {
      id: d.pedido_id,
      noite_id: caixa.noite_id,
      codigo: d.codigo,
      origem: 'papel',
      tipo: 'entrega',
      area_id: area.id,
      total: d.total,
      promocao: false,
      estado: 'aberto',
      obs: null,
      criado_por: ctx.usuarioId,
      versao: 1,
      atualizado_por: ctx.usuarioId,
      criado_em: op.criada_em,
      atualizado_em: op.criada_em,
    };
    await db.pedidos.put(pedido);
    await db.saidas.put(novaSaida(pedido, caixa, area, d.saida_id, op.criada_em));
    await db.pagamentos.bulkPut(novosPagamentos(pedido, d.saida_id, d.pagamentos, false, op.criada_em));
    await tocarCaixa(db, caixa.id, ctx);
  },
  async cancelar_saida(db, d, op, ctx) {
    const saida = await db.saidas.get(d.saida_id);
    if (!saida || saida.cancelada_em) return;
    const motivo = d.motivo ?? 'Desfeito no app';
    const anterior = ativas(await db.saidas.where('pedido_id').equals(saida.pedido_id).toArray())
      .filter((s) => s.id !== saida.id)
      .at(-1);
    await db.saidas.update(saida.id, {
      cancelada_em: op.criada_em,
      cancelada_por: ctx.usuarioId,
      motivo_cancelamento: motivo,
    });
    const doPedido = await db.pagamentos.where('pedido_id').equals(saida.pedido_id).toArray();
    const pedido = await db.pedidos.get(saida.pedido_id);
    if (!anterior && pedido?.origem === 'papel') {
      await anular(
        db,
        doPedido.filter((p) => !p.anulado_em).map((p) => p.id),
        motivo,
        op,
        ctx,
      );
    } else {
      // Com saída anterior, os pagamentos voltam para ela; sem, o pedido do balcão volta para o despacho.
      for (const p of doPedido.filter((x) => x.saida_id === saida.id && !x.anulado_em)) {
        await db.pagamentos.update(p.id, { saida_id: anterior?.id ?? null });
      }
    }
    await atualizarEstadoPedido(db, saida.pedido_id);
    await tocarPedido(db, saida.pedido_id, ctx);
    await tocarCaixa(db, saida.caixa_id, ctx);
  },
  async mudar_estado_saida(db, d, op, ctx) {
    const saida = await db.saidas.get(d.saida_id);
    if (!saida) return;
    await db.saidas.update(saida.id, {
      estado: d.estado,
      entregue_em: d.estado === 'entregue' ? op.criada_em : null,
      voltou_em: d.estado === 'voltou' ? op.criada_em : null,
    });
    await atualizarEstadoPedido(db, saida.pedido_id);
    await tocarPedido(db, saida.pedido_id, ctx);
    await tocarCaixa(db, saida.caixa_id, ctx);
  },
  async trocar_pagamento(db, d, op, ctx) {
    const saida = await db.saidas.get(d.saida_id);
    const pedido = saida && (await db.pedidos.get(saida.pedido_id));
    if (!saida || !pedido) return;
    const doPedido = await db.pagamentos.where('pedido_id').equals(pedido.id).toArray();
    const confirmados = doPedido.filter((p) => p.forma === 'pix_antecipado' && p.pix_confirmado);
    const novos = novosPagamentos(pedido, saida.id, d.pagamentos, true, op.criada_em, confirmados);
    const ids = new Set(novos.map((p) => p.id));
    await db.pagamentos.bulkPut(novos);
    await anular(
      db,
      doPedido.filter((p) => p.real && !p.anulado_em && !ids.has(p.id)).map((p) => p.id),
      d.pagamentos.length === 0 ? 'Voltou para a forma prevista' : 'Forma trocada de novo',
      op,
      ctx,
    );
    await tocarPedido(db, pedido.id, ctx);
    await tocarCaixa(db, saida.caixa_id, ctx);
  },
  async sair_de_novo(db, d, op, ctx) {
    const anterior = await db.saidas.get(d.saida_anterior_id);
    if (!anterior) return;
    const caixa = await db.caixas.get(d.caixa_id);
    const area = await db.areas.get(d.area_id ?? anterior.area_id);
    if (!caixa || !area) return;
    await db.saidas.put({
      ...anterior,
      id: d.saida_id,
      caixa_id: caixa.id,
      motoboy_id: caixa.motoboy_id,
      area_id: area.id,
      taxa: area.taxa,
      estado: 'em_rota',
      saiu_em: op.criada_em,
      entregue_em: null,
      voltou_em: null,
      papel_conferido: false,
      criado_em: op.criada_em,
      atualizado_em: op.criada_em,
    });
    for (const p of await db.pagamentos.where('saida_id').equals(anterior.id).toArray()) {
      if (!p.anulado_em) await db.pagamentos.update(p.id, { saida_id: d.saida_id });
    }
    await atualizarEstadoPedido(db, anterior.pedido_id);
    await tocarPedido(db, anterior.pedido_id, ctx);
    await tocarCaixa(db, caixa.id, ctx);
  },
  async conferir_papel(db, d) {
    await db.saidas.update(d.saida_id, { papel_conferido: d.conferido });
  },
  async informar_contado(db, d, _op, ctx) {
    await db.caixas.update(d.caixa_id, { dinheiro_contado: d.dinheiro_contado });
    await tocarCaixa(db, d.caixa_id, ctx);
  },
  async confirmar_acerto(db, d, op, ctx) {
    const caixa = await db.caixas.get(d.caixa_id);
    if (!caixa) return;
    const e = d.esperado;
    await db.acertos.put({
      id: d.acerto_id,
      noite_id: caixa.noite_id,
      caixa_id: caixa.id,
      dinheiro_contado: e.dinheiroContado,
      devolver: e.devolver,
      maquininha: e.maquininha,
      receber: e.receber,
      falta: Math.max(0, e.devolver - e.dinheiroContado),
      sobra: Math.max(0, e.dinheiroContado - e.devolver),
      pagar: e.pagar,
      completa: Math.max(0, e.devolver - e.dinheiroContado - e.receber),
      do_caixa_dele: e.doCaixaDele,
      retirado_caixa_empresa: e.retiradoCaixaEmpresa,
      vai_para_empresa: e.vaiParaEmpresa,
      conta: (d.conta ?? {}) as never,
      confirmado_por: ctx.usuarioId,
      confirmado_em: op.criada_em,
      reaberto_por: null,
      reaberto_em: null,
      motivo_reabertura: null,
      criado_em: op.criada_em,
      atualizado_em: op.criada_em,
    });
    await db.caixas.update(caixa.id, { fechado_em: op.criada_em });
    await tocarCaixa(db, caixa.id, ctx);
  },
  async reabrir_acerto(db, d, op, ctx) {
    const acertos = await db.acertos.where('caixa_id').equals(d.caixa_id).toArray();
    for (const a of acertos.filter((x) => !x.reaberto_em)) {
      await db.acertos.update(a.id, {
        reaberto_em: op.criada_em,
        reaberto_por: ctx.usuarioId,
        motivo_reabertura: d.motivo,
      });
    }
    await db.caixas.update(d.caixa_id, { fechado_em: null });
    await tocarCaixa(db, d.caixa_id, ctx);
  },
  async marcar_pix(db, d, op, ctx) {
    await db.pagamentos.update(d.pagamento_id, {
      pix_confirmado: d.confirmado,
      pix_confirmado_por: d.confirmado ? ctx.usuarioId : null,
      pix_confirmado_em: d.confirmado ? op.criada_em : null,
    });
  },
  async pedir_impressao(db, d, op, ctx) {
    await db.impressoes.put({
      id: d.impressao_id,
      noite_id: d.noite_id ?? null,
      caixa_id: d.caixa_id ?? null,
      tipo: d.tipo,
      impressora: d.impressora ?? 'balcao',
      conteudo: d.conteudo,
      estado: d.impressa ? 'impresso' : 'pendente',
      tentativas: 0,
      erro: null,
      pedida_por: ctx.usuarioId,
      impressa_em: d.impressa ? op.criada_em : null,
      criado_em: op.criada_em,
      atualizado_em: op.criada_em,
    });
  },
  async atualizar_impressao(db, d) {
    await db.impressoes.update(d.impressao_id, { estado: d.estado });
  },
  async registrar_impressao_local() {},
  async salvar_area(db, d, op) {
    const atual = await db.areas.get(d.area_id);
    await db.areas.put({
      id: d.area_id,
      nome: d.nome,
      cidade: d.cidade,
      taxa: d.taxa,
      ativa: d.ativa,
      ordem: d.ordem ?? atual?.ordem ?? 0,
      criado_em: atual?.criado_em ?? op.criada_em,
      atualizado_em: op.criada_em,
    });
  },
  async salvar_config(db, d) {
    const cfg = await db.config.toCollection().first();
    if (!cfg) return;
    await db.config.update(cfg.id, {
      ...(d.fuso ? { fuso: d.fuso } : {}),
      ...(d.ambiente ? { ambiente: d.ambiente } : {}),
      ...(d.caixa_inicial_padrao !== undefined ? { caixa_inicial_padrao: d.caixa_inicial_padrao } : {}),
      ...(d.diaria_padrao !== undefined ? { diaria_padrao: d.diaria_padrao } : {}),
      ...(d.funcionalidades_desligadas ? { funcionalidades_desligadas: d.funcionalidades_desligadas } : {}),
    });
  },
  async salvar_motoboy(db, d, op) {
    const atual = await db.motoboys.get(d.motoboy_id);
    await db.motoboys.put({
      id: d.motoboy_id,
      nome: d.nome,
      ativo: d.ativo,
      criado_em: atual?.criado_em ?? op.criada_em,
      atualizado_em: op.criada_em,
    });
  },
  async salvar_perfil(db, d) {
    await db.perfis.update(d.perfil_id, {
      ...(d.nome ? { nome: d.nome } : {}),
      ...(d.papeis ? { papeis: d.papeis } : {}),
      ...(d.ativo !== undefined ? { ativo: d.ativo } : {}),
    });
  },
};

export async function aplicarLocal(db: BancoLocal, op: Operacao, ctx: Contexto) {
  const aplicar = aplicadores[op.tipo] as Aplicador<TipoOperacao>;
  await aplicar(db, op.dados, op, ctx);
}
