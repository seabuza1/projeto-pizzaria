// Folha da noite no formato do papel: uma coluna por motoboy (ordem de chegada) e a coluna PIX.
import { formatarDataCurta } from '@mel/dominio';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { curto, reais, SIGLA_FORMA } from '../../compartilhado/ui';
import {
  acoes,
  type Caixa,
  contaDoCaixa,
  type DadosNoite,
  type Noite,
  type Perfil,
  pagamentosVigentes,
  pixDaNoite,
} from '../../data/repo';

/** "Volta em N min": o minuto que falta até o retorno avisado. */
function useMinutosAte(iso: string | null): number | null {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  const min = Math.ceil((Date.parse(iso) - agora) / 60_000);
  return min > 0 ? min : null;
}

function Coluna({ caixa, dados, nome, noite }: { caixa: Caixa; dados: DadosNoite; nome: string; noite: Noite }) {
  const conta = contaDoCaixa(caixa, dados);
  const saidas = dados.saidas.filter((s) => s.caixa_id === caixa.id && !s.cancelada_em);
  const pedidos = new Map(dados.pedidos.map((p) => [p.id, p]));
  const confirmado = dados.acertos.some((a) => a.caixa_id === caixa.id);
  // "•" para papel não conferido, depois de aberto o acerto.
  const acertoAberto = caixa.dinheiro_contado !== null || saidas.some((s) => s.papel_conferido);
  const volta = useMinutosAte(caixa.retorno_em);

  return (
    <Link
      to={`caixa/${caixa.id}`}
      className="flex w-44 shrink-0 flex-col gap-1 rounded-xl border border-borda bg-cartao/40 p-2 sm:w-auto sm:flex-1"
    >
      <div className="flex items-baseline justify-between border-b border-borda pb-1">
        <span className="font-semibold">
          <span className="numero text-apagado">{caixa.ordem_chegada}</span> {nome}
        </span>
      </div>
      {volta !== null && <span className="text-sm text-rota">Volta em {volta} min</span>}
      <ul className="flex flex-1 flex-col text-sm">
        {saidas.map((s) => {
          const vigentes = pagamentosVigentes(s, dados.pagamentos);
          // PAG4: o troco por Pix fica na linha em dinheiro.
          const troco = vigentes.find((p) => p.troco_pix > 0)?.troco_pix ?? 0;
          const voltou = s.estado === 'voltou';
          return (
            <li key={s.id} className="flex gap-2">
              <span className={`numero ${voltou ? 'text-apagado line-through' : ''}`}>
                {pedidos.get(s.pedido_id)?.codigo}
              </span>
              <span className={voltou ? 'text-erro' : s.estado === 'em_rota' ? 'text-rota' : 'text-apagado'}>
                {voltou ? 'voltou' : vigentes.map((p) => SIGLA_FORMA[p.forma]).join('+')}
                {troco > 0 && <span className="numero text-texto"> →{curto(troco)}</span>}
              </span>
              {acertoAberto && !s.papel_conferido && <span className="text-aviso">•</span>}
            </li>
          );
        })}
      </ul>
      <div className="numero flex flex-col border-t border-borda pt-1 text-sm">
        <span className="text-apagado">
          {formatarDataCurta(noite.data)} · {curto(caixa.caixa_inicial)}
        </span>
        <span>{conta.entregues} entregas</span>
        <span>Devolve {reais(conta.devolver)}</span>
        <span>Recebe {reais(conta.receber)}</span>
        <span className={confirmado ? 'text-ok' : 'text-aviso'}>{confirmado ? 'Confirmado' : 'Pendente'}</span>
      </div>
    </Link>
  );
}

function ColunaPix({ dados }: { dados: DadosNoite }) {
  const pix = pixDaNoite(dados);
  return (
    <div className="flex w-44 shrink-0 flex-col gap-1 rounded-xl border border-borda bg-cartao/40 p-2 sm:w-auto sm:flex-1">
      <div className="border-b border-borda pb-1 font-semibold">PIX</div>
      {pix.length === 0 && <span className="text-sm text-apagado">Nenhum Pix antecipado.</span>}
      {pix.map(({ pagamento, pedido }) => (
        // PAG5: tocar marca "caiu" (e tocar de novo desmarca).
        <button
          type="button"
          key={pagamento.id}
          className="flex min-h-12 items-center justify-between gap-2 text-left text-sm"
          onClick={() => void acoes.marcarPix(pagamento.id, !pagamento.pix_confirmado)}
        >
          <span className="numero">{pedido.codigo}</span>
          <span className="numero text-apagado">{curto(pagamento.valor)}</span>
          <span className={pagamento.pix_confirmado ? 'text-ok' : 'text-aviso'}>
            {pagamento.pix_confirmado ? 'caiu ✓' : 'conferir'}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Folha({ noite, dados, perfis }: { noite: Noite; dados: DadosNoite; perfis: Perfil[] }) {
  const nome = (id: string) => perfis.find((p) => p.id === id)?.nome ?? '?';
  return (
    <div className="flex gap-2 overflow-x-auto p-3 sm:flex-wrap sm:overflow-visible">
      {dados.caixas.map((c) => (
        <Coluna key={c.id} caixa={c} dados={dados} nome={nome(c.motoboy_id)} noite={noite} />
      ))}
      <ColunaPix dados={dados} />
    </div>
  );
}
