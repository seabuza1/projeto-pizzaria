// A lista de módulos (PADROES, Módulos removíveis). Pôr ou tirar um módulo é uma linha.
import type { FichaModulo } from '../compartilhado/modulo';
import { expedicao } from './expedicao';

export const modulos: readonly FichaModulo[] = [expedicao];
