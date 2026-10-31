// Folha da noite no formato do papel: uma coluna por motoboy (ordem de chegada) e a coluna PIX.
import { formatarDataCurta } from '@mel/dominio';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { Botao, curto, Folha as FolhaQueSobe, reais, SIGLA_FORMA } from '../../compartilhado/ui';
import {
  acoes,
  type Caixa,
  contaDoCaixa,
  type DadosNoite,
  type Noite,
  type Pagamento,
  pagamentosVigentes,
  pixDaNoite,
  type Saida,
} from '../../data/repo';
import { MenuSaida } from './MenuSaida';

function Coluna({
  caixa,
  dados,
  nome,
  noite,
  aoTocarCodigo,
  somenteLeitura,
}: {
  caixa: Caixa;
  dados: DadosNoite;
  nome: string;
  noite: Noite;
  aoTocarCodigo: (saida: Saida) => void;
  somenteLeitura: boolean;
}) {
  const conta = contaDoCaixa(caixa, dados);
  const saidas = dados.saidas.filter((s) => s.caixa_id === caixa.id && !s.cancelada_em);
  const pedidos = new Map(dados.pedidos.map((p) => [p.id, p]));
  const confirmado = dados.acertos.some((a) => a.caixa_id === caixa.id);
  // "•" para papel não conferido, depois de aberto o acerto.
  const acertoAberto = caixa.dinheiro_contado !== null || saidas.some((s) => s.papel_conferido);
  // Noite antiga: só leitura, sem ir para o caixa.
  const paraOCaixa = (className: string, conteudo: ReactNode) =>
    somenteLeitura ? (
      <div className={className}>{conteudo}</div>
    ) : (
      <Link to={`caixa/${caixa.id}`} className={className}>
        {conteudo}
      </Link>
    );

  return (
    <section
      aria-label={`Coluna de ${nome}`}
      className="flex w-44 shrink-0 flex-col gap-1 rounded-xl border border-borda bg-cartao/40 p-2 sm:w-auto sm:flex-1"
    >
      {paraOCaixa(
        'flex min-h-12 items-center justify-between border-b border-borda pb-1',
        <>
          <span className="font-semibold">
            <span className="numero text-apagado">{caixa.ordem_chegada}</span> {nome}
          </span>
          {!somenteLeitura && <span className="text-apagado">›</span>}
        </>,
      )}
      <ul className="flex flex-1 flex-col text-sm">
        {saidas.map((s) => {
          const vigentes = pagamentosVigentes(s, dados.pagamentos);
          // PAG4: o troco por Pix fica na linha em dinheiro.
          const troco = vigentes.find((p) => p.troco_pix > 0)?.troco_pix ?? 0;
          const voltou = s.estado === 'voltou';
          return (
            <li key={s.id}>
              {/* Menu do código: Voltou, Saiu de novo, Trocou a forma e Cancelar saída. */}
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 text-left disabled:opacity-100"
                disabled={confirmado || somenteLeitura}
                onClick={() => aoTocarCodigo(s)}
              >
                <span className={`numero ${voltou ? 'text-apagado line-through' : ''}`}>
                  {pedidos.get(s.pedido_id)?.codigo}
                </span>
                <span className={voltou ? 'text-erro' : s.estado === 'em_rota' ? 'text-rota' : 'text-apagado'}>
                  {voltou ? 'voltou' : vigentes.map((p) => SIGLA_FORMA[p.forma]).join('+')}
                  {troco > 0 && <span className="numero text-texto"> →{curto(troco)}</span>}
                </span>
                {acertoAberto && !s.papel_conferido && <span className="text-aviso">•</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {paraOCaixa(
        'numero flex flex-col border-t border-borda pt-1 text-sm',
        <>
          <span className="text-apagado">
            {formatarDataCurta(noite.data)} · {curto(caixa.caixa_inicial)}
          </span>
          <span>{conta.entregues} entregas</span>
          <span>Devolve {reais(conta.devolver)}</span>
          <span>Recebe {reais(conta.receber)}</span>
          <span className={confirmado ? 'text-ok' : 'text-aviso'}>{confirmado ? 'Confirmado' : 'Pendente'}</span>
        </>,
      )}
    </section>
  );
}

function ColunaPix({ dados, somenteLeitura }: { dados: DadosNoite; somenteLeitura: boolean }) {
  const pix = pixDaNoite(dados);
  const [desmarcando, setDesmarcando] = useState<{ pagamento: Pagamento; codigo: string } | null>(null);
  const [motivo, setMotivo] = useState('');

  function desmarcar() {
    if (!desmarcando) return;
    void acoes.marcarPix(desmarcando.pagamento.id, false, motivo.trim());
    setDesmarcando(null);
    setMotivo('');
  }

  return (
    <div className="flex w-44 shrink-0 flex-col gap-1 rounded-xl border border-borda bg-cartao/40 p-2 sm:w-auto sm:flex-1">
      <div className="border-b border-borda pb-1 font-semibold">PIX</div>
      {pix.length === 0 && <span className="text-sm text-apagado">Nenhum Pix antecipado.</span>}
      {pix.map(({ pagamento, pedido }) => (
        // PAG5: tocar marca "caiu"; desmarcar pede o motivo (OPE3).
        <button
          type="button"
          key={pagamento.id}
          className="flex min-h-12 items-center justify-between gap-2 text-left text-sm disabled:opacity-100"
          disabled={somenteLeitura}
          onClick={() =>
            pagamento.pix_confirmado
              ? setDesmarcando({ pagamento, codigo: pedido.codigo })
              : void acoes.marcarPix(pagamento.id, true)
          }
        >
          <span className="numero">{pedido.codigo}</span>
          <span className="numero text-apagado">{curto(pagamento.valor)}</span>
          <span className={pagamento.pix_confirmado ? 'text-ok' : 'text-aviso'}>
            {pagamento.pix_confirmado ? 'caiu ✓' : 'conferir'}
          </span>
        </button>
      ))}
      <FolhaQueSobe
        aberta={desmarcando !== null}
        aoFechar={() => setDesmarcando(null)}
        titulo={`Desmarcar o Pix da ${desmarcando?.codigo ?? ''}`}
      >
        <input
          className="min-h-12 rounded-xl border border-borda bg-cartao px-3"
          placeholder="Motivo (ex.: marquei o Pix errado)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <Botao variante="perigo" disabled={motivo.trim() === ''} onClick={desmarcar}>
          Desmarcar
        </Botao>
      </FolhaQueSobe>
    </div>
  );
}

export function Folha({
  noite,
  dados,
  nomeMotoboy,
  somenteLeitura = false,
}: {
  noite: Noite;
  dados: DadosNoite;
  nomeMotoboy: (id: string) => string;
  somenteLeitura?: boolean;
}) {
  const [aberta, setAberta] = useState<Saida | null>(null);
  const pedido = aberta && dados.pedidos.find((p) => p.id === aberta.pedido_id);
  const atual = aberta && dados.saidas.find((s) => s.id === aberta.id && !s.cancelada_em);
  const abertos = dados.caixas
    .filter((c) => !dados.acertos.some((a) => a.caixa_id === c.id))
    .map((c) => ({ id: c.id, nome: nomeMotoboy(c.motoboy_id) }));
  return (
    <div className="flex gap-2 overflow-x-auto p-3 sm:flex-wrap sm:overflow-visible">
      {dados.caixas.map((c) => (
        <Coluna
          key={c.id}
          caixa={c}
          dados={dados}
          nome={nomeMotoboy(c.motoboy_id)}
          noite={noite}
          aoTocarCodigo={setAberta}
          somenteLeitura={somenteLeitura}
        />
      ))}
      <ColunaPix dados={dados} somenteLeitura={somenteLeitura} />
      {pedido && atual && (
        <MenuSaida
          saida={atual}
          pedido={pedido}
          vigentes={pagamentosVigentes(atual, dados.pagamentos)}
          caixas={abertos}
          aoFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}
