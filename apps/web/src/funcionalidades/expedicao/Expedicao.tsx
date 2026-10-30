// /expedicao: painel do Luan (papéis expedicao, gerente e admin).
import { dataDaNoite, formatarData } from '@mel/dominio';
import { Link, Navigate, Route, Routes } from 'react-router';
import { mostrarAviso } from '../../compartilhado/avisos';
import { IndicadorFila } from '../../compartilhado/status';
import { Botao, Chip, DoisToques } from '../../compartilhado/ui';
import { acoes, type Perfil, sair, useConfig, useDadosNoite, useNoite, usePerfis } from '../../data/repo';
import { AcertoLuan } from '../acerto/AcertoLuan';
import { Folha } from './Folha';
import { Resumo } from './Resumo';

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
  const cfg = useConfig();

  if (noite === undefined || dados === undefined) return <Topo titulo="Painel" />;

  const hoje = dataDaNoite(new Date(), cfg?.fuso);
  const aberta = noite && !noite.fechada_em ? noite : null;

  if (!aberta) {
    return (
      <>
        <Topo titulo="Painel" />
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
          <Botao variante="fantasma" onClick={() => void sair(true)}>
            Sair
          </Botao>
        </div>
      </>
    );
  }

  const comCaixa = new Set(dados.caixas.map((c) => c.motoboy_id));
  const semCaixa = perfis.filter((p) => p.ativo && p.papeis.includes('motoboy') && !comCaixa.has(p.id));
  const pendentes = dados.caixas.filter((c) => !dados.acertos.some((a) => a.caixa_id === c.id)).length;

  return (
    <>
      <Topo titulo={`Noite de ${formatarData(aberta.data)}`} />
      <Routes>
        <Route
          index
          element={
            <div className="flex flex-col">
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
                <Folha noite={aberta} dados={dados} perfis={perfis} />
              )}
              <div className="grid grid-cols-2 gap-2 p-3">
                <Link
                  to="resumo"
                  className="flex min-h-12 items-center justify-center rounded-xl border border-borda bg-cartao font-semibold"
                >
                  Resumo da noite
                </Link>
                <DoisToques
                  rotulo="Fechar a noite"
                  confirmar={pendentes > 0 ? `${pendentes} sem acerto. Fechar?` : 'Toque de novo para fechar'}
                  aoConfirmar={() => void acoes.fecharNoite(aberta.id)}
                />
              </div>
              <Botao variante="fantasma" className="mx-3" onClick={() => void sair(true)}>
                Sair
              </Botao>
            </div>
          }
        />
        <Route path="caixa/:caixaId" element={<AcertoLuan dados={dados} perfis={perfis} perfil={perfil} />} />
        <Route path="resumo" element={<Resumo noite={aberta} dados={dados} perfis={perfis} />} />
        <Route path="*" element={<Navigate to="/expedicao" replace />} />
      </Routes>
    </>
  );
}
