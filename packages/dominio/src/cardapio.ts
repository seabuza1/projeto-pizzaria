// Cardápio da Mel (F2, 2a): o formato de docs/dados/cardapio-mel.json e a busca do atendente.
// Preços do JSON em reais; aqui, em centavos. O schema Zod que confere o JSON fica em packages/db.
import { type Centavos, centavos } from './dinheiro';

export type Tamanho = 'B' | 'P' | 'M' | 'G';
export type Faixa = 'tradicional' | 'especial' | 'premium' | 'doce' | 'doce_especial';

/** O JSON do cardápio, como está em docs/dados (reais). */
export interface CardapioJson {
  pizzas: {
    faixas: Record<Faixa, Record<Tamanho, number>>;
    sabores: readonly { nome: string; faixa: Faixa; apelidos?: readonly string[] }[];
  };
  bordas: readonly { nome: string; preco: number }[];
  adicionais: { preco_cada: number; itens: readonly string[]; outros: readonly { nome: string; preco: number }[] };
  combos: readonly { id: string; itens: readonly string[]; preco: number }[];
  bebidas: readonly { nome: string; preco: number; apelidos?: readonly string[] }[];
}

export interface Sabor {
  nome: string;
  faixa: Faixa;
  apelidos: readonly string[];
}

export interface ItemDePreco {
  nome: string;
  preco: Centavos;
  apelidos: readonly string[];
}

export interface Cardapio {
  faixas: Record<Faixa, Record<Tamanho, Centavos>>;
  sabores: readonly Sabor[];
  bordas: readonly ItemDePreco[];
  /** Adicionais da pizza (R$ 10 cada no cardápio impresso). */
  adicionais: readonly ItemDePreco[];
  /** Itens avulsos com preço próprio (kit de molhos, cuba de creme de avelã). */
  outros: readonly ItemDePreco[];
  bebidas: readonly ItemDePreco[];
  combos: readonly { id: string; itens: readonly string[]; preco: Centavos }[];
}

const emCentavos = (reais: number) => centavos(Math.round(reais * 100));

function precosEmCentavos<K extends string>(precos: Record<K, number>): Record<K, Centavos> {
  return Object.fromEntries(Object.entries(precos).map(([k, v]) => [k, emCentavos(v as number)])) as Record<
    K,
    Centavos
  >;
}

export function cardapioEmCentavos(json: CardapioJson): Cardapio {
  const item = (i: { nome: string; preco: number; apelidos?: readonly string[] }): ItemDePreco => ({
    nome: i.nome,
    preco: emCentavos(i.preco),
    apelidos: i.apelidos ?? [],
  });
  return {
    faixas: Object.fromEntries(
      Object.entries(json.pizzas.faixas).map(([f, precos]) => [f, precosEmCentavos(precos as Record<Tamanho, number>)]),
    ) as Cardapio['faixas'],
    sabores: json.pizzas.sabores.map((s) => ({ nome: s.nome, faixa: s.faixa, apelidos: s.apelidos ?? [] })),
    bordas: json.bordas.map(item),
    adicionais: json.adicionais.itens.map((nome) => item({ nome, preco: json.adicionais.preco_cada })),
    outros: json.adicionais.outros.map(item),
    bebidas: json.bebidas.map(item),
    combos: json.combos.map((c) => ({ id: c.id, itens: c.itens, preco: emCentavos(c.preco) })),
  };
}

/** "Filé c/ Catupiry" → "file c catupiry": sem acento, minúsculas e só letras e números. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A palavra digitada é o começo da palavra do cardápio, com até uma letra trocada ("frango" acha "franguinho"). */
function comecaCom(palavra: string, digitada: string): boolean {
  if (palavra.length < digitada.length) return false;
  if (digitada.length < 4) return palavra.startsWith(digitada);
  let trocas = 0;
  for (let i = 0; i < digitada.length; i++) if (palavra[i] !== digitada[i]) trocas++;
  return trocas <= 1;
}

/**
 * Busca do atendente. O nome ou apelido exato resolve sozinho; senão, cada palavra digitada
 * tem de começar uma palavra do nome ou de um apelido. Ordem do cardápio.
 */
export function buscar<T extends { nome: string; apelidos: readonly string[] }>(
  itens: readonly T[],
  texto: string,
): T[] {
  const alvo = normalizar(texto);
  if (alvo === '') return [];
  const nomes = (i: T) => [i.nome, ...i.apelidos].map(normalizar);
  const exato = itens.filter((i) => nomes(i).includes(alvo));
  if (exato.length > 0) return exato;
  const digitadas = alvo.split(' ');
  return itens.filter((i) => {
    const palavras = nomes(i).flatMap((n) => n.split(' '));
    return digitadas.every((d) => palavras.some((p) => comecaCom(p, d)));
  });
}

/** F2, P11: os sabores que o texto pode querer dizer. */
export function opcoesDeSabor(cardapio: Pick<Cardapio, 'sabores'>, texto: string): string[] {
  return buscar(cardapio.sabores, texto).map((s) => s.nome);
}
