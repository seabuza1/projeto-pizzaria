// Entrada do app: sessão, faixas fixas e as rotas e o menu montados a partir da lista de módulos.
import type { ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { AvisoImpressora } from './compartilhado/AvisoImpressora';
import type { FichaModulo } from './compartilhado/modulo';
import { RelatarProblema } from './compartilhado/RelatarProblema';
import { AvisoBloqueio, FaixaTeste, RodapeAvisos } from './compartilhado/status';
import { type Perfil, useAppDesatualizado, useConfig, useSessao } from './data/repo';
import { modulos } from './funcionalidades';
import { CodigoMfa, Entrar } from './sessao/Entrar';

/** Módulos que a pessoa vê: ligados em config (OPE1) e de um papel que ela tem. */
function useMeusModulos(perfil: Perfil): readonly FichaModulo[] {
  const desligados = new Set(useConfig()?.funcionalidades_desligadas ?? []);
  return modulos.filter((m) => !desligados.has(m.nome) && m.papeis.some((p) => perfil.papeis.includes(p)));
}

/** Quem tem mais de um módulo troca de tela por aqui. */
function Menu({ meus }: { meus: readonly FichaModulo[] }) {
  if (meus.length < 2) return null;
  const link = ({ isActive }: { isActive: boolean }) =>
    `min-h-12 flex-1 py-3 text-center text-sm ${isActive ? 'text-mel' : 'text-apagado'}`;
  return (
    <nav className="flex border-b border-borda">
      {meus.map((m) => (
        <NavLink key={m.nome} to={m.menu.caminho} className={link}>
          {m.menu.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

function AvisoAtualizar() {
  if (!useAppDesatualizado()) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-amber-950 px-4 py-2 text-sm text-aviso">
      <span>Este app está antigo. O que você lançou já foi guardado.</span>
      <button type="button" className="min-h-12 font-semibold underline" onClick={() => location.reload()}>
        Atualizar
      </button>
    </div>
  );
}

function Moldura({ children }: { children: ReactNode }) {
  return (
    <>
      <FaixaTeste />
      <AvisoAtualizar />
      <AvisoBloqueio />
      {children}
      <RodapeAvisos />
    </>
  );
}

function Dentro({ perfil }: { perfil: Perfil }) {
  const meus = useMeusModulos(perfil);
  const inicio = meus[0]?.menu.caminho ?? '/sem-acesso';
  // Quem é do balcão imprime: vê quando a impressora para de responder.
  const balcao = perfil.papeis.some((p) => p === 'admin' || p === 'gerente' || p === 'expedicao' || p === 'atendente');
  return (
    <>
      {balcao && <AvisoImpressora />}
      <Menu meus={meus} />
      <Routes>
        {meus.flatMap((m) =>
          m.rotas.map((r) => (
            <Route key={`${m.nome}${r.caminho}`} path={r.caminho} element={<r.Tela perfil={perfil} />} />
          )),
        )}
        <Route
          path="/sem-acesso"
          element={<p className="p-6 text-center text-apagado">Esta conta não usa o app. Fale com o admin.</p>}
        />
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Routes>
      <RelatarProblema />
    </>
  );
}

export function App() {
  const sessao = useSessao();
  if (sessao.estado === 'carregando') return <Moldura>{null}</Moldura>;
  if (sessao.estado === 'fora')
    return (
      <Moldura>
        <Entrar erroInicial={sessao.erro} />
      </Moldura>
    );
  if (sessao.estado === 'mfa' || sessao.estado === 'cadastrar_mfa')
    return (
      <Moldura>
        <CodigoMfa sessao={sessao} />
      </Moldura>
    );
  return (
    <Moldura>
      <Dentro perfil={sessao.perfil} />
    </Moldura>
  );
}
