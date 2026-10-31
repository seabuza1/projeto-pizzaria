// Atendimento (F2, 2b e 2e): trava, código repetido, troco, resumo para o WhatsApp e "Repetir".
import type { Cardapio } from './cardapio';
import { type Centavos, formatarReais, somarPor } from './dinheiro';
import type { Forma } from './pagamento';
import { type ItemPedido, precoDoPedido } from './preco';
import { falha, type Resultado, sucesso } from './resultado';

/** A trava é liberada ao autorizar, ao cancelar ou depois de 10 min parado. */
export const TRAVA_MINUTOS = 10;

export const minutosParado = (desde: string, agora: Date): number =>
  Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 60_000));

/** "Atendendo 3557 em outro aparelho há 2 min" ou livre. */
export function situacaoDaTrava(
  trava: { aparelho: string | null; desde: string | null },
  meuAparelho: string,
  agora: Date,
): { livre: true } | { livre: false; minutos: number } {
  if (!trava.aparelho || !trava.desde || trava.aparelho === meuAparelho) return { livre: true };
  const minutos = minutosParado(trava.desde, agora);
  return minutos >= TRAVA_MINUTOS ? { livre: true } : { livre: false, minutos };
}

/** PED1: o código pode repetir na noite; o sistema avisa e pede um segundo toque. */
export function codigoRepetido(
  codigo: string,
  pedidosDaNoite: readonly { id: string; codigo: string; estado: string }[],
  pedidoAtualId?: string,
): boolean {
  return pedidosDaNoite.some((p) => p.codigo === codigo && p.id !== pedidoAtualId && p.estado !== 'cancelado');
}

/** "Troco para 100": só com parte em dinheiro e não menor que ela. */
export function validarTroco(
  trocoPara: Centavos | null,
  pagamentos: readonly { forma: Forma; valor: Centavos }[],
): Resultado<Centavos | null> {
  if (trocoPara === null) return sucesso(null);
  const dinheiro = somarPor(
    pagamentos.filter((p) => p.forma === 'dinheiro'),
    (p) => p.valor,
  );
  if (dinheiro === 0) return falha('troco_sem_dinheiro', 'Troco só com parte em dinheiro.');
  if (trocoPara < dinheiro) {
    return falha(
      'troco_menor',
      `O troco é para ${formatarReais(trocoPara)}, mas a parte em dinheiro é ${formatarReais(dinheiro)}.`,
    );
  }
  return sucesso(trocoPara);
}

const NA_FRASE: Record<Forma, string> = {
  dinheiro: 'em dinheiro',
  cartao: 'no cartão',
  pix_maquininha: 'no Pix na maquininha',
  pix_antecipado: 'no Pix antecipado',
};
const SOZINHO: Record<Forma, string> = {
  dinheiro: 'dinheiro',
  cartao: 'cartão',
  pix_maquininha: 'Pix na maquininha',
  pix_antecipado: 'Pix antecipado',
};

export interface ResumoParaCliente {
  codigo: string;
  linhas: readonly { nome: string; detalhes: readonly string[]; quantidade: number }[];
  tipo: 'entrega' | 'retirada';
  area: string | null;
  referencia: string | null;
  total: Centavos;
  pagamentos: readonly { forma: Forma; valor: Centavos }[];
  trocoPara: Centavos | null;
}

/** F2, 2b, passo 7: o texto pronto do "Mandar resumo". */
export function resumoDoPedido(r: ResumoParaCliente): string {
  const itens = r.linhas
    .map((l) => {
      const qtd = l.quantidade > 1 ? `${l.quantidade} ` : '';
      const detalhes = l.detalhes.length > 0 ? ` (${l.detalhes.join(', ')})` : '';
      return `${qtd}${l.nome}${detalhes}`;
    })
    .join(' + ');
  const onde =
    r.tipo === 'retirada'
      ? 'retirada no balcão'
      : `entrega em ${r.area ?? '?'}${r.referencia ? ` (${r.referencia})` : ''}`;
  const [unico] = r.pagamentos;
  let pagamento: string;
  if (r.pagamentos.length === 1 && unico) {
    pagamento = unico.forma === 'pix_antecipado' ? SOZINHO.pix_antecipado : `${SOZINHO[unico.forma]} na ${r.tipo}`;
  } else {
    pagamento = r.pagamentos.map((p) => `${formatarReais(p.valor)} ${NA_FRASE[p.forma]}`).join(' + ');
  }
  const troco = r.trocoPara !== null ? `, troco para ${formatarReais(r.trocoPara)}` : '';
  return `Pedido ${r.codigo}: ${itens} · ${onde} · total ${formatarReais(r.total)} · ${pagamento}${troco}. Posso mandar para a produção?`;
}

/** Abre a conversa do cliente com o texto pronto; o atendente só aperta Enter. */
export const linkWhatsApp = (telefone: string, texto: string): string =>
  `https://wa.me/55${telefone}?text=${encodeURIComponent(texto)}`;

/** F2, 2e: "Avisar" a retirada. */
export const avisoRetirada = (codigo: string): string => `Seu pedido ${codigo} está pronto para retirada.`;

/** Como o item aparece na tela ("2 G Calabresa", "M ½ Calabresa ½ Portuguesa", "Combo 01"). */
export function descreverItem(item: ItemPedido): string {
  const qtd = (item.quantidade ?? 1) > 1 ? `${item.quantidade} ` : '';
  if (item.tipo === 'pizza') {
    const sabores = item.sabores.length > 1 ? item.sabores.map((s) => `½ ${s}`).join(' ') : (item.sabores[0] ?? '');
    return `${qtd}${item.tamanho} ${sabores}`;
  }
  return `${qtd}${item.tipo === 'combo' ? `Combo ${item.id}` : item.nome}`;
}

/** "Repetir" um pedido antigo: os itens voltam com o preço de hoje; o que saiu do cardápio fica de fora. */
export function repetirPedido(
  itens: readonly ItemPedido[],
  cardapio: Cardapio,
): { itens: ItemPedido[]; fora: string[] } {
  const valem: ItemPedido[] = [];
  const fora: string[] = [];
  for (const item of itens) {
    const r = precoDoPedido(cardapio, { itens: [item], taxa: 0 as Centavos, promocao: false, promoDesconto: null });
    if (r.ok) valem.push(item);
    else fora.push(descreverItem(item));
  }
  return { itens: valem, fora };
}
