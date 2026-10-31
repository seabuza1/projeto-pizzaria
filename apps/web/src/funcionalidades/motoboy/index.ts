import type { FichaModulo } from '../../compartilhado/modulo';
import { Motoboy } from './Motoboy';

/** App do motoboy (sai na etapa 4, decisão 0007). */
export const motoboy: FichaModulo = {
  nome: 'motoboy',
  rotas: [{ caminho: '/motoboy/*', Tela: Motoboy }],
  papeis: ['motoboy'],
  menu: { rotulo: 'Meu caixa', caminho: '/motoboy' },
};
