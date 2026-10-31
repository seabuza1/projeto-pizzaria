// A lista de módulos (PADROES, Módulos removíveis). Pôr ou tirar um módulo é uma linha.
import type { FichaModulo } from '../compartilhado/modulo';
import { cardapio } from './cardapio';
import { expedicao } from './expedicao';
import { motoboys } from './motoboys';

export const modulos: readonly FichaModulo[] = [expedicao, cardapio, motoboys];
