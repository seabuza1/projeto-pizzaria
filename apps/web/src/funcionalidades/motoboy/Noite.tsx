// Aba Noite do motoboy: lançar, lista sem cartões e marcação na porta.
import { centavos, pixPendente } from '@mel/dominio';
import { useMemo, useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { LancarComanda } from '../../compartilhado/LancarComanda';
import { MenuSaida } from '../../compartilhado/MenuSaida';
import { Botao, reais, SIGLA_FORMA } from '../../compartilhado/ui';
import { acoes, type Pagamento, pagamentosVigentes, type Saida, useAreas } from '../../data/repo';
import type { CaixaDoMotoboy } from './usar-caixa';

const ESTADO = {
  em_rota: { icone: '➜', cor: 'text-rota', nome: 'em rota' },
  separada: { icone: '•', cor: 'text-apagado', nome: 'separada' },
  entregue: { icone: '✓', cor: 'text-ok', nome: 'entregue' },
  voltou: { icone: '↩', cor: 'text-erro', nome: 'voltou' },
} as const;

function descreverFormas(vigentes: Pagamento[]): string {
  return vigentes
    .map((p) => `${SIGLA_FORMA[p.forma]}${p.troco_pix ? ` →${reais(p.troco_pix).replace('R$ ', '')}` : ''}`)
    .join(' + ');
}

/** PAG5: até o Luan marcar "caiu", o motoboy vê quanto falta cobrar. */
function avisoPix(vigentes: Pagamento[]) {
  const { temPix, pendente } = pixPendente(
    vigentes.map((p) => ({ forma: p.forma, valor: centavos(p.valor), pixConfirmado: p.pix_confirmado })),
  );
  if (!temPix) return null;
  return pendente > 0 ? (
    <span className="text-aviso">Pix não confirmado · cobrar {reais(pendente)}</span>
  ) : (
    <span className="text-ok">Pix confirmado</span>
  );
}

export function Noite({ c }: { c: CaixaDoMotoboy }) {
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Saida | null>(null);
  const areas = useAreas(true);
  const nomeArea = useMemo(() => new Map(areas.map((a) => [a.id, a.nome])), [areas]);

  const linhas = useMemo(
    () =>
      [...c.saidas]
        .reverse()
        .map((s) => ({ s, pedido: c.pedidos.get(s.pedido_id), vigentes: pagamentosVigentes(s, c.dados.pagamentos) }))
        .filter((l) => l.pedido && (busca === '' || l.pedido.codigo.includes(busca))),
    [c, busca],
  );
  const pedidosDaNoite = useMemo(() => [...c.pedidos.values()], [c.pedidos]);

  function entregue(s: Saida, codigo: string) {
    void acoes.mudarEstado(s.id, 'entregue');
    mostrarAviso(`${codigo} entregue`, { desfazer: () => void acoes.mudarEstado(s.id, 'em_rota') });
  }

  const retorno = c.caixa.retorno_em ? new Date(c.caixa.retorno_em) : null;

  return (
    <div className="flex flex-col gap-3 p-3">
      {!c.travado && <LancarComanda caixas={[{ id: c.caixa.id, nome: '' }]} pedidosDaNoite={pedidosDaNoite} />}

      {!c.travado && (
        <div className="grid grid-cols-3 gap-2 whitespace-nowrap text-sm">
          <Botao onClick={() => void acoes.avisarRetorno(c.caixa.id, 5)}>Volto em 5</Botao>
          <Botao onClick={() => void acoes.avisarRetorno(c.caixa.id, 10)}>Volto em 10</Botao>
          <Botao variante="fantasma" onClick={() => void acoes.avisarRetorno(c.caixa.id, null)} disabled={!retorno}>
            Cheguei
          </Botao>
        </div>
      )}

      <input
        className="numero min-h-12 rounded-xl border border-borda bg-cartao px-3"
        inputMode="numeric"
        placeholder="Buscar código"
        aria-label="Buscar código"
        value={busca}
        onChange={(e) => setBusca(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />

      <ul className="flex flex-col divide-y divide-borda">
        {linhas.length === 0 && <li className="py-6 text-center text-apagado">Nenhuma comanda ainda.</li>}
        {linhas.map(({ s, pedido, vigentes }) => {
          if (!pedido) return null;
          const e = ESTADO[s.estado];
          return (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                className="flex min-h-12 flex-1 items-center gap-3 text-left disabled:opacity-100"
                onClick={() => setAberta(s)}
                disabled={c.travado}
              >
                <span
                  className={`numero text-3xl font-bold ${s.estado === 'voltou' ? 'text-apagado line-through' : ''}`}
                >
                  {pedido.codigo}
                </span>
                <span className="flex flex-1 flex-col text-sm">
                  <span className="text-apagado">
                    {nomeArea.get(s.area_id) ?? '?'} · {descreverFormas(vigentes)}
                  </span>
                  <span className={e.cor}>
                    {e.icone} {e.nome}
                  </span>
                  {avisoPix(vigentes)}
                </span>
                <span className="numero text-lg">{reais(pedido.total)}</span>
              </button>
              {s.estado === 'em_rota' && !c.travado && (
                <Botao variante="principal" onClick={() => entregue(s, pedido.codigo)}>
                  Entregue
                </Botao>
              )}
            </li>
          );
        })}
      </ul>

      {aberta &&
        (() => {
          const pedido = c.pedidos.get(aberta.pedido_id);
          const atual = c.saidas.find((s) => s.id === aberta.id);
          return pedido && atual ? (
            <MenuSaida
              saida={atual}
              pedido={pedido}
              vigentes={pagamentosVigentes(atual, c.dados.pagamentos)}
              aoFechar={() => setAberta(null)}
            />
          ) : null;
        })()}
    </div>
  );
}
