// /expedicao: painel do Luan (papéis expedicao, gerente e admin).
import { dataDaNoite, formatarData } from '@mel/dominio';
import { useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router';
import { mostrarAviso } from '../../compartilhado/avisos';
import { IndicadorFila } from '../../compartilhado/status';
import { Botao, Chip, DoisToques, Folha as FolhaQueSobe } from '../../compartilhado/ui';
import { acoes, type Perfil, sair, useConfig, useDadosNoite, useMotoboys, useNoite, usePerfis } from '../../data/repo';
import { AcertoLuan } from './AcertoLuan';
import { Despacho } from './Despacho';
import { FecharNoite } from './FecharNoite';
import { Folha } from './Folha';
import { LancarComanda } from './LancarComanda';
import { NoitesAntigas } from './NoitesAntigas';
import { PromocaoDaNoite } from './PromocaoDaNoite';
import { Resumo } from './Resumo';

const linkNoites = 'flex min-h-12 items-center justify-center rounded-xl border border-borda bg-cartao font-semibold';

function Topo({ titulo }: { titulo: string }) {
  return (
    <header className="sticky top-[var(--faixa)] z-30 flex items-center justify-between gap-2 border-b border-borda bg-fundo/95 px-3 py-2 backdrop-blur">
      <span className="font-semibold">{titulo}</span>
      <IndicadorFila />
    </header>
  );
}

export function Expedicao({ perfil }: { perfil: Perfil }) {
  const noite = useNoite();
  const dados = useDadosNoite(noite?.id);
  const perfis = usePerfis();
  const motoboys = useMotoboys();
  const nomeMotoboy = (id: string) => motoboys.find((m) => m.id === id)?.nome ?? '?';
  const cfg = useConfig();
  const [lancando, setLancando] = useState(false);
  const [fechando, setFechando] = useState(false);

  if (noite === undefined || dados === undefined) return <Topo titulo="Painel" />;

  const hoje = dataDaNoite(new Date(), cfg?.fuso);
  const aberta = noite && !noite.fechada_em ? noite : null;

  const noites = <NoitesAntigas nomeMotoboy={nomeMotoboy} />;

  if (!aberta) {
    return (
      <>
        <Topo titulo="Painel" />
        <Routes>
          <Route path="noites/*" element={noites} />
          <Route
            path="*"
            element={
              <div className="flex flex-col gap-3 p-4">
                {noite && <p className="text-apagado">A noite de {formatarData(noite.data)} foi fechada.</p>}
                {noite?.data === hoje ? (
                  perfil.papeis.includes('admin') && (
                    <DoisToques rotulo="Reabrir a noite" aoConfirmar={() => void acoes.reabrirNoite(noite.id)} />
                  )
                ) : (
                  <Botao variante="principal" className="min-h-14 text-lg" onClick={() => void acoes.abrirNoite()}>
                    Abrir a noite de {formatarData(hoje)}
                  </Botao>
                )}
                <Link to="noites" className={linkNoites}>
                  Noites antigas
                </Link>
                <Botao variante="fantasma" onClick={() => void sair(true)}>
                  Sair
                </Botao>
              </div>
            }
          />
        </Routes>
      </>
    );
  }

  const comCaixa = new Set(dados.caixas.map((c) => c.motoboy_id));
  // Decisão 0007: o motoboy é um cadastro; a chegada abre o caixa dele.
  const semCaixa = motoboys.filter((m) => m.ativo && !comCaixa.has(m.id));
  const semAcerto = dados.caixas.filter((c) => !dados.acertos.some((a) => a.caixa_id === c.id));
  const caixasAbertos = semAcerto.map((c) => ({ id: c.id, nome: nomeMotoboy(c.motoboy_id) }));
  // ERROS-PREVISTOS: a noite de ontem ficou aberta. Fechar (vendo os pendentes) libera abrir a de hoje.
  const deOntem = aberta.data !== hoje;

  return (
    <>
      <Topo titulo={`Noite de ${formatarData(aberta.data)}`} />
      <Routes>
        <Route
          index
          element={
            <div className="flex flex-col">
              {deOntem && (
                <div className="m-3 flex flex-col gap-2 rounded-xl bg-amber-950 px-3 py-2 text-aviso">
                  <span>A noite de {formatarData(aberta.data)} ainda está aberta.</span>
                  <Botao onClick={() => setFechando(true)}>Ver pendentes e fechar</Botao>
                </div>
              )}
              {!deOntem && <PromocaoDaNoite noite={aberta} />}
              <Despacho dados={dados} caixas={caixasAbertos} />
              {semCaixa.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
                  <span className="text-sm text-apagado">Chegou:</span>
                  {/* ACE7: a ordem de chegada é a ordem em que o Luan toca. */}
                  {semCaixa.map((m) => (
                    <Chip
                      key={m.id}
                      onClick={() => {
                        void acoes.abrirCaixa(aberta.id, m.id);
                        mostrarAviso(`Caixa de ${m.nome} aberto com R$ 80 e diária de R$ 30`);
                      }}
                    >
                      + {m.nome}
                    </Chip>
                  ))}
                </div>
              )}
              {dados.caixas.length === 0 ? (
                <p className="p-6 text-center text-apagado">Toque no nome de cada motoboy na ordem em que chegou.</p>
              ) : (
                <Folha noite={aberta} dados={dados} nomeMotoboy={nomeMotoboy} />
              )}
              {semAcerto.length > 0 && (
                <Botao className="mx-3" onClick={() => setLancando(true)}>
                  Lançar comanda de papel
                </Botao>
              )}
              <FolhaQueSobe aberta={lancando} aoFechar={() => setLancando(false)} titulo="Lançar comanda de papel">
                {lancando && <LancarComanda caixas={caixasAbertos} pedidosDaNoite={dados.pedidos} />}
              </FolhaQueSobe>
              <div className="grid grid-cols-2 gap-2 p-3">
                <Link
                  to="resumo"
                  className="flex min-h-12 items-center justify-center rounded-xl border border-borda bg-cartao font-semibold"
                >
                  Resumo da noite
                </Link>
                <Link to="noites" className={`${linkNoites} col-span-2 sm:col-span-1`}>
                  Noites antigas
                </Link>
                <Botao onClick={() => setFechando(true)}>Fechar a noite</Botao>
              </div>
              <FolhaQueSobe
                aberta={fechando}
                aoFechar={() => setFechando(false)}
                titulo={`Fechar a noite de ${formatarData(aberta.data)}`}
              >
                {fechando && (
                  <FecharNoite
                    noite={aberta}
                    dados={dados}
                    nomeMotoboy={nomeMotoboy}
                    aoFechar={() => setFechando(false)}
                  />
                )}
              </FolhaQueSobe>
              <Botao variante="fantasma" className="mx-3" onClick={() => void sair(true)}>
                Sair
              </Botao>
            </div>
          }
        />
        <Route
          path="caixa/:caixaId"
          element={<AcertoLuan dados={dados} perfis={perfis} perfil={perfil} nomeMotoboy={nomeMotoboy} />}
        />
        <Route path="resumo" element={<Resumo noite={aberta} dados={dados} nomeMotoboy={nomeMotoboy} />} />
        <Route path="noites/*" element={noites} />
        <Route path="*" element={<Navigate to="/expedicao" replace />} />
      </Routes>
    </>
  );
}
