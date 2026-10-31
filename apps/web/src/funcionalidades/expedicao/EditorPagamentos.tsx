// "Pagou de mais de um jeito": linhas de forma e valor; a linha vazia fica com o resto.
// Também serve para "Trocou a forma" na porta.
import { centavos, completarResto, type Forma, lerValor, validarPagamentos } from '@mel/dominio';
import { useState } from 'react';
import { Botao, Chip, NOME_FORMA, reais } from '../../compartilhado/ui';
import type { LinhaPagamento } from '../../data/repo';

const FORMAS: Forma[] = ['dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado'];

interface Linha {
  forma: Forma;
  texto: string;
}

export function EditorPagamentos({
  total,
  inicial,
  rotulo,
  aoConfirmar,
}: {
  total: number;
  inicial?: LinhaPagamento[];
  rotulo: string;
  aoConfirmar: (linhas: LinhaPagamento[]) => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(
    inicial?.length
      ? inicial.map((l) => ({ forma: l.forma, texto: reais(l.valor).replace('R$ ', '') }))
      : [
          { forma: 'dinheiro', texto: '' },
          { forma: 'cartao', texto: '' },
        ],
  );
  const [troco, setTroco] = useState(inicial?.find((l) => l.trocoPix)?.trocoPix ?? 0);
  const [erro, setErro] = useState('');

  const mudar = (i: number, linha: Partial<Linha>) =>
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, ...linha } : l)));

  function confirmar() {
    const lidas: { forma: Forma; valor: ReturnType<typeof centavos> | null }[] = [];
    for (const l of linhas) {
      if (l.texto.trim() === '') {
        lidas.push({ forma: l.forma, valor: null });
        continue;
      }
      const v = lerValor(l.texto);
      if (!v.ok) return setErro(v.erro.mensagem);
      lidas.push({ forma: l.forma, valor: v.valor });
    }
    const completo = completarResto(centavos(total), lidas);
    if (!completo.ok) return setErro(completo.erro.mensagem);
    const comTroco = completo.valor.map((l, i) => ({
      forma: l.forma,
      valor: l.valor,
      // PAG4: o troco por Pix vai na primeira linha em dinheiro.
      trocoPix: l.forma === 'dinheiro' && completo.valor.findIndex((x) => x.forma === 'dinheiro') === i ? troco : 0,
    }));
    const valido = validarPagamentos(centavos(total), comTroco);
    if (!valido.ok) return setErro(valido.erro.mensagem);
    setErro('');
    aoConfirmar(valido.valor.map((p) => ({ forma: p.forma, valor: p.valor, trocoPix: p.trocoPix })));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-apagado">
        Total <span className="numero text-texto">{reais(total)}</span>. Deixe uma linha vazia para ficar com o resto.
      </p>
      {linhas.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as linhas não têm id e não mudam de ordem
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-borda p-2">
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map((f) => (
              <Chip key={f} ativo={l.forma === f} onClick={() => mudar(i, { forma: f })}>
                {NOME_FORMA[f]}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="numero min-h-12 flex-1 rounded-xl border border-borda bg-cartao px-3 text-lg"
              inputMode="decimal"
              placeholder="resto"
              value={l.texto}
              onChange={(e) => mudar(i, { texto: e.target.value })}
            />
            {linhas.length > 1 && (
              <Botao variante="fantasma" onClick={() => setLinhas((a) => a.filter((_, j) => j !== i))}>
                Tirar
              </Botao>
            )}
          </div>
        </div>
      ))}
      {linhas.length < 4 && (
        <Botao onClick={() => setLinhas((a) => [...a, { forma: 'dinheiro', texto: '' }])}>+ Outra forma</Botao>
      )}
      {linhas.some((l) => l.forma === 'dinheiro') && (
        <label className="flex items-center justify-between gap-2 text-apagado">
          Troco por Pix
          <input
            className="numero min-h-12 w-32 rounded-xl border border-borda bg-cartao px-3 text-right text-texto"
            inputMode="decimal"
            placeholder="0"
            defaultValue={troco ? reais(troco).replace('R$ ', '') : ''}
            onChange={(e) => {
              const v = e.target.value.trim() === '' ? null : lerValor(e.target.value);
              setTroco(v === null ? 0 : v.ok ? v.valor : -1);
            }}
          />
        </label>
      )}
      {erro && <p className="text-erro">{erro}</p>}
      <Botao variante="principal" onClick={confirmar}>
        {rotulo}
      </Botao>
    </div>
  );
}
