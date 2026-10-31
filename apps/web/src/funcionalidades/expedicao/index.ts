import type { FichaModulo } from '../../compartilhado/modulo';
import { Expedicao } from './Expedicao';

/** Painel do Luan: folha, acerto, coluna PIX e resumo da noite (F1). */
export const expedicao: FichaModulo = {
  nome: 'expedicao',
  rotas: [{ caminho: '/expedicao/*', Tela: Expedicao }],
  papeis: ['admin', 'gerente', 'expedicao'],
  menu: { rotulo: 'Painel', caminho: '/expedicao' },
};
