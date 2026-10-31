import type { FichaModulo } from '../../compartilhado/modulo';
import { Motoboys } from './Motoboys';

/** Cadastro de motoboys (F1): nome e ativo. O motoboy não usa o sistema (decisão 0007). */
export const motoboys: FichaModulo = {
  nome: 'motoboys',
  rotas: [{ caminho: '/motoboys', Tela: Motoboys }],
  papeis: ['admin', 'gerente'],
  menu: { rotulo: 'Motoboys', caminho: '/motoboys' },
};
