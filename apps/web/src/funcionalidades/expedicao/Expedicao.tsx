// /expedicao: painel do Luan (etapa 4).
import type { Perfil } from '../../data/repo';

export function Expedicao({ perfil }: { perfil: Perfil }) {
  return <p className="p-6 text-apagado">Painel da expedição, {perfil.nome}: em construção.</p>;
}
