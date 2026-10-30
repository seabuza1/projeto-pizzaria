// O caixa do motoboy logado na noite atual, com a conta pronta (as telas não fazem conta).
import type { ContaAcerto } from '@mel/dominio';
import { useMemo } from 'react';
import {
  type Acerto,
  type Caixa,
  contaDoCaixa,
  type DadosNoite,
  type Noite,
  type Pedido,
  type Saida,
  useDadosNoite,
  useNoite,
} from '../../data/repo';

export interface CaixaDoMotoboy {
  noite: Noite;
  caixa: Caixa;
  dados: DadosNoite;
  acerto: Acerto | undefined;
  /** Saídas do caixa que valem (sem as canceladas), na ordem em que saíram. */
  saidas: Saida[];
  pedidos: Map<string, Pedido>;
  conta: ContaAcerto;
  /** ACE9: acerto confirmado ou noite fechada. */
  travado: boolean;
}

export type EstadoDoCaixa =
  | { estado: 'carregando' }
  | { estado: 'sem_caixa' }
  | { estado: 'pronto'; c: CaixaDoMotoboy };

export function useCaixaDoMotoboy(motoboyId: string): EstadoDoCaixa {
  const noite = useNoite();
  const dados = useDadosNoite(noite?.id);
  return useMemo((): EstadoDoCaixa => {
    if (noite === undefined || dados === undefined) return { estado: 'carregando' };
    const caixa = dados.caixas.find((c) => c.motoboy_id === motoboyId);
    if (!noite || !caixa) return { estado: 'sem_caixa' };
    const acerto = dados.acertos.find((a) => a.caixa_id === caixa.id);
    return {
      estado: 'pronto',
      c: {
        noite,
        caixa,
        dados,
        acerto,
        saidas: dados.saidas.filter((s) => s.caixa_id === caixa.id && !s.cancelada_em),
        pedidos: new Map(dados.pedidos.map((p) => [p.id, p])),
        conta: contaDoCaixa(caixa, dados),
        travado: Boolean(acerto) || Boolean(noite.fechada_em),
      },
    };
  }, [noite, dados, motoboyId]);
}
