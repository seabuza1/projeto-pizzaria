// /motoboy: topo fino com Devolver, Maquininha e Receber; barra inferior com Noite, Acerto e Histórico.
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { IndicadorFila } from '../../compartilhado/status';
import { Botao, reais } from '../../compartilhado/ui';
import { type Perfil, sair } from '../../data/repo';
import { AcertoMotoboy } from '../acerto/AcertoMotoboy';
import { Historico } from '../historico/Historico';
import { Noite } from '../noite/Noite';
import { useCaixaDoMotoboy } from './usar-caixa';

function Aba({ para, rotulo }: { para: string; rotulo: string }) {
  return (
    <NavLink
      to={para}
      end
      className={({ isActive }) =>
        `flex min-h-14 flex-1 items-center justify-center font-semibold ${isActive ? 'text-mel' : 'text-apagado'}`
      }
    >
      {rotulo}
    </NavLink>
  );
}

function Ajustes({ perfil }: { perfil: Perfil }) {
  return (
    <div className="flex flex-col gap-2 border-t border-borda p-3">
      <p className="text-sm text-apagado">Entrou como {perfil.nome}.</p>
      <Botao
        variante="fantasma"
        onClick={() =>
          void sair().then((r) => {
            if (r === 'pendente') void sair(true);
          })
        }
      >
        Sair
      </Botao>
    </div>
  );
}

export function Motoboy({ perfil }: { perfil: Perfil }) {
  const caixa = useCaixaDoMotoboy(perfil.id);
  const c = caixa.estado === 'pronto' ? caixa.c : null;
  const conta = c?.conta ?? null;

  return (
    <div className="flex min-h-dvh flex-col pb-16">
      <header className="sticky top-[var(--faixa)] z-30 grid grid-cols-3 gap-1 border-b border-borda bg-fundo/95 px-3 py-2 backdrop-blur">
        {(
          [
            ['Devolver', conta?.devolver],
            ['Maquininha', conta?.maquininha],
            ['Receber', conta?.receber],
          ] as const
        ).map(([rotulo, valor]) => (
          <div key={rotulo} className="flex flex-col">
            <span className="text-xs text-apagado">{rotulo}</span>
            <span className="numero text-lg font-semibold">{valor === undefined ? '—' : reais(valor)}</span>
          </div>
        ))}
        <div className="col-span-3">
          <IndicadorFila />
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route
            index
            element={
              c ? (
                <Noite c={c} />
              ) : (
                <p className="p-6 text-center text-apagado">
                  {caixa.estado === 'carregando'
                    ? 'Carregando…'
                    : 'Sem caixa aberto hoje. Peça ao Luan para abrir o seu caixa.'}
                </p>
              )
            }
          />
          <Route
            path="acerto"
            element={c ? <AcertoMotoboy c={c} /> : <p className="p-6 text-apagado">Sem caixa hoje.</p>}
          />
          <Route
            path="historico"
            element={
              <>
                <Historico motoboyId={perfil.id} />
                <Ajustes perfil={perfil} />
              </>
            }
          />
          <Route path="*" element={<Navigate to="/motoboy" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-borda bg-fundo">
        <Aba para="/motoboy" rotulo="Noite" />
        <Aba para="/motoboy/acerto" rotulo="Acerto" />
        <Aba para="/motoboy/historico" rotulo="Histórico" />
      </nav>
    </div>
  );
}
