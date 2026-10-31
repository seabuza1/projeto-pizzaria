// Caixa do motoboy no painel do Luan: papéis, dinheiro contado, liquidação e "Confirmar acerto".
import { formatarHora, lerValor, textoDaLiquidacao } from '@mel/dominio';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { mostrarAviso } from '../../compartilhado/avisos';
import { ContaDetalhada } from '../../compartilhado/ContaDetalhada';
import { MenuSaida } from '../../compartilhado/MenuSaida';
import { Botao, DoisToques, reais, Secao, SIGLA_FORMA } from '../../compartilhado/ui';
import {
  acoes,
  contaDoCaixa,
  type DadosNoite,
  type Perfil,
  pagamentosVigentes,
  useAreas,
  useConfig,
} from '../../data/repo';

const campo = 'numero min-h-12 w-32 rounded-xl border border-borda bg-cartao px-3 text-right text-lg';

function CampoValor({
  rotulo,
  inicial,
  aoSalvar,
  desabilitado,
}: {
  rotulo: string;
  inicial: number | null;
  aoSalvar: (centavos: number | null) => void;
  desabilitado: boolean;
}) {
  const [texto, setTexto] = useState(inicial === null ? '' : reais(inicial).replace('R$ ', ''));
  const [erro, setErro] = useState('');
  function salvar() {
    if (texto.trim() === '') return aoSalvar(null);
    const v = lerValor(texto);
    if (!v.ok) return setErro(v.erro.mensagem);
    setErro('');
    if (v.valor !== inicial) aoSalvar(v.valor);
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span>{rotulo}</span>
        <input
          className={campo}
          inputMode="decimal"
          value={texto}
          disabled={desabilitado}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </span>
      {erro && <span className="text-sm text-erro">{erro}</span>}
    </label>
  );
}

export function AcertoLuan({ dados, perfis, perfil }: { dados: DadosNoite; perfis: Perfil[]; perfil: Perfil }) {
  const { caixaId } = useParams();
  const areas = useAreas(true);
  const cfg = useConfig();
  const [motivo, setMotivo] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const caixa = dados.caixas.find((c) => c.id === caixaId);
  if (!caixa) return <p className="p-6 text-apagado">Caixa não encontrado.</p>;

  const conta = contaDoCaixa(caixa, dados);
  const acerto = dados.acertos.find((a) => a.caixa_id === caixa.id);
  const nome = (id: string | null) => perfis.find((p) => p.id === id)?.nome ?? '?';
  const nomeArea = (id: string) => areas.find((a) => a.id === id)?.nome ?? '?';
  const pedidos = new Map(dados.pedidos.map((p) => [p.id, p]));
  // ACE8: as que faltam no topo, com os dados para refazer a comanda.
  const saidas = dados.saidas
    .filter((s) => s.caixa_id === caixa.id && !s.cancelada_em)
    .sort((a, b) => Number(a.papel_conferido) - Number(b.papel_conferido));
  const l = conta.liquidacao;

  async function confirmar() {
    await acoes.confirmarAcerto(caixa?.id ?? '', conta);
    mostrarAviso(`Acerto de ${nome(caixa?.motoboy_id ?? null)} confirmado`);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link to=".." relative="path" className="min-h-12 py-3 text-apagado">
          ← Folha
        </Link>
        <span className="text-lg font-semibold">
          <span className="numero text-apagado">{caixa.ordem_chegada}</span> {nome(caixa.motoboy_id)}
        </span>
      </div>

      {acerto ? (
        <p className="rounded-xl bg-green-950 px-3 py-2 text-ok">
          Confirmado por {nome(acerto.confirmado_por)} às {formatarHora(acerto.confirmado_em, cfg?.fuso)}
        </p>
      ) : (
        <Secao titulo="Caixa">
          <CampoValor
            rotulo="Caixa inicial"
            inicial={caixa.caixa_inicial}
            desabilitado={false}
            aoSalvar={(v) => v !== null && void acoes.editarCaixa(caixa.id, { caixa_inicial: v })}
          />
          <CampoValor
            rotulo="Diária"
            inicial={caixa.diaria}
            desabilitado={false}
            aoSalvar={(v) => v !== null && void acoes.editarCaixa(caixa.id, { diaria: v })}
          />
        </Secao>
      )}

      <Secao titulo={`Papéis (${conta.papelFaltando.length} faltando)`}>
        {saidas.map((s) => {
          const p = pedidos.get(s.pedido_id);
          const vigentes = pagamentosVigentes(s, dados.pagamentos);
          return (
            <label key={s.id} className="flex min-h-12 items-center gap-3 border-b border-borda py-1">
              <input
                type="checkbox"
                className="size-6 accent-amber-500"
                checked={s.papel_conferido}
                onChange={(e) => void acoes.conferirPapel(s.id, e.target.checked)}
              />
              <span className={`numero text-xl ${s.estado === 'voltou' ? 'text-apagado line-through' : ''}`}>
                {p?.codigo}
              </span>
              <span className="flex flex-1 flex-col text-sm text-apagado">
                <span>
                  {nomeArea(s.area_id)} ·{' '}
                  {s.estado === 'voltou' ? 'voltou' : vigentes.map((v) => SIGLA_FORMA[v.forma]).join('+')}
                  {vigentes.some((v) => v.troco_pix > 0) && ' · troco por Pix'}
                </span>
                {s.saiu_em && <span>saiu {formatarHora(s.saiu_em, cfg?.fuso)}</span>}
              </span>
              <span className="numero">{p ? reais(p.total) : ''}</span>
              {!acerto && (
                <Botao variante="fantasma" onClick={() => setAberta(s.id)} aria-label={`Menu da ${p?.codigo ?? ''}`}>
                  ⋯
                </Botao>
              )}
            </label>
          );
        })}
      </Secao>

      {(() => {
        const s = saidas.find((x) => x.id === aberta);
        const p = s && pedidos.get(s.pedido_id);
        return s && p ? (
          <MenuSaida
            saida={s}
            pedido={p}
            vigentes={pagamentosVigentes(s, dados.pagamentos)}
            aoFechar={() => setAberta(null)}
          />
        ) : null;
      })()}

      <Secao titulo="Dinheiro contado">
        <CampoValor
          rotulo="Contado"
          inicial={caixa.dinheiro_contado}
          desabilitado={Boolean(acerto)}
          aoSalvar={(v) => void acoes.informarContado(caixa.id, v)}
        />
      </Secao>

      {l && !acerto && <p className="rounded-xl bg-amber-950 px-3 py-3 text-lg text-mel">{textoDaLiquidacao(l)}</p>}

      <ContaDetalhada conta={conta} paraMotoboy={false} />

      {!acerto && (
        <DoisToques
          rotulo="Confirmar acerto"
          confirmar="Toque de novo para confirmar"
          variante="principal"
          className="min-h-14 text-lg"
          disabled={!l}
          aoConfirmar={() => void confirmar()}
        />
      )}
      {!l && !acerto && <p className="text-center text-sm text-apagado">Informe o dinheiro contado para confirmar.</p>}

      {acerto && perfil.papeis.includes('admin') && (
        <Secao titulo="Reabrir (admin)">
          <input
            className="min-h-12 rounded-xl border border-borda bg-cartao px-3"
            placeholder="Motivo da reabertura"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <DoisToques
            rotulo="Reabrir acerto"
            variante="perigo"
            disabled={motivo.trim() === ''}
            aoConfirmar={() => void acoes.reabrirAcerto(caixa.id, motivo.trim()).then(() => setMotivo(''))}
          />
        </Secao>
      )}
      <Botao variante="fantasma" onClick={() => history.back()}>
        Voltar
      </Botao>
    </div>
  );
}
