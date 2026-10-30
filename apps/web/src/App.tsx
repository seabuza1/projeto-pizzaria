// Entrada do app: sessão, faixas fixas e rotas por papel.
import type { ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { AvisoBloqueio, FaixaTeste, RodapeAvisos } from './compartilhado/status';
import { type Perfil, useAppDesatualizado, useSessao } from './data/repo';
import { CodigoMfa, Entrar } from './funcionalidades/entrar/Entrar';
import { Motoboy } from './funcionalidades/motoboy/Motoboy';

const ehEquipe = (p: Perfil) => p.papeis.some((x) => x === 'admin' || x === 'gerente' || x === 'expedicao');
const ehMotoboy = (p: Perfil) => p.papeis.includes('motoboy');

/** Quem tem mais de um papel (o Felipe é admin e motoboy) troca de tela por aqui. */
function TrocaDePapel({ perfil }: { perfil: Perfil }) {
  if (!(ehEquipe(perfil) && ehMotoboy(perfil))) return null;
  const link = ({ isActive }: { isActive: boolean }) =>
    `min-h-12 flex-1 py-3 text-center text-sm ${isActive ? 'text-mel' : 'text-apagado'}`;
  return (
    <div className="flex border-b border-borda">
      <NavLink to="/motoboy" className={link}>
        Meu caixa
      </NavLink>
      <NavLink to="/expedicao" className={link}>
        Painel
      </NavLink>
    </div>
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

export function App({ expedicao }: { expedicao: (perfil: Perfil) => ReactNode }) {
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

  const { perfil } = sessao;
  const inicio = ehEquipe(perfil) ? '/expedicao' : ehMotoboy(perfil) ? '/motoboy' : '/sem-acesso';
  return (
    <Moldura>
      <TrocaDePapel perfil={perfil} />
      <Routes>
        {ehMotoboy(perfil) && <Route path="/motoboy/*" element={<Motoboy perfil={perfil} />} />}
        {ehEquipe(perfil) && <Route path="/expedicao/*" element={expedicao(perfil)} />}
        <Route
          path="/sem-acesso"
          element={<p className="p-6 text-center text-apagado">Esta conta não usa o app. Fale com o admin.</p>}
        />
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Routes>
    </Moldura>
  );
}
