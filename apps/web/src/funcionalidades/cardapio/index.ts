import type { FichaModulo } from '../../compartilhado/modulo';
import { Cardapio } from './Cardapio';

/** Cardápio (F2, 2a): preços e itens pela gerente; "acabou hoje" pela equipe do balcão. */
export const cardapio: FichaModulo = {
  nome: 'cardapio',
  rotas: [{ caminho: '/gerente/cardapio', Tela: Cardapio }],
  papeis: ['admin', 'gerente', 'expedicao', 'atendente'],
  menu: { rotulo: 'Cardápio', caminho: '/gerente/cardapio' },
};
