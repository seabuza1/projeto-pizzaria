// Lançar comanda de papel (F1, Fluxo da noite, passo 5): código, total, área, forma e motoboy.
// Tocar na forma já lança. Com um caixa só, o motoboy já vem escolhido.
import { centavos, type Forma, lerValor, validarLancamento } from '@mel/dominio';
import { useEffect, useRef, useState } from 'react';
import { acoes, areaSugerida, type LinhaPagamento, type Pedido, useAreas } from '../data/repo';
import { mostrarAviso } from './avisos';
import { EditorPagamentos } from './EditorPagamentos';
import { marcarEdicao } from './edicao';
import { Botao, Chip, curto, Folha, NOME_FORMA } from './ui';

const FORMAS: Forma[] = ['dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado'];

export interface CaixaParaLancar {
  id: string;
  nome: string;
}

export function LancarComanda({
  caixas,
  pedidosDaNoite,
  aoLancar,
}: {
  caixas: readonly CaixaParaLancar[];
  pedidosDaNoite: Pedido[];
  aoLancar?: () => void;
}) {
  const areas = useAreas();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const caixaId = caixas.length === 1 ? caixas[0]?.id : escolhido;
  const [codigo, setCodigo] = useState('');
  const [totalTexto, setTotalTexto] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [mais, setMais] = useState(false);
  const [trocoTexto, setTrocoTexto] = useState('');
  const [dividido, setDividido] = useState(false);
  const [repetidoArmado, setRepetidoArmado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const refTotal = useRef<HTMLInputElement>(null);

  useEffect(() => {
    marcarEdicao('lancar', codigo !== '' || totalTexto !== '');
    return () => marcarEdicao('lancar', false);
  }, [codigo, totalTexto]);

  function limpar() {
    setCodigo('');
    setTotalTexto('');
    setAreaId(null);
    setMais(false);
    setTrocoTexto('');
    setRepetidoArmado(null);
    setErro('');
  }

  async function digitarCodigo(valor: string) {
    const digitos = valor.replace(/\D/g, '').slice(0, 4);
    setCodigo(digitos);
    setRepetidoArmado(null);
    if (digitos.length === 4) {
      refTotal.current?.focus();
      // Área sugerida: a do último pedido com o mesmo código.
      const sugerida = await areaSugerida(digitos);
      if (sugerida) setAreaId((atual) => atual ?? sugerida);
    }
  }

  async function lancar(pagamentos: LinhaPagamento[]) {
    const total = lerValor(totalTexto);
    if (!total.ok) return setErro('Digite o total, por exemplo 113.');
    if (!areaId) return setErro('Escolha a área.');
    if (!caixaId) return setErro('Escolha o motoboy.');
    const valido = validarLancamento({ codigo, total: total.valor, pagamentos });
    if (!valido.ok) return setErro(valido.erro.mensagem);
    // PED1: o código pode repetir na noite; o app avisa e pede um segundo toque.
    const repetido = pedidosDaNoite.some((p) => p.codigo === codigo && p.estado !== 'cancelado');
    if (repetido && repetidoArmado !== codigo) {
      setRepetidoArmado(codigo);
      return setErro(`${codigo} já foi lançada hoje. Toque de novo para lançar outra.`);
    }
    const saidaId = await acoes.lancar({ caixaId, codigo, total: total.valor, areaId, pagamentos });
    const lancado = codigo;
    limpar();
    aoLancar?.();
    mostrarAviso(`${lancado} lançada`, { desfazer: () => void acoes.cancelarSaida(saidaId, 'Desfeito ao lançar') });
  }

  function tocarForma(forma: Forma) {
    const total = lerValor(totalTexto);
    if (!total.ok) return setErro('Digite o total, por exemplo 113.');
    const troco = trocoTexto.trim() === '' ? null : lerValor(trocoTexto);
    if (troco && !troco.ok) return setErro('Troco por Pix inválido.');
    void lancar([{ forma, valor: total.valor, trocoPix: troco?.valor ?? 0 }]);
  }

  const totalLido = lerValor(totalTexto);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao/40 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          className="numero min-h-14 rounded-xl border border-borda bg-cartao px-3 text-3xl tracking-widest"
          inputMode="numeric"
          placeholder="Código"
          aria-label="Código"
          value={codigo}
          onChange={(e) => void digitarCodigo(e.target.value)}
        />
        <input
          ref={refTotal}
          className="numero min-h-14 rounded-xl border border-borda bg-cartao px-3 text-3xl"
          inputMode="decimal"
          placeholder="Total"
          aria-label="Total"
          value={totalTexto}
          onChange={(e) => setTotalTexto(e.target.value)}
        />
      </div>

      {caixas.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {caixas.map((c) => (
            <Chip key={c.id} ativo={c.id === caixaId} onClick={() => setEscolhido(c.id)}>
              {c.nome}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <Chip key={a.id} ativo={a.id === areaId} onClick={() => setAreaId(a.id)}>
            {a.nome} <span className="numero text-apagado">{curto(a.taxa)}</span>
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FORMAS.map((f) => (
          <Botao key={f} variante="normal" className="min-h-14 text-lg" onClick={() => tocarForma(f)}>
            {NOME_FORMA[f]}
          </Botao>
        ))}
      </div>

      {erro && <p className="text-erro">{erro}</p>}

      <button type="button" className="min-h-12 text-left text-apagado" onClick={() => setMais((m) => !m)}>
        {mais ? '▾' : '▸'} Mais opções
      </button>
      {mais && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2 text-apagado">
            Troco por Pix (pagou em dinheiro a mais)
            <input
              className="numero min-h-12 w-28 rounded-xl border border-borda bg-cartao px-3 text-right text-texto"
              inputMode="decimal"
              placeholder="0"
              value={trocoTexto}
              onChange={(e) => setTrocoTexto(e.target.value)}
            />
          </label>
          <Botao
            onClick={() => {
              if (!totalLido.ok) return setErro('Digite o total antes de dividir.');
              setErro('');
              setDividido(true);
            }}
          >
            Pagou de mais de um jeito
          </Botao>
        </div>
      )}

      <Folha
        aberta={dividido}
        aoFechar={() => setDividido(false)}
        titulo={`${codigo || 'Comanda'} · pagamento dividido`}
      >
        {dividido && totalLido.ok && (
          <EditorPagamentos
            total={centavos(totalLido.valor)}
            rotulo="Lançar"
            aoConfirmar={(linhas) => {
              setDividido(false);
              void lancar(linhas);
            }}
          />
        )}
      </Folha>
    </div>
  );
}
