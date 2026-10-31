import type { FichaModulo } from '../../compartilhado/modulo';
import { Atendimento } from './Atendimento';

/** Tela de pedido do atendimento (F2, 2b e 2e): telefone, itens, entrega, pagamento, resumo e autorização. */
export const atendimento: FichaModulo = {
  nome: 'atendimento',
  rotas: [{ caminho: '/atendimento', Tela: Atendimento }],
  papeis: ['admin', 'gerente', 'expedicao', 'atendente'],
  menu: { rotulo: 'Atendimento', caminho: '/atendimento' },
};
