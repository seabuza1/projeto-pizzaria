// Aba Acerto do motoboy: a conta detalhada e o estado ("Aguardando o Luan" ou confirmado).
import { formatarHora } from '@mel/dominio';
import { ContaDetalhada } from '../../compartilhado/ContaDetalhada';
import { useConfig, usePerfis } from '../../data/repo';
import type { CaixaDoMotoboy } from './usar-caixa';

export function AcertoMotoboy({ c }: { c: CaixaDoMotoboy }) {
  const perfis = usePerfis();
  const cfg = useConfig();
  const quem = perfis.find((p) => p.id === c.acerto?.confirmado_por)?.nome ?? 'Luan';

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className={`rounded-xl px-3 py-2 ${c.acerto ? 'bg-green-950 text-ok' : 'bg-cartao text-apagado'}`}>
        {c.acerto
          ? `Confirmado por ${quem} às ${formatarHora(c.acerto.confirmado_em, cfg?.fuso)}`
          : 'Aguardando o Luan'}
      </p>
      <ContaDetalhada conta={c.conta} paraMotoboy />
    </div>
  );
}
