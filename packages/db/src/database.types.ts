export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      acertos: {
        Row: {
          atualizado_em: string;
          caixa_id: string;
          completa: number;
          confirmado_em: string;
          confirmado_por: string;
          conta: NonNullable<Json>;
          criado_em: string;
          devolver: number;
          dinheiro_contado: number;
          do_caixa_dele: number;
          falta: number;
          id: string;
          maquininha: number;
          motivo_reabertura: string | null;
          noite_id: string;
          pagar: number;
          reaberto_em: string | null;
          reaberto_por: string | null;
          receber: number;
          retirado_caixa_empresa: number;
          sobra: number;
          vai_para_empresa: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          caixa_id: string;
          completa: number;
          confirmado_em?: string;
          confirmado_por: string;
          conta: NonNullable<Json>;
          criado_em?: string;
          devolver: number;
          dinheiro_contado: number;
          do_caixa_dele: number;
          falta: number;
          id?: string;
          maquininha: number;
          motivo_reabertura?: string | null;
          noite_id: string;
          pagar: number;
          reaberto_em?: string | null;
          reaberto_por?: string | null;
          receber: number;
          retirado_caixa_empresa: number;
          sobra: number;
          vai_para_empresa: number;
        };
        Update: {
          atualizado_em?: string;
          caixa_id?: string;
          completa?: number;
          confirmado_em?: string;
          confirmado_por?: string;
          conta?: NonNullable<Json>;
          criado_em?: string;
          devolver?: number;
          dinheiro_contado?: number;
          do_caixa_dele?: number;
          falta?: number;
          id?: string;
          maquininha?: number;
          motivo_reabertura?: string | null;
          noite_id?: string;
          pagar?: number;
          reaberto_em?: string | null;
          reaberto_por?: string | null;
          receber?: number;
          retirado_caixa_empresa?: number;
          sobra?: number;
          vai_para_empresa?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'acertos_caixa_id_fkey';
            columns: ['caixa_id'];
            isOneToOne: false;
            referencedRelation: 'caixas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'acertos_confirmado_por_fkey';
            columns: ['confirmado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'acertos_noite_id_fkey';
            columns: ['noite_id'];
            isOneToOne: false;
            referencedRelation: 'noites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'acertos_reaberto_por_fkey';
            columns: ['reaberto_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      areas: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          cidade: string;
          criado_em: string;
          id: string;
          nome: string;
          ordem: number;
          taxa: number;
        };
        ComputedFields: never;
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          cidade: string;
          criado_em?: string;
          id?: string;
          nome: string;
          ordem?: number;
          taxa: number;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          cidade?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          taxa?: number;
        };
        Relationships: [];
      };
      caixas: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          caixa_inicial: number;
          criado_em: string;
          diaria: number;
          dinheiro_contado: number | null;
          fechado_em: string | null;
          id: string;
          motoboy_id: string;
          noite_id: string;
          ordem_chegada: number;
          retorno_em: string | null;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          caixa_inicial: number;
          criado_em?: string;
          diaria: number;
          dinheiro_contado?: number | null;
          fechado_em?: string | null;
          id?: string;
          motoboy_id: string;
          noite_id: string;
          ordem_chegada: number;
          retorno_em?: string | null;
          versao?: number;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          caixa_inicial?: number;
          criado_em?: string;
          diaria?: number;
          dinheiro_contado?: number | null;
          fechado_em?: string | null;
          id?: string;
          motoboy_id?: string;
          noite_id?: string;
          ordem_chegada?: number;
          retorno_em?: string | null;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'caixas_atualizado_por_fkey';
            columns: ['atualizado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caixas_motoboy_id_fkey';
            columns: ['motoboy_id'];
            isOneToOne: false;
            referencedRelation: 'motoboys';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caixas_noite_id_fkey';
            columns: ['noite_id'];
            isOneToOne: false;
            referencedRelation: 'noites';
            referencedColumns: ['id'];
          },
        ];
      };
      config: {
        Row: {
          ambiente: Database['public']['Enums']['ambiente'];
          atualizado_em: string;
          caixa_inicial_padrao: number;
          criado_em: string;
          diaria_padrao: number;
          fases_ligadas: string[];
          funcionalidades_desligadas: string[];
          fuso: string;
          id: string;
          unica: boolean;
          versao_minima_app: number;
        };
        ComputedFields: never;
        Insert: {
          ambiente?: Database['public']['Enums']['ambiente'];
          atualizado_em?: string;
          caixa_inicial_padrao?: number;
          criado_em?: string;
          diaria_padrao?: number;
          fases_ligadas?: string[];
          funcionalidades_desligadas?: string[];
          fuso?: string;
          id?: string;
          unica?: boolean;
          versao_minima_app?: number;
        };
        Update: {
          ambiente?: Database['public']['Enums']['ambiente'];
          atualizado_em?: string;
          caixa_inicial_padrao?: number;
          criado_em?: string;
          diaria_padrao?: number;
          fases_ligadas?: string[];
          funcionalidades_desligadas?: string[];
          fuso?: string;
          id?: string;
          unica?: boolean;
          versao_minima_app?: number;
        };
        Relationships: [];
      };
      erros: {
        Row: {
          atualizado_em: string;
          autor: string | null;
          contexto: Json | null;
          criado_em: string;
          id: string;
          mensagem: string;
          origem: string;
          pilha: string | null;
          versao: string | null;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          autor?: string | null;
          contexto?: Json | null;
          criado_em?: string;
          id?: string;
          mensagem: string;
          origem: string;
          pilha?: string | null;
          versao?: string | null;
        };
        Update: {
          atualizado_em?: string;
          autor?: string | null;
          contexto?: Json | null;
          criado_em?: string;
          id?: string;
          mensagem?: string;
          origem?: string;
          pilha?: string | null;
          versao?: string | null;
        };
        Relationships: [];
      };
      eventos: {
        Row: {
          acao: string;
          antes: Json | null;
          atualizado_em: string;
          autor: string | null;
          criado_em: string;
          depois: Json | null;
          id: string;
          operacao_id: string | null;
          registro_id: string;
          tabela: string;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          antes?: Json | null;
          atualizado_em?: string;
          autor?: string | null;
          criado_em?: string;
          depois?: Json | null;
          id?: string;
          operacao_id?: string | null;
          registro_id: string;
          tabela: string;
        };
        Update: {
          acao?: string;
          antes?: Json | null;
          atualizado_em?: string;
          autor?: string | null;
          criado_em?: string;
          depois?: Json | null;
          id?: string;
          operacao_id?: string | null;
          registro_id?: string;
          tabela?: string;
        };
        Relationships: [];
      };
      faltas: {
        Row: {
          acerto_id: string;
          anulada_em: string | null;
          anulada_por: string | null;
          atualizado_em: string;
          caixa_id: string;
          criado_em: string;
          devolvido_em: string | null;
          id: string;
          motivo_anulacao: string | null;
          origem: string | null;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          acerto_id: string;
          anulada_em?: string | null;
          anulada_por?: string | null;
          atualizado_em?: string;
          caixa_id: string;
          criado_em?: string;
          devolvido_em?: string | null;
          id?: string;
          motivo_anulacao?: string | null;
          origem?: string | null;
          valor: number;
        };
        Update: {
          acerto_id?: string;
          anulada_em?: string | null;
          anulada_por?: string | null;
          atualizado_em?: string;
          caixa_id?: string;
          criado_em?: string;
          devolvido_em?: string | null;
          id?: string;
          motivo_anulacao?: string | null;
          origem?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'faltas_acerto_id_fkey';
            columns: ['acerto_id'];
            isOneToOne: false;
            referencedRelation: 'acertos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faltas_anulada_por_fkey';
            columns: ['anulada_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faltas_caixa_id_fkey';
            columns: ['caixa_id'];
            isOneToOne: false;
            referencedRelation: 'caixas';
            referencedColumns: ['id'];
          },
        ];
      };
      impressoes: {
        Row: {
          atualizado_em: string;
          caixa_id: string | null;
          conteudo: string;
          criado_em: string;
          erro: string | null;
          estado: Database['public']['Enums']['estado_impressao'];
          id: string;
          impressa_em: string | null;
          impressora: string;
          noite_id: string | null;
          pedida_por: string | null;
          tentativas: number;
          tipo: Database['public']['Enums']['tipo_impressao'];
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          caixa_id?: string | null;
          conteudo: string;
          criado_em?: string;
          erro?: string | null;
          estado?: Database['public']['Enums']['estado_impressao'];
          id?: string;
          impressa_em?: string | null;
          impressora?: string;
          noite_id?: string | null;
          pedida_por?: string | null;
          tentativas?: number;
          tipo: Database['public']['Enums']['tipo_impressao'];
        };
        Update: {
          atualizado_em?: string;
          caixa_id?: string | null;
          conteudo?: string;
          criado_em?: string;
          erro?: string | null;
          estado?: Database['public']['Enums']['estado_impressao'];
          id?: string;
          impressa_em?: string | null;
          impressora?: string;
          noite_id?: string | null;
          pedida_por?: string | null;
          tentativas?: number;
          tipo?: Database['public']['Enums']['tipo_impressao'];
        };
        Relationships: [
          {
            foreignKeyName: 'impressoes_caixa_id_fkey';
            columns: ['caixa_id'];
            isOneToOne: false;
            referencedRelation: 'caixas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'impressoes_noite_id_fkey';
            columns: ['noite_id'];
            isOneToOne: false;
            referencedRelation: 'noites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'impressoes_pedida_por_fkey';
            columns: ['pedida_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      motoboys: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          id: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nome: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      noites: {
        Row: {
          aberta_em: string;
          aberta_por: string | null;
          atualizado_em: string;
          criado_em: string;
          data: string;
          fechada_em: string | null;
          fechada_por: string | null;
          id: string;
          promo_desconto: number | null;
        };
        ComputedFields: never;
        Insert: {
          aberta_em?: string;
          aberta_por?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          data: string;
          fechada_em?: string | null;
          fechada_por?: string | null;
          id?: string;
          promo_desconto?: number | null;
        };
        Update: {
          aberta_em?: string;
          aberta_por?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          data?: string;
          fechada_em?: string | null;
          fechada_por?: string | null;
          id?: string;
          promo_desconto?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'noites_aberta_por_fkey';
            columns: ['aberta_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'noites_fechada_por_fkey';
            columns: ['fechada_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      operacoes: {
        Row: {
          aparelho: string | null;
          atualizado_em: string;
          autor: string;
          codigo: string | null;
          criada_em: string | null;
          criado_em: string;
          dados: NonNullable<Json>;
          id: string;
          motivo: string | null;
          resultado: Json | null;
          status: string;
          tipo: string;
          versao_op: number | null;
        };
        ComputedFields: never;
        Insert: {
          aparelho?: string | null;
          atualizado_em?: string;
          autor: string;
          codigo?: string | null;
          criada_em?: string | null;
          criado_em?: string;
          dados: NonNullable<Json>;
          id: string;
          motivo?: string | null;
          resultado?: Json | null;
          status: string;
          tipo: string;
          versao_op?: number | null;
        };
        Update: {
          aparelho?: string | null;
          atualizado_em?: string;
          autor?: string;
          codigo?: string | null;
          criada_em?: string | null;
          criado_em?: string;
          dados?: NonNullable<Json>;
          id?: string;
          motivo?: string | null;
          resultado?: Json | null;
          status?: string;
          tipo?: string;
          versao_op?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'operacoes_autor_fkey';
            columns: ['autor'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      pagamentos: {
        Row: {
          anulado_em: string | null;
          anulado_por: string | null;
          atualizado_em: string;
          criado_em: string;
          forma: Database['public']['Enums']['forma_pagamento'];
          id: string;
          motivo_anulacao: string | null;
          noite_id: string;
          origem: Database['public']['Enums']['origem_pagamento'];
          pedido_id: string;
          pix_confirmado: boolean;
          pix_confirmado_em: string | null;
          pix_confirmado_por: string | null;
          real: boolean;
          referencia_externa: string | null;
          registrado_em: string;
          saida_id: string | null;
          troco_pix: number;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          anulado_em?: string | null;
          anulado_por?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          forma: Database['public']['Enums']['forma_pagamento'];
          id?: string;
          motivo_anulacao?: string | null;
          noite_id: string;
          origem?: Database['public']['Enums']['origem_pagamento'];
          pedido_id: string;
          pix_confirmado?: boolean;
          pix_confirmado_em?: string | null;
          pix_confirmado_por?: string | null;
          real?: boolean;
          referencia_externa?: string | null;
          registrado_em?: string;
          saida_id?: string | null;
          troco_pix?: number;
          valor: number;
        };
        Update: {
          anulado_em?: string | null;
          anulado_por?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          forma?: Database['public']['Enums']['forma_pagamento'];
          id?: string;
          motivo_anulacao?: string | null;
          noite_id?: string;
          origem?: Database['public']['Enums']['origem_pagamento'];
          pedido_id?: string;
          pix_confirmado?: boolean;
          pix_confirmado_em?: string | null;
          pix_confirmado_por?: string | null;
          real?: boolean;
          referencia_externa?: string | null;
          registrado_em?: string;
          saida_id?: string | null;
          troco_pix?: number;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pagamentos_anulado_por_fkey';
            columns: ['anulado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_noite_id_fkey';
            columns: ['noite_id'];
            isOneToOne: false;
            referencedRelation: 'noites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_pix_confirmado_por_fkey';
            columns: ['pix_confirmado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_saida_id_fkey';
            columns: ['saida_id'];
            isOneToOne: false;
            referencedRelation: 'saidas';
            referencedColumns: ['id'];
          },
        ];
      };
      pedidos: {
        Row: {
          area_id: string | null;
          atualizado_em: string;
          atualizado_por: string | null;
          codigo: string;
          criado_em: string;
          criado_por: string | null;
          estado: Database['public']['Enums']['estado_pedido'];
          id: string;
          noite_id: string;
          obs: string | null;
          origem: Database['public']['Enums']['origem_pedido'];
          promocao: boolean;
          tipo: Database['public']['Enums']['tipo_pedido'];
          total: number;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          atualizado_em?: string;
          atualizado_por?: string | null;
          codigo: string;
          criado_em?: string;
          criado_por?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          id?: string;
          noite_id: string;
          obs?: string | null;
          origem: Database['public']['Enums']['origem_pedido'];
          promocao?: boolean;
          tipo?: Database['public']['Enums']['tipo_pedido'];
          total: number;
          versao?: number;
        };
        Update: {
          area_id?: string | null;
          atualizado_em?: string;
          atualizado_por?: string | null;
          codigo?: string;
          criado_em?: string;
          criado_por?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          id?: string;
          noite_id?: string;
          obs?: string | null;
          origem?: Database['public']['Enums']['origem_pedido'];
          promocao?: boolean;
          tipo?: Database['public']['Enums']['tipo_pedido'];
          total?: number;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pedidos_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_atualizado_por_fkey';
            columns: ['atualizado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_noite_id_fkey';
            columns: ['noite_id'];
            isOneToOne: false;
            referencedRelation: 'noites';
            referencedColumns: ['id'];
          },
        ];
      };
      perfis: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          id: string;
          nome: string;
          papeis: Database['public']['Enums']['papel'][];
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          id: string;
          nome: string;
          papeis: Database['public']['Enums']['papel'][];
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
          papeis?: Database['public']['Enums']['papel'][];
        };
        Relationships: [];
      };
      saidas: {
        Row: {
          area_id: string;
          atualizado_em: string;
          caixa_id: string;
          cancelada_em: string | null;
          cancelada_por: string | null;
          criado_em: string;
          entregue_em: string | null;
          estado: Database['public']['Enums']['estado_saida'];
          id: string;
          motivo_cancelamento: string | null;
          motoboy_id: string;
          noite_id: string;
          papel_conferido: boolean;
          pedido_id: string;
          saiu_em: string | null;
          taxa: number;
          voltou_em: string | null;
        };
        ComputedFields: never;
        Insert: {
          area_id: string;
          atualizado_em?: string;
          caixa_id: string;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          criado_em?: string;
          entregue_em?: string | null;
          estado?: Database['public']['Enums']['estado_saida'];
          id?: string;
          motivo_cancelamento?: string | null;
          motoboy_id: string;
          noite_id: string;
          papel_conferido?: boolean;
          pedido_id: string;
          saiu_em?: string | null;
          taxa: number;
          voltou_em?: string | null;
        };
        Update: {
          area_id?: string;
          atualizado_em?: string;
          caixa_id?: string;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          criado_em?: string;
          entregue_em?: string | null;
          estado?: Database['public']['Enums']['estado_saida'];
          id?: string;
          motivo_cancelamento?: string | null;
          motoboy_id?: string;
          noite_id?: string;
          papel_conferido?: boolean;
          pedido_id?: string;
          saiu_em?: string | null;
          taxa?: number;
          voltou_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'saidas_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saidas_caixa_id_fkey';
            columns: ['caixa_id'];
            isOneToOne: false;
            referencedRelation: 'caixas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saidas_cancelada_por_fkey';
            columns: ['cancelada_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saidas_motoboy_id_fkey';
            columns: ['motoboy_id'];
            isOneToOne: false;
            referencedRelation: 'motoboys';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saidas_noite_id_fkey';
            columns: ['noite_id'];
            isOneToOne: false;
            referencedRelation: 'noites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saidas_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
        ];
      };
      sobras: {
        Row: {
          acerto_id: string;
          anulada_em: string | null;
          anulada_por: string | null;
          atualizado_em: string;
          caixa_id: string;
          criado_em: string;
          id: string;
          motivo_anulacao: string | null;
          origem: string | null;
          resolvida_em: string | null;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          acerto_id: string;
          anulada_em?: string | null;
          anulada_por?: string | null;
          atualizado_em?: string;
          caixa_id: string;
          criado_em?: string;
          id?: string;
          motivo_anulacao?: string | null;
          origem?: string | null;
          resolvida_em?: string | null;
          valor: number;
        };
        Update: {
          acerto_id?: string;
          anulada_em?: string | null;
          anulada_por?: string | null;
          atualizado_em?: string;
          caixa_id?: string;
          criado_em?: string;
          id?: string;
          motivo_anulacao?: string | null;
          origem?: string | null;
          resolvida_em?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sobras_acerto_id_fkey';
            columns: ['acerto_id'];
            isOneToOne: false;
            referencedRelation: 'acertos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sobras_anulada_por_fkey';
            columns: ['anulada_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sobras_caixa_id_fkey';
            columns: ['caixa_id'];
            isOneToOne: false;
            referencedRelation: 'caixas';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      aplicar_operacao: { Args: { op: Json }; Returns: Json };
      area_sugerida: { Args: { p_codigo: string }; Returns: string };
      registrar_erro: { Args: { p_erro: Json }; Returns: undefined };
    };
    Enums: {
      ambiente: 'producao' | 'teste';
      estado_impressao: 'pendente' | 'imprimindo' | 'impresso' | 'erro';
      estado_pedido: 'aberto' | 'entregue' | 'cancelado';
      estado_saida: 'separada' | 'em_rota' | 'entregue' | 'voltou';
      forma_pagamento: 'dinheiro' | 'cartao' | 'pix_maquininha' | 'pix_antecipado';
      origem_pagamento: 'manual' | 'webhook' | 'maquininha';
      origem_pedido: 'papel' | 'whatsapp' | 'balcao' | 'mesa' | 'link';
      papel: 'admin' | 'gerente' | 'expedicao' | 'atendente' | 'motoboy' | 'cozinha' | 'garcom' | 'agente';
      tipo_impressao: 'recibo_acerto' | 'folha_noite';
      tipo_pedido: 'entrega' | 'retirada' | 'mesa';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ambiente: ['producao', 'teste'],
      estado_impressao: ['pendente', 'imprimindo', 'impresso', 'erro'],
      estado_pedido: ['aberto', 'entregue', 'cancelado'],
      estado_saida: ['separada', 'em_rota', 'entregue', 'voltou'],
      forma_pagamento: ['dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado'],
      origem_pagamento: ['manual', 'webhook', 'maquininha'],
      origem_pedido: ['papel', 'whatsapp', 'balcao', 'mesa', 'link'],
      papel: ['admin', 'gerente', 'expedicao', 'atendente', 'motoboy', 'cozinha', 'garcom', 'agente'],
      tipo_impressao: ['recibo_acerto', 'folha_noite'],
      tipo_pedido: ['entrega', 'retirada', 'mesa'],
    },
  },
} as const;
