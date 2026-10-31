// Histórico do motoboy: por noite e por período (semana e mês), noite antiga só para ler, e CSV.
import {
  agruparPorCidade,
  type ContaAcerto,
  dataDaNoite,
  filtrarPeriodo,
  formatarData,
  historicoCsv,
  type Periodo,
  resumirPeriodo,
} from '@mel/dominio';
import { useEffect, useMemo, useState } from 'react';
import { baixarArquivo } from '../../compartilhado/arquivo';
import { ContaDetalhada } from '../../compartilhado/ContaDetalhada';
import { Botao, Chip, Folha, Linha, reais, Secao } from '../../compartilhado/ui';
import { carregarHistorico, type NoiteHistorico, useAreas, useConfig } from '../../data/repo';

export function Historico({ motoboyId }: { motoboyId: string }) {
  const [noites, setNoites] = useState<NoiteHistorico[] | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [aberta, setAberta] = useState<NoiteHistorico | null>(null);
  const cfg = useConfig();
  const areas = useAreas(true);

  useEffect(() => {
    void carregarHistorico(motoboyId).then(setNoites);
  }, [motoboyId]);

  const hoje = dataDaNoite(new Date(), cfg?.fuso);
  const doPeriodo = useMemo(() => filtrarPeriodo(noites ?? [], periodo, hoje), [noites, periodo, hoje]);
  const resumo = resumirPeriodo(doPeriodo);
  const porCidade = useMemo(() => {
    const cidade = new Map(areas.map((a) => [a.id, a.cidade]));
    return agruparPorCidade(resumo.porArea, (id) => cidade.get(id) ?? '?');
  }, [areas, resumo.porArea]);

  if (noites === null) return <p className="p-4 text-apagado">Carregando…</p>;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Chip ativo={periodo === 'semana'} onClick={() => setPeriodo('semana')}>
          Esta semana
        </Chip>
        <Chip ativo={periodo === 'mes'} onClick={() => setPeriodo('mes')}>
          Este mês
        </Chip>
      </div>

      <Secao titulo="Resumo">
        <div className="flex justify-between">
          <span className="text-apagado">Noites</span>
          <span className="numero">{resumo.noites}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-apagado">Entregas</span>
          <span className="numero">{resumo.entregas}</span>
        </div>
        {Object.entries(porCidade).map(([cidade, t]) => (
          <div key={cidade} className="flex justify-between text-sm text-apagado">
            <span>{cidade}</span>
            <span className="numero">{t.entregues}</span>
          </div>
        ))}
        <Linha rotulo="Diárias" valor={resumo.diarias} />
        <Linha rotulo="Taxas" valor={resumo.taxas} />
        <Linha rotulo="Total recebido" valor={resumo.recebido} forte />
        {resumo.pendentes > 0 && (
          <p className="text-sm text-aviso">{resumo.pendentes} noite(s) sem acerto confirmado.</p>
        )}
      </Secao>

      <Secao titulo="Noites">
        {doPeriodo.map((n) => (
          <button
            type="button"
            key={n.caixaId}
            className="flex min-h-12 items-center justify-between border-b border-borda text-left"
            onClick={() => setAberta(n)}
          >
            <span>{formatarData(n.data)}</span>
            <span className="numero">
              {n.conta.entregues} entregas · {n.conta.liquidacao ? reais(n.conta.liquidacao.pagar) : 'pendente'}
            </span>
          </button>
        ))}
        {doPeriodo.length === 0 && <p className="text-sm text-apagado">Nenhuma noite neste período.</p>}
      </Secao>

      <Botao onClick={() => baixarArquivo(`mel-historico-${periodo}-${hoje}.csv`, historicoCsv(doPeriodo))}>
        Exportar CSV
      </Botao>

      <Folha aberta={aberta !== null} aoFechar={() => setAberta(null)} titulo={aberta ? formatarData(aberta.data) : ''}>
        {aberta &&
          ('caixaInicial' in aberta.conta ? (
            <ContaDetalhada conta={aberta.conta as ContaAcerto} paraMotoboy />
          ) : (
            <p className="text-apagado">Esta noite ainda não tem acerto confirmado.</p>
          ))}
      </Folha>
    </div>
  );
}
