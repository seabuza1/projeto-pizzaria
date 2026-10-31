// Pedido do atendimento (F2, 2b): telefone primeiro, itens, entrega ou retirada, pagamento, total,
// "Mandar resumo" e "Autorizado". Contas e regras vêm de @mel/dominio; a tela só junta.
import {
  type Centavos,
  centavos,
  codigoDoTelefone,
  codigoRepetido,
  formatarData,
  type ItemPedido,
  lerTelefone,
  linkWhatsApp,
  precoDoPedido,
  repetirPedido,
  resumoDoPedido,
  situacaoDaTrava,
  validarPagamentos,
  validarTroco,
} from '@mel/dominio';
import { useEffect, useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { CampoValor } from '../../compartilhado/CampoValor';
import { EditorPagamentos } from '../../compartilhado/EditorPagamentos';
import { Botao, Chip, DoisToques, Folha, NOME_FORMA, reais, Secao } from '../../compartilhado/ui';
import {
  acoes,
  type DadosNoite,
  type LinhaPagamento,
  meuAparelho,
  type Noite,
  type Pedido,
  useAcabou,
  useAreas,
  useCardapioDeVenda,
  useCliente,
  useLinhasCardapio,
  useUltimosPedidos,
} from '../../data/repo';
import { Itens } from './Itens';

const FORMAS = ['dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado'] as const;
const campo = 'min-h-12 rounded-xl border border-borda bg-cartao px-3';

export interface Formulario {
  pedidoId: string | null;
  telefone: string;
  tipo: 'entrega' | 'retirada';
  areaId: string | null;
  itens: ItemPedido[];
  pagamentos: LinhaPagamento[];
  trocoPara: number | null;
  promocao: boolean;
  enderecoLink: string;
  enderecoTexto: string;
  enderecoReferencia: string;
  localPendente: boolean;
}

export const formularioVazio = (): Formulario => ({
  pedidoId: null,
  telefone: '',
  tipo: 'entrega',
  areaId: null,
  itens: [],
  pagamentos: [],
  trocoPara: null,
  promocao: false,
  enderecoLink: '',
  enderecoTexto: '',
  enderecoReferencia: '',
  localPendente: false,
});

/** Retomar um rascunho ou alterar um pedido autorizado: o que o atendente digitou está em `atendimento`. */
export function formularioDoPedido(p: Pedido): Formulario {
  const a = (p.atendimento ?? {}) as {
    itens?: { item: ItemPedido }[];
    pagamentos?: { forma: LinhaPagamento['forma']; valor: number; troco_pix?: number }[];
  };
  return {
    pedidoId: p.id,
    telefone: p.telefone ?? '',
    tipo: p.tipo === 'retirada' ? 'retirada' : 'entrega',
    areaId: p.area_id,
    itens: (a.itens ?? []).map((l) => l.item),
    pagamentos: (a.pagamentos ?? []).map((x) => ({
      forma: x.forma,
      valor: x.valor,
      ...(x.troco_pix ? { trocoPix: x.troco_pix } : {}),
    })),
    trocoPara: p.troco_para,
    promocao: p.promocao,
    enderecoLink: p.endereco_link ?? '',
    enderecoTexto: p.endereco_texto ?? '',
    enderecoReferencia: p.endereco_referencia ?? '',
    localPendente: p.local_pendente,
  };
}

export function Editor({
  noite,
  dados,
  inicial,
  aoTerminar,
  aoAbrir,
}: {
  noite: Noite | null;
  dados: DadosNoite;
  inicial: Formulario;
  aoTerminar: () => void;
  aoAbrir: (pedido: Pedido) => void;
}) {
  const [f, setF] = useState(inicial);
  const [codigoConfirmado, setCodigoConfirmado] = useState(Boolean(inicial.pedidoId));
  const [divisao, setDivisao] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const mudar = (m: Partial<Formulario>) => setF((atual) => ({ ...atual, ...m }));

  const cardapio = useCardapioDeVenda(noite?.id);
  const linhasCardapio = useLinhasCardapio();
  const acabouIds = useAcabou(noite?.id);
  const areas = useAreas();
  const tel = lerTelefone(f.telefone);
  const telefone = tel.ok ? tel.valor : null;
  const codigo = telefone ? codigoDoTelefone(telefone) : null;
  const cliente = useCliente(telefone);
  const anteriores = useUltimosPedidos(f.pedidoId ? null : telefone);
  const [nome, setNome] = useState('');
  useEffect(() => setNome(cliente?.nome ?? ''), [cliente?.nome]);

  // Pedido novo: o último local do cliente vem preenchido, com a área sugerida.
  useEffect(() => {
    if (!cliente || f.pedidoId) return;
    setF((atual) =>
      atual.areaId || atual.enderecoLink || atual.enderecoTexto
        ? atual
        : {
            ...atual,
            areaId: cliente.area_id,
            enderecoLink: cliente.local_link ?? '',
            enderecoTexto: cliente.local_endereco ?? '',
            enderecoReferencia: cliente.local_referencia ?? '',
          },
    );
  }, [cliente, f.pedidoId]);

  const nomesAcabou = linhasCardapio
    ? [...linhasCardapio.sabores, ...linhasCardapio.bebidas, ...linhasCardapio.bordas, ...linhasCardapio.adicionais]
        .filter((i) => acabouIds.has(i.id))
        .map((i) => i.nome)
    : [];
  const area = f.tipo === 'entrega' ? areas.find((a) => a.id === f.areaId) : undefined;
  const promo = noite?.promo_desconto ?? null;
  const preco =
    cardapio && f.itens.length > 0
      ? precoDoPedido(cardapio, {
          itens: f.itens,
          taxa: centavos(area?.taxa ?? 0),
          promocao: f.promocao,
          promoDesconto: promo === null ? null : centavos(promo),
        })
      : null;
  const total = preco?.ok ? preco.valor.total : 0;
  // Uma forma só acompanha o total; dividido, vale o que o atendente digitou.
  const pagamentos =
    f.pagamentos.length === 1 && f.pagamentos[0] ? [{ ...f.pagamentos[0], valor: total }] : f.pagamentos;
  const formaUnica = f.pagamentos.length === 1 ? f.pagamentos[0]?.forma : undefined;

  // Trava (F2, 2b): outro aparelho atendendo esse telefone.
  const outro = telefone
    ? dados.pedidos.find(
        (p) => p.telefone === telefone && p.id !== f.pedidoId && (p.estado === 'rascunho' || p.estado === 'aguardando'),
      )
    : undefined;
  const trava = outro
    ? situacaoDaTrava({ aparelho: outro.atendendo_aparelho, desde: outro.atendendo_desde }, meuAparelho(), new Date())
    : null;
  const repetido = codigo ? codigoRepetido(codigo, dados.pedidos, f.pedidoId ?? undefined) : false;

  async function salvar(etapa: 'rascunho' | 'aguardando' | 'autorizar') {
    if (!telefone) return;
    const linhas = preco?.ok ? preco.valor.linhas : [];
    const id = await acoes.salvarPedido({
      ...(f.pedidoId ? { pedido_id: f.pedidoId } : {}),
      ...(noite ? { noite_id: noite.id } : {}),
      etapa,
      telefone,
      tipo: f.tipo,
      area_id: f.tipo === 'entrega' ? f.areaId : null,
      itens: f.itens.flatMap((item, i) => {
        const linha = linhas[i];
        return linha ? [{ item, linha }] : [];
      }),
      pagamentos,
      troco_para: f.trocoPara,
      promocao: f.promocao,
      endereco_link: f.enderecoLink || null,
      endereco_texto: f.enderecoTexto || null,
      endereco_referencia: f.enderecoReferencia || null,
      local_pendente: f.localPendente,
    });
    mudar({ pedidoId: id });
    return id;
  }

  // Rascunho salvo sozinho, 2 s depois da última mudança (a lateral e a trava dos outros aparelhos veem).
  // biome-ignore lint/correctness/useExhaustiveDependencies: salva quando o formulário muda
  useEffect(() => {
    if (!telefone || (outro && trava && !trava.livre)) return;
    const pedido = f.pedidoId ? dados.pedidos.find((p) => p.id === f.pedidoId) : undefined;
    if (pedido && pedido.estado !== 'rascunho' && pedido.estado !== 'aguardando') return;
    const t = setTimeout(() => void salvar(pedido?.estado === 'aguardando' ? 'aguardando' : 'rascunho'), 2000);
    return () => clearTimeout(t);
  }, [f, telefone]);

  function problema(): string | null {
    if (!telefone) return tel.ok ? null : tel.erro.mensagem;
    if (repetido && !codigoConfirmado) return `Já tem um pedido ${codigo} hoje. Confirme que é outro.`;
    if (f.itens.length === 0) return 'O pedido está sem itens.';
    if (preco && !preco.ok) return preco.erro.mensagem;
    if (f.tipo === 'entrega' && !area) return 'Escolha a área.';
    const pags = validarPagamentos(centavos(total), pagamentos);
    if (!pags.ok) return pags.erro.mensagem;
    const troco = validarTroco(f.trocoPara === null ? null : centavos(f.trocoPara), pags.valor);
    if (!troco.ok) return troco.erro.mensagem;
    return null;
  }

  function mandarResumo() {
    if (!telefone || !codigo || !preco?.ok) return;
    const texto = resumoDoPedido({
      codigo,
      linhas: preco.valor.linhas,
      tipo: f.tipo,
      area: area?.nome ?? null,
      referencia: f.enderecoReferencia || null,
      total: preco.valor.total,
      pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: centavos(p.valor) })),
      trocoPara: f.trocoPara === null ? null : centavos(f.trocoPara),
    });
    window.open(linkWhatsApp(telefone, texto), '_blank', 'noopener');
    void salvar('aguardando');
  }

  async function autorizar() {
    const p = problema();
    if (p) return setErro(p);
    setErro('');
    const id = await salvar('autorizar');
    // F2, 2c: a comanda sai ao autorizar (e de novo, com "ALTERADO", ao salvar uma alteração).
    if (id) void acoes.imprimirComanda(id);
    // O último local fica no cliente: o próximo pedido já vem com ele (F2, 2d).
    if (telefone) {
      void acoes.salvarCliente({
        telefone,
        ...(nome.trim() ? { nome: nome.trim() } : {}),
        ...(f.tipo === 'entrega'
          ? {
              area_id: f.areaId,
              local_link: f.enderecoLink || null,
              local_endereco: f.enderecoTexto || null,
              local_referencia: f.enderecoReferencia || null,
            }
          : {}),
      });
    }
    mostrarAviso(`${codigo} autorizado`);
    aoTerminar();
  }

  function repetir(itens: ItemPedido[], pedido: Pedido) {
    if (!cardapio) return;
    const r = repetirPedido(itens, cardapio);
    mudar({
      itens: [...f.itens, ...r.itens],
      ...(pedido.tipo === 'entrega' && pedido.area_id
        ? {
            tipo: 'entrega',
            areaId: pedido.area_id,
            enderecoLink: pedido.endereco_link ?? '',
            enderecoTexto: pedido.endereco_texto ?? '',
            enderecoReferencia: pedido.endereco_referencia ?? '',
          }
        : {}),
    });
    if (r.fora.length > 0) mostrarAviso(`Fora do cardápio hoje: ${r.fora.join(', ')}`, { tipo: 'erro' });
  }

  const pedidoAtual = f.pedidoId ? dados.pedidos.find((p) => p.id === f.pedidoId) : undefined;
  const autorizado = pedidoAtual?.estado === 'em_producao';

  return (
    <div className="flex flex-col gap-3">
      <Secao titulo="Cliente">
        <input
          className={`${campo} numero text-lg`}
          inputMode="tel"
          placeholder="Telefone com DDD"
          aria-label="Telefone"
          value={f.telefone}
          disabled={Boolean(f.pedidoId)}
          onChange={(e) => mudar({ telefone: e.target.value })}
        />
        {codigo && <span className="numero text-3xl font-bold">{codigo}</span>}
        {telefone && (
          <input
            className={campo}
            placeholder="Nome do cliente"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() =>
              nome.trim() && nome !== cliente?.nome && void acoes.salvarCliente({ telefone, nome: nome.trim() })
            }
          />
        )}
        {outro && trava && !trava.livre && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-950 px-3 py-2 text-aviso">
            <span>
              Atendendo {outro.codigo} em outro aparelho há {trava.minutos} min
            </span>
            <Botao
              onClick={() => {
                void acoes.assumirPedido(outro.id);
                aoAbrir(outro);
              }}
            >
              Assumir
            </Botao>
          </div>
        )}
        {outro && trava?.livre && (
          <Botao onClick={() => aoAbrir(outro)}>Continuar o pedido {outro.codigo} aberto</Botao>
        )}
        {repetido && !codigoConfirmado && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-950 px-3 py-2 text-aviso">
            <span>Já tem um pedido {codigo} hoje.</span>
            <Botao onClick={() => setCodigoConfirmado(true)}>É outro pedido</Botao>
          </div>
        )}
        {anteriores.length > 0 && (
          <ul aria-label="Últimos pedidos" className="flex flex-col gap-1">
            {anteriores.map(({ pedido, itens }) => (
              <li key={pedido.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-apagado">
                  {formatarData(pedido.criado_em.slice(0, 10))}: {itens.map((i) => i.nome).join(' + ')}
                </span>
                <Botao
                  variante="fantasma"
                  onClick={() =>
                    repetir(
                      itens.map((i) => i.item as unknown as ItemPedido),
                      pedido,
                    )
                  }
                >
                  Repetir
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {telefone && (
        <>
          <Secao titulo="Itens">
            {cardapio ? (
              <Itens cardapio={cardapio} acabou={nomesAcabou} itens={f.itens} aoMudar={(itens) => mudar({ itens })} />
            ) : (
              <p className="text-apagado">Carregando o cardápio…</p>
            )}
          </Secao>

          <Secao titulo="Entrega">
            <div className="grid grid-cols-2 gap-2">
              <Chip ativo={f.tipo === 'entrega'} onClick={() => mudar({ tipo: 'entrega' })}>
                Entrega
              </Chip>
              <Chip ativo={f.tipo === 'retirada'} onClick={() => mudar({ tipo: 'retirada' })}>
                Retirada
              </Chip>
            </div>
            {f.tipo === 'entrega' && (
              <>
                <div className="flex flex-wrap gap-2">
                  {areas.map((a) => (
                    <Chip key={a.id} ativo={f.areaId === a.id} onClick={() => mudar({ areaId: a.id })}>
                      {a.nome} <span className="numero text-apagado">{reais(a.taxa)}</span>
                    </Chip>
                  ))}
                </div>
                <input
                  className={campo}
                  placeholder="Pino ou link do Maps"
                  value={f.enderecoLink}
                  onChange={(e) => mudar({ enderecoLink: e.target.value, localPendente: false })}
                />
                <input
                  className={campo}
                  placeholder="Endereço escrito"
                  value={f.enderecoTexto}
                  onChange={(e) => mudar({ enderecoTexto: e.target.value })}
                />
                <input
                  className={campo}
                  placeholder="Referência (ex.: hospital)"
                  value={f.enderecoReferencia}
                  onChange={(e) => mudar({ enderecoReferencia: e.target.value })}
                />
                {!f.enderecoLink && (
                  <Chip ativo={f.localPendente} onClick={() => mudar({ localPendente: !f.localPendente })}>
                    {f.localPendente ? 'Localização pendente' : 'Pedir localização'}
                  </Chip>
                )}
              </>
            )}
          </Secao>

          <Secao titulo="Pagamento">
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((forma) => (
                <Chip
                  key={forma}
                  ativo={formaUnica === forma}
                  onClick={() =>
                    mudar({
                      pagamentos: [{ forma, valor: total }],
                      ...(forma !== 'dinheiro' ? { trocoPara: null } : {}),
                    })
                  }
                >
                  {NOME_FORMA[forma]}
                </Chip>
              ))}
            </div>
            <Botao variante="fantasma" onClick={() => setDivisao(true)}>
              Pagou de mais de um jeito
            </Botao>
            {f.pagamentos.length > 1 && (
              <p className="text-sm">
                {f.pagamentos.map((p) => `${NOME_FORMA[p.forma]} ${reais(p.valor)}`).join(' + ')}
              </p>
            )}
            {pagamentos.some((p) => p.forma === 'dinheiro') && (
              <CampoValor
                key={`troco-${f.pedidoId}`}
                rotulo="Troco para"
                inicial={f.trocoPara}
                aoSalvar={(v) => mudar({ trocoPara: v })}
              />
            )}
            {pagamentos.some((p) => p.forma === 'pix_antecipado') && (
              <p className="text-sm text-aviso">Pix antecipado: fica "PIX: CONFERIR" até o Luan marcar que caiu.</p>
            )}
          </Secao>

          <Secao titulo="Total">
            {promo === null && <p className="text-aviso">Promoção da noite não definida</p>}
            {promo !== null && promo > 0 && (
              <Chip ativo={f.promocao} onClick={() => mudar({ promocao: !f.promocao })}>
                Com promoção (* {reais(promo)} nas tradicionais)
              </Chip>
            )}
            {preco?.ok && (
              <div className="numero flex flex-col text-sm">
                {preco.valor.linhas.map((l, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: linhas na ordem dos itens
                  <span key={i} className="flex justify-between">
                    <span>
                      {l.quantidade > 1 ? `${l.quantidade} ` : ''}
                      {l.nome}
                      {l.desconto > 0 && ' *'}
                    </span>
                    <span>{reais(l.total)}</span>
                  </span>
                ))}
                <span className="flex justify-between text-apagado">
                  <span>Taxa {area?.nome ?? ''}</span>
                  <span>{reais(preco.valor.taxa)}</span>
                </span>
              </div>
            )}
            {preco && !preco.ok && <p className="text-erro">{preco.erro.mensagem}</p>}
            <output className="numero block text-2xl font-bold" aria-label="Total do pedido">
              {reais(total as Centavos)}
            </output>
          </Secao>

          {erro && <p className="rounded-xl bg-red-950 px-3 py-2 text-erro">{erro}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Botao disabled={!preco?.ok || autorizado} onClick={mandarResumo}>
              Mandar resumo
            </Botao>
            <DoisToques
              rotulo={autorizado ? 'Salvar alteração' : 'Autorizado'}
              confirmar="Toque de novo para autorizar"
              variante="principal"
              disabled={!preco?.ok}
              aoConfirmar={() => void autorizar()}
            />
          </div>

          {f.pedidoId && (
            <Secao titulo="Cancelar pedido">
              <input
                className={campo}
                placeholder="Motivo do cancelamento"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <DoisToques
                rotulo="Cancelar pedido"
                variante="perigo"
                disabled={motivo.trim() === ''}
                aoConfirmar={() => {
                  if (!f.pedidoId) return;
                  void acoes.cancelarPedido(f.pedidoId, motivo.trim());
                  mostrarAviso(`${codigo} cancelado`);
                  aoTerminar();
                }}
              />
            </Secao>
          )}
        </>
      )}

      <Folha aberta={divisao} aoFechar={() => setDivisao(false)} titulo="Pagou de mais de um jeito">
        {divisao && (
          <EditorPagamentos
            total={total}
            inicial={f.pagamentos}
            rotulo="Usar estas formas"
            aoConfirmar={(linhas) => {
              mudar({ pagamentos: linhas });
              setDivisao(false);
            }}
          />
        )}
      </Folha>
    </div>
  );
}
