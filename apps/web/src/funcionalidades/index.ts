// A lista de módulos (PADROES, Módulos removíveis). Pôr ou tirar um módulo é uma linha.
// A ordem é a do menu; o primeiro que a pessoa pode usar é a tela inicial.
import type { FichaModulo } from '../compartilhado/modulo';
import { atendimento } from './atendimento';
import { cardapio } from './cardapio';
import { expedicao } from './expedicao';
import { motoboys } from './motoboys';

export const modulos: readonly FichaModulo[] = [expedicao, atendimento, cardapio, motoboys];
