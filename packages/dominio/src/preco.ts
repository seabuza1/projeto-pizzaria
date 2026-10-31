// Cálculo do pedido (F2; PED2 a PED4). Spec: docs/fases/F2-pedido.md, "Cálculo do pedido".
// Cada linha é a fotografia do momento da venda (pedido_itens): mudar o cardápio não muda pedido antigo.
import { buscar, type Cardapio, type Faixa, type ItemDePreco, normalizar, type Tamanho } from './cardapio';
import { type Centavos, formatarReais, menor, somar, somarPor, subtrair, ZERO } from './dinheiro';
import { falha, type Resultado, sucesso } from './resultado';

export type ItemPedido =
  | {
      tipo: 'pizza';
      tamanho: Tamanho;
      /** Um sabor, ou mais no meio a meio (PED3). */
      sabores: readonly string[];
      bordas?: readonly string[];
      adicionais?: readonly string[];
      quantidade?: number;
    }
  | { tipo: 'bebida'; nome: string; quantidade?: number }
  | { tipo: 'combo'; id: string; quantidade?: number }
  | { tipo: 'outro'; nome: string; quantidade?: number };

export interface PedidoParaPreco {
  itens: readonly ItemPedido[];
  /** PED2: taxa da área do pedido; 0 na retirada. */
  taxa: Centavos;
  /** O pedido marcado com a promoção da noite (o asterisco). */
  promocao: boolean;
  /** Desconto da noite; null quando a noite está "sem promoção" ou não definida. */
  promoDesconto: Centavos | null;
}

export interface LinhaDoPedido {
  /** "G ½ Filé Mignon ½ Calabresa", "Refrigerante 2L", "Combo 01". */
  nome: string;
  /** Bordas e adicionais da pizza, ou o que vem no combo. */
  detalhes: string[];
  /** PED3: a faixa do sabor que deu o preço. Só nas pizzas. */
  faixaCobrada: Faixa | null;
  /** Preço de uma unidade, com bordas e adicionais. */
  unitario: Centavos;
  /** PED4: desconto da promoção em cada unidade. */
  desconto: Centavos;
  quantidade: number;
  total: Centavos;
}

export interface PrecoDoPedido {
  linhas: LinhaDoPedido[];
  itens: Centavos;
  taxa: Centavos;
  total: Centavos;
}

const PROMO_MIN = 300 as Centavos;
const PROMO_MAX = 2300 as Centavos;

/** PED4: o desconto da noite vai de R$ 3 a R$ 23. */
export function validarPromocao(valor: Centavos): Resultado<Centavos> {
  if (valor < PROMO_MIN || valor > PROMO_MAX) {
    return falha(
      'promo_fora_da_faixa',
      `A promoção da noite vai de ${formatarReais(PROMO_MIN)} a ${formatarReais(PROMO_MAX)}.`,
    );
  }
  return sucesso(valor);
}

function acharPorNome(itens: readonly ItemDePreco[], nome: string): ItemDePreco | undefined {
  const alvo = normalizar(nome);
  return itens.find((i) => [i.nome, ...i.apelidos].some((n) => normalizar(n) === alvo));
}

type Parcial = Omit<LinhaDoPedido, 'quantidade' | 'total'>;

function linhaDaPizza(
  cardapio: Cardapio,
  item: Extract<ItemPedido, { tipo: 'pizza' }>,
  pedido: PedidoParaPreco,
): Resultado<Parcial> {
  if (item.sabores.length === 0) return falha('sem_sabor', 'Escolha o sabor da pizza.');
  const sabores = [];
  for (const texto of item.sabores) {
    const achados = buscar(cardapio.sabores, texto);
    const [sabor] = achados;
    if (!sabor) return falha('sabor_nao_encontrado', `Não achei o sabor "${texto}" no cardápio.`);
    if (achados.length > 1) {
      const opcoes = achados.map((s) => s.nome);
      return falha('sabor_ambiguo', `Qual sabor? ${opcoes.join(', ')}.`, opcoes);
    }
    sabores.push(sabor);
  }
  // PED3: o meio a meio é cobrado pelo sabor mais caro; no empate, vale a faixa do primeiro deles.
  const precoDe = (faixa: Faixa) => cardapio.faixas[faixa][item.tamanho];
  const cobrado = sabores.reduce((a, b) => (precoDe(b.faixa) > precoDe(a.faixa) ? b : a));
  const pizza = precoDe(cobrado.faixa);

  const extras: { nome: string; preco: Centavos }[] = [];
  for (const nome of item.bordas ?? []) {
    const borda = acharPorNome(cardapio.bordas, nome);
    if (!borda) return falha('borda_nao_encontrada', `Não achei a borda "${nome}" no cardápio.`);
    extras.push({ nome: `borda ${borda.nome}`, preco: borda.preco });
  }
  for (const nome of item.adicionais ?? []) {
    const adicional = acharPorNome(cardapio.adicionais, nome);
    if (!adicional) return falha('adicional_nao_encontrado', `Não achei o adicional "${nome}" no cardápio.`);
    extras.push({ nome: `+ ${adicional.nome}`, preco: adicional.preco });
  }

  // PED4 (provisório, pergunta 15): um desconto por pizza cobrada como tradicional, mesmo no meio a meio.
  const comPromo = pedido.promocao && pedido.promoDesconto !== null && cobrado.faixa === 'tradicional';
  const meio = sabores.length > 1 ? sabores.map((s) => `½ ${s.nome}`).join(' ') : (sabores[0]?.nome ?? '');
  return sucesso({
    nome: `${item.tamanho} ${meio}`,
    detalhes: extras.map((e) => e.nome),
    faixaCobrada: cobrado.faixa,
    unitario: somar(pizza, ...extras.map((e) => e.preco)),
    desconto: comPromo && pedido.promoDesconto !== null ? menor(pedido.promoDesconto, pizza) : ZERO,
  });
}

function linhaSimples(cardapio: Cardapio, item: Exclude<ItemPedido, { tipo: 'pizza' }>): Resultado<Parcial> {
  const naoAchei = (nome: string) => falha('item_nao_encontrado', `Não achei "${nome}" no cardápio.`);
  const simples = (nome: string, preco: Centavos, detalhes: string[] = []) =>
    sucesso({ nome, detalhes, faixaCobrada: null, unitario: preco, desconto: ZERO });
  if (item.tipo === 'combo') {
    const combo = cardapio.combos.find((c) => c.id === item.id);
    return combo ? simples(`Combo ${combo.id}`, combo.preco, [...combo.itens]) : naoAchei(`Combo ${item.id}`);
  }
  const achado = acharPorNome(item.tipo === 'bebida' ? cardapio.bebidas : cardapio.outros, item.nome);
  return achado ? simples(achado.nome, achado.preco) : naoAchei(item.nome);
}

/** PED2: total = itens (com a promoção da noite, PED4) + taxa da área. */
export function precoDoPedido(cardapio: Cardapio, pedido: PedidoParaPreco): Resultado<PrecoDoPedido> {
  if (pedido.itens.length === 0) return falha('sem_itens', 'O pedido está sem itens.');
  const linhas: LinhaDoPedido[] = [];
  for (const item of pedido.itens) {
    const quantidade = item.quantidade ?? 1;
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return falha('quantidade_invalida', 'A quantidade tem de ser 1 ou mais.');
    }
    const r = item.tipo === 'pizza' ? linhaDaPizza(cardapio, item, pedido) : linhaSimples(cardapio, item);
    if (!r.ok) return r;
    const total = (subtrair(r.valor.unitario, r.valor.desconto) * quantidade) as Centavos;
    linhas.push({ ...r.valor, quantidade, total });
  }
  const itens = somarPor(linhas, (l) => l.total);
  return sucesso({ linhas, itens, taxa: pedido.taxa, total: somar(itens, pedido.taxa) });
}
