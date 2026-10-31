// Folha da noite no fechamento (MVP.md): os motoboys na ordem de chegada, a coluna PIX e os totais.
// Em 80 mm não cabem colunas lado a lado: cada motoboy vira um bloco, como uma coluna do papel.
import type { ContaAcerto, EstadoSaida } from '../acerto';
import { type Centavos, formatarValor } from '../dinheiro';
import { formatarData } from '../noite';
import type { Forma } from '../pagamento';
import type { ResumoNoite } from '../resumo';
import { escapar } from './recibo';

export const SIGLA_FORMA: Record<Forma, string> = {
  dinheiro: 'din',
  cartao: 'cartão',
  pix_maquininha: 'pix maq',
  pix_antecipado: 'pix',
};

export interface LinhaDaFolha {
  codigo: string;
  formas: readonly Forma[];
  estado: EstadoSaida;
  trocoPix: Centavos;
  papelConferido: boolean;
}

export interface ColunaDaFolha {
  ordem: number;
  motoboy: string;
  linhas: readonly LinhaDaFolha[];
  conta: Pick<ContaAcerto, 'caixaInicial' | 'entregues' | 'voltaram' | 'devolver' | 'receber' | 'liquidacao'>;
  confirmado: boolean;
}

export interface DadosFolha {
  /** AAAA-MM-DD */
  data: string;
  /** "23:59", no fuso da pizzaria. */
  hora: string;
  colunas: readonly ColunaDaFolha[];
  pix: readonly { codigo: string; valor: Centavos; confirmado: boolean }[];
  resumo: ResumoNoite;
}

const v = (c: Centavos) => formatarValor(c);

function linhaDoCodigo(l: LinhaDaFolha): string {
  const codigo = `~~${escapar(l.codigo)}~~`;
  if (l.estado === 'voltou') return `|${codigo}voltou`;
  const formas = l.formas.map((f) => SIGLA_FORMA[f]).join('+');
  // cp860 (impressora térmica) não tem → nem •: vai em ASCII.
  const troco = l.trocoPix > 0 ? ` ->${v(l.trocoPix)}` : '';
  // T18: sem "Voltou", a saída conta como entregue (decisão 0007); não há "em rota" na folha.
  const papel = l.papelConferido ? '' : ' *';
  return `|${codigo}${formas}${troco}${papel}`;
}

export function folhaDaNoite(d: DadosFolha): string {
  const r = d.resumo;
  const blocos = [...d.colunas]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((c) => [
      '{width: auto}',
      `"${c.ordem} ${escapar(c.motoboy)}" | caixa ${v(c.conta.caixaInicial)}`,
      ...c.linhas.map(linhaDoCodigo),
      '{width: *,10}',
      `${c.conta.entregues} entregas${c.conta.voltaram > 0 ? `, ${c.conta.voltaram} voltou` : ''} |`,
      `Devolve | ${v(c.conta.devolver)}`,
      `Recebe | ${v(c.conta.receber)}`,
      c.confirmado && c.conta.liquidacao
        ? `Acerto confirmado: pago | ${v(c.conta.liquidacao.pagar)}`
        : 'Acerto pendente |',
      '-',
    ]);

  const partes = [
    '^MEL PIZZARIA',
    'FOLHA DA NOITE',
    '-',
    `Noite: ${formatarData(d.data)} | Impressa às ${escapar(d.hora)}`,
    '-',
    ...blocos,
    '{width: auto}',
    '"PIX"',
    ...(d.pix.length === 0 ? ['|Nenhum Pix antecipado'] : []),
    '{width: *,10}',
    ...d.pix.map((p) => `~~${escapar(p.codigo)}~~${p.confirmado ? 'caiu' : 'conferir'} | ${v(p.valor)}`),
    '-',
    '{width: auto}',
    '"RESUMO"',
    '{width: *,10}',
    `Dinheiro | ${v(r.porForma.dinheiro)}`,
    ...(r.porForma.troco > 0 ? [`Troco por Pix | ${v(r.porForma.troco)}`] : []),
    `Cartão | ${v(r.porForma.cartao)}`,
    `Pix na maquininha | ${v(r.porForma.pixMaquina)}`,
    `Pix antecipado | ${v(r.porForma.pixAntecipado)}`,
    '-',
    `Pago aos motoboys | ${v(r.pagoMotoboys)}`,
    `Retirado do caixa da empresa | ${v(r.retiradoCaixaEmpresa)}`,
    `Foi para a empresa | ${v(r.vaiParaEmpresa)}`,
    ...(r.faltas > 0 ? [`Faltas | ${v(r.faltas)}`] : []),
    ...(r.sobras > 0 ? [`Sobras (retidas) | ${v(r.sobras)}`] : []),
    `Entregas | ${r.entregas}`,
    ...(r.pendentes > 0 ? ['{width: auto}', `|Atenção: ${r.pendentes} caixa(s) sem acerto`] : []),
    '=',
  ];
  return `${partes.join('\n')}\n`;
}
