// Ficha de um módulo (PADROES, Módulos removíveis; decisão 0008).
import type { ComponentType } from 'react';
import type { Perfil } from '../data/repo';

export type Papel = Perfil['papeis'][number];

export interface FichaModulo {
  /** Igual ao nome da pasta e ao valor em config.funcionalidades_desligadas. */
  nome: string;
  /** Rotas do módulo; as internas ficam dentro dele (caminho com /*). */
  rotas: readonly { caminho: string; Tela: ComponentType<{ perfil: Perfil }> }[];
  /** Quem vê o módulo: basta ter um destes papéis. */
  papeis: readonly Papel[];
  /** Item do menu de troca de tela (quem tem mais de um módulo). */
  menu: { rotulo: string; caminho: string };
}
