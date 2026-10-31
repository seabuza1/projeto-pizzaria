// Noites antigas (F1): só leitura, com a folha, o resumo e a exportação em CSV. Precisa de internet.
import { formatarData } from '@mel/dominio';
import { Link, Route, Routes, useParams } from 'react-router';
import { useNoiteAntiga, useNoitesFechadas } from '../../data/repo';
import { Folha } from './Folha';
import { Resumo } from './Resumo';

const SEM_INTERNET = 'Sem internet: as noites antigas ficam no servidor.';

function Lista() {
  const noites = useNoitesFechadas();
  return (
    <div className="flex flex-col gap-2 p-3">
      <Link to="/expedicao" className="min-h-12 py-3 text-apagado">
        ← Painel
      </Link>
      {noites === undefined && <p className="text-apagado">Carregando…</p>}
      {noites === 'sem_internet' && <p className="text-aviso">{SEM_INTERNET}</p>}
      {Array.isArray(noites) && noites.length === 0 && <p className="text-apagado">Nenhuma noite fechada ainda.</p>}
      {Array.isArray(noites) &&
        noites.map((n) => (
          <Link
            key={n.id}
            to={n.id}
            className="flex min-h-12 items-center justify-between rounded-xl border border-borda bg-cartao px-3"
          >
            <span className="numero">{formatarData(n.data)}</span>
            <span className="text-apagado">›</span>
          </Link>
        ))}
    </div>
  );
}

function Detalhe({ nomeMotoboy }: { nomeMotoboy: (id: string) => string }) {
  const { noiteId } = useParams();
  const antiga = useNoiteAntiga(noiteId);
  if (antiga === undefined) return <p className="p-6 text-apagado">Carregando…</p>;
  if (antiga === 'sem_internet') return <p className="p-6 text-aviso">{SEM_INTERNET}</p>;
  const { noite, dados } = antiga;
  return (
    <div className="flex flex-col">
      <h2 className="px-3 pt-3 font-semibold">Noite de {formatarData(noite.data)} (só leitura)</h2>
      <Folha noite={noite} dados={dados} nomeMotoboy={nomeMotoboy} somenteLeitura />
      <Resumo noite={noite} dados={dados} nomeMotoboy={nomeMotoboy} voltar="← Noites antigas" />
    </div>
  );
}

export function NoitesAntigas({ nomeMotoboy }: { nomeMotoboy: (id: string) => string }) {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path=":noiteId" element={<Detalhe nomeMotoboy={nomeMotoboy} />} />
    </Routes>
  );
}
