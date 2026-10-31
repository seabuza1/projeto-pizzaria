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
    ];
  }

  async lerMeta<T>(chave: string): Promise<T | undefined> {
    return (await this.meta.get(chave))?.valor as T | undefined;
  }

  async gravarMeta(chave: string, valor: unknown) {
    await this.meta.put({ chave, valor });
  }
}
