// IndexedDB do aparelho: a noite aberta, a fila de operações e o que a tela precisa offline.
import type { Operacao, Tables } from '@mel/db';
import Dexie, { type EntityTable } from 'dexie';

export type Noite = Tables<'noites'>;
export type Caixa = Tables<'caixas'>;
export type Pedido = Tables<'pedidos'>;
export type Saida = Tables<'saidas'>;
export type Pagamento = Tables<'pagamentos'>;
export type Acerto = Tables<'acertos'>;
export type Area = Tables<'areas'>;
export type Perfil = Tables<'perfis'>;
export type Motoboy = Tables<'motoboys'>;
export type Config = Tables<'config'>;
export type Impressao = Tables<'impressoes'>;
export type FaixaPreco = Tables<'cardapio_faixas'>;
export type Sabor = Tables<'cardapio_sabores'>;
export type Borda = Tables<'cardapio_bordas'>;
export type Adicional = Tables<'cardapio_adicionais'>;
export type Bebida = Tables<'cardapio_bebidas'>;
export type Combo = Tables<'cardapio_combos'>;
export type Acabou = Tables<'cardapio_acabou'>;
export type Cliente = Tables<'clientes'>;
export type PedidoItem = Tables<'pedido_itens'>;

export interface OperacaoNaFila extends Operacao {
  seq: number;
  tentativas: number;
  erro?: string;
}

export interface Recusa {
  id: string;
  tipo: string;
  motivo: string;
  /** Código da regra (PADROES, Erros). */
  codigo: string;
  em: string;
}

export interface Meta {
  chave: string;
  valor: unknown;
}

export class BancoLocal extends Dexie {
  noites!: EntityTable<Noite, 'id'>;
  caixas!: EntityTable<Caixa, 'id'>;
  pedidos!: EntityTable<Pedido, 'id'>;
  saidas!: EntityTable<Saida, 'id'>;
  pagamentos!: EntityTable<Pagamento, 'id'>;
  acertos!: EntityTable<Acerto, 'id'>;
  areas!: EntityTable<Area, 'id'>;
  perfis!: EntityTable<Perfil, 'id'>;
  motoboys!: EntityTable<Motoboy, 'id'>;
  config!: EntityTable<Config, 'id'>;
  impressoes!: EntityTable<Impressao, 'id'>;
  cardapio_faixas!: EntityTable<FaixaPreco, 'id'>;
  cardapio_sabores!: EntityTable<Sabor, 'id'>;
  cardapio_bordas!: EntityTable<Borda, 'id'>;
  cardapio_adicionais!: EntityTable<Adicional, 'id'>;
  cardapio_bebidas!: EntityTable<Bebida, 'id'>;
  cardapio_combos!: EntityTable<Combo, 'id'>;
  cardapio_acabou!: EntityTable<Acabou, 'id'>;
  clientes!: EntityTable<Cliente, 'id'>;
  pedido_itens!: EntityTable<PedidoItem, 'id'>;
  fila!: EntityTable<OperacaoNaFila, 'id'>;
  recusas!: EntityTable<Recusa, 'id'>;
  meta!: EntityTable<Meta, 'chave'>;

  constructor(nome = 'mel') {
    super(nome);
    this.version(1).stores({
      noites: 'id, data',
      caixas: 'id, noite_id, motoboy_id',
      pedidos: 'id, noite_id, codigo',
      saidas: 'id, noite_id, pedido_id, caixa_id',
      pagamentos: 'id, noite_id, pedido_id, saida_id',
      acertos: 'id, noite_id, caixa_id',
      areas: 'id',
      perfis: 'id',
      config: 'id',
      impressoes: 'id, noite_id, estado',
      fila: 'id, seq',
      recusas: 'id, em',
      meta: 'chave',
    });
    // Decisão 0007: o motoboy virou cadastro.
    this.version(2).stores({ motoboys: 'id' });
    // F2, 2a: cardápio, "acabou hoje" e clientes, para atender sem internet.
    this.version(3).stores({
      cardapio_faixas: 'id',
      cardapio_sabores: 'id',
      cardapio_bordas: 'id',
      cardapio_adicionais: 'id',
      cardapio_bebidas: 'id',
      cardapio_combos: 'id',
      cardapio_acabou: 'id, noite_id, item_id',
      clientes: 'id, &telefone',
    });
    // F2, 2b: itens do pedido (a fotografia do preço).
    this.version(4).stores({ pedido_itens: 'id, noite_id, pedido_id' });
  }

  /** Tabelas com dados da noite (e as de cadastro), na ordem em que a sincronização grava. */
  get tabelasDeDados() {
    return [
      this.noites,
      this.caixas,
      this.pedidos,
      this.saidas,
      this.pagamentos,
      this.acertos,
      this.areas,
      this.perfis,
      this.motoboys,
      this.config,
      this.impressoes,
      this.cardapio_faixas,
      this.cardapio_sabores,
      this.cardapio_bordas,
      this.cardapio_adicionais,
      this.cardapio_bebidas,
      this.cardapio_combos,
      this.cardapio_acabou,
      this.clientes,
      this.pedido_itens,
    ];
  }

  async lerMeta<T>(chave: string): Promise<T | undefined> {
    return (await this.meta.get(chave))?.valor as T | undefined;
  }

  async gravarMeta(chave: string, valor: unknown) {
    await this.meta.put({ chave, valor });
  }
}
