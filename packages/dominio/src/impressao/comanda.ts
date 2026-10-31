// Comanda impressa (F2, 2c), em marcação ReceiptLine (80 mm, 48 colunas). A mesma comanda vai à cozinha
// levada à mão, sai com o motoboy e volta com ele, com o comprovante da maquininha grampeado.
import { type Centavos, formatarValor, somarPor, subtrair } from '../dinheiro';
import { formatarDataCurta } from '../noite';
import type { Forma } from '../pagamento';
import { escapar, NOME_FORMA_RECIBO } from './recibo';

export interface DadosComanda {
  codigo: string;
  /** O asterisco da promoção da noite (PED4). */
  promocao: boolean;
  /** Reimpressão de pedido alterado depois de autorizado. */
  alterado: boolean;
  linhas: readonly {
    nome: string;
    detalhes: readonly string[];
    quantidade: number;
    desconto: Centavos;
    total: Centavos;
  }[];
  tipo: 'entrega' | 'retirada';
  area: string | null;
  endereco: string | null;
  referencia: string | null;
  /** Pino ou link do Maps: vira QR. */
  link: string | null;
  /** ENT8: telefone e endereço do cliente vão ao motoboy só na comanda. */
  telefone: string;
  cliente: string | null;
  total: Centavos;
  pagamentos: readonly { forma: Forma; valor: Centavos }[];
  trocoPara: Centavos | null;
  /** PAG5: null sem Pix antecipado; true "PIX PAGO"; false "PIX: CONFERIR". */
  pixPago: boolean | null;
  /** AAAA-MM-DD */
  data: string;
  /** "21:48", já no fuso da pizzaria. */
  hora: string;
}

const v = (c: Centavos) => formatarValor(c);
/** Valor de propriedade (o link do QR) também tem caracteres especiais. */
const escaparPropriedade = (texto: string) => texto.replace(/[\\|{}:;]/g, (c) => `\\${c}`);

function telefoneDaComanda(t: string): string {
  return `(${t.slice(0, 2)}) ${t.slice(2, -4)}-${t.slice(-4)}`;
}

export function comandaDoPedido(d: DadosComanda): string {
  const itens = somarPor(d.linhas, (l) => l.total);
  const taxa = subtrair(d.total, itens);
  const [unico] = d.pagamentos;
  const pagamento =
    d.pagamentos.length === 1 && unico
      ? [`|"${NOME_FORMA_RECIBO[unico.forma].toUpperCase()}"`]
      : ['{width: *,10}', ...d.pagamentos.map((p) => `${NOME_FORMA_RECIBO[p.forma]} | ${v(p.valor)}`), '{width: auto}'];

  const partes = [
    ...(d.alterado ? ['^^`ALTERADO`'] : []),
    `^^^^${escapar(d.codigo)}${d.promocao ? ' *' : ''}`,
    `${formatarDataCurta(d.data)} ${escapar(d.hora)} | "${d.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA'}"`,
    '-',
    '{width: *,10}',
    ...d.linhas.flatMap((l) => [
      `${l.quantidade > 1 ? `${l.quantidade} ` : ''}"${escapar(l.nome)}"${l.desconto > 0 ? ' *' : ''} | ${v(l.total)}`,
      ...l.detalhes.map((x) => `~~${escapar(x)} |`),
    ]),
    ...(taxa > 0 ? [`Taxa ${escapar(d.area ?? '')} | ${v(taxa)}`] : []),
    `^"TOTAL" | ^"${v(d.total)}"`,
    '{width: auto}',
    '-',
    ...pagamento,
    ...(d.trocoPara !== null ? [`|^"TROCO PARA ${v(d.trocoPara)}"`] : []),
    ...(d.pixPago === true ? ['|^"PIX PAGO"'] : d.pixPago === false ? ['|^`PIX: CONFERIR`'] : []),
    '-',
    ...(d.tipo === 'entrega'
      ? [
          `|^"${escapar(d.area ?? '?')}"`,
          ...(d.endereco ? [`|${escapar(d.endereco)}`] : []),
          ...(d.referencia ? [`|Ref.: ${escapar(d.referencia)}`] : []),
          ...(d.cliente ? [`|${escapar(d.cliente)}`] : []),
          `|Tel.: ${telefoneDaComanda(d.telefone)}`,
          ...(d.link ? ['', `{code:${escaparPropriedade(d.link)}; option:qrcode,6,m}`] : ['', '^^`SEM LOCALIZAÇÃO`']),
        ]
      : [
          '|Retirada no balcão',
          ...(d.cliente ? [`|${escapar(d.cliente)}`] : []),
          `|Tel.: ${telefoneDaComanda(d.telefone)}`,
        ]),
    '=',
  ];
  return `${partes.join('\n')}\n`;
}
