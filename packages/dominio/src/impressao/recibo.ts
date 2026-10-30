// Layout da impressão em marcação ReceiptLine (80 mm, 48 colunas). O mesmo texto vira ESC/POS no agente
// e SVG na prévia. Linha "Rótulo | valor": o rótulo cola à esquerda e o valor à direita.
import type { ContaAcerto } from '../acerto';
import { type Centavos, formatarValor } from '../dinheiro';
import { formatarData } from '../noite';
import type { Forma } from '../pagamento';

/** Texto livre (nomes, áreas) não pode virar comando da marcação. */
export function escapar(texto: string): string {
  return texto.replace(/[\\|{}~_"`^\-=]/g, (c) => `\\${c}`);
}

const v = (c: Centavos) => formatarValor(c);
const linha = (rotulo: string, valor: Centavos) => `${rotulo} | ${v(valor)}`;
const REGUA = '-';

export const NOME_FORMA_RECIBO: Record<Forma, string> = {
  dinheiro: 'dinheiro',
  cartao: 'cartão',
  pix_maquininha: 'Pix na maquininha',
  pix_antecipado: 'Pix antecipado',
};

export interface DadosRecibo {
  /** AAAA-MM-DD */
  data: string;
  motoboy: string;
  ordem: number;
  confirmadoPor: string;
  /** "23:48", já no fuso da pizzaria. */
  hora: string;
  conta: ContaAcerto;
  nomeArea: (areaId: string) => string;
  /** Códigos das saídas que voltaram. */
  voltaram: readonly string[];
  pix: readonly { codigo: string; confirmado: boolean }[];
}

/** Recibo do acerto (MVP.md), com espaço para as duas assinaturas. */
export function reciboDoAcerto(d: DadosRecibo): string {
  const { conta } = d;
  const l = conta.liquidacao;
  if (!l) throw new Error('Recibo sem dinheiro contado');

  const areas = Object.entries(conta.porArea)
    .filter(([, t]) => t.entregues > 0)
    .map(([id, t]) => `${escapar(d.nomeArea(id))} ${t.entregues}`)
    .join(', ');
  const pix = d.pix.map((p) => `${escapar(p.codigo)}, ${p.confirmado ? 'caiu' : 'não confirmado'}`).join('; ');

  const partes = [
    '^MEL PIZZARIA',
    'ACERTO DO MOTOBOY',
    REGUA,
    `Noite: ${formatarData(d.data)} | Motoboy: ${escapar(d.motoboy)} (${d.ordem})`,
    `Confirmado por: ${escapar(d.confirmadoPor)} | ${escapar(d.hora)}`,
    REGUA,
    `|Entregas: ${conta.entregues}${areas ? ` (${areas})` : ''}`,
    ...(d.voltaram.length > 0 ? [`|Voltaram: ${d.voltaram.length} (${d.voltaram.map(escapar).join(', ')})`] : []),
    ...(conta.pixAntecipado > 0 ? [`|Pix antecipado: ${v(conta.pixAntecipado)} (${pix})`] : []),
    REGUA,
    // Daqui para baixo: o rótulo ocupa o resto e o valor tem 10 colunas (não quebra "Retirado do caixa da empresa").
    '{width: *,10}',
    linha('Caixa inicial', conta.caixaInicial),
    linha('Dinheiro das vendas', conta.dinheiro),
    ...(conta.troco > 0 ? [linha('Troco por Pix', conta.troco)] : []),
    linha('"\\= Devolver"', conta.devolver),
    linha('Contado', l.dinheiroContado),
    linha('Diferença', l.dif),
    REGUA,
    linha('Diária', conta.diaria),
    linha('Taxas', conta.taxas),
    linha('"\\= Receber"', conta.receber),
    REGUA,
    linha('Pago do caixa dele', l.doCaixaDele),
    linha('Retirado do caixa da empresa', l.retiradoCaixaEmpresa),
    linha('Vai para a empresa', l.vaiParaEmpresa),
    ...(l.completa > 0 ? [linha('Completa do bolso', l.completa)] : []),
    ...(l.sobra > 0 ? [linha('Sobra (fica retida)', l.sobra)] : []),
    REGUA,
    linha('Maquininha esperada', conta.maquininha),
    ...conta.listaMaquininha.map((m) => `~~${escapar(m.codigo)}~~${NOME_FORMA_RECIBO[m.forma]} | ${v(m.valor)}`),
    '{width: auto}',
    `|Papéis faltando: ${conta.papelFaltando.length === 0 ? 'nenhum' : conta.papelFaltando.map((p) => escapar(p.codigo)).join(', ')}`,
    REGUA,
    '',
    '',
    `|Motoboy: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_~~~${escapar(d.confirmadoPor)}: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_`,
    '=',
  ];
  return `${partes.join('\n')}\n`;
}
