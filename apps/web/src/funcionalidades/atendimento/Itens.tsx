// Itens do pedido (F2, 2b, passo 3): busca com 2 ou 3 letras, tamanho em chips, meio a meio tocando no
// segundo sabor, borda, adicional, bebida e combo. O que acabou hoje aparece riscado e não entra.
import { buscar, type Cardapio, descreverItem, type ItemPedido, type Tamanho } from '@mel/dominio';
import { useState } from 'react';
import { Botao, Chip, reais } from '../../compartilhado/ui';

const TAMANHOS: Tamanho[] = ['B', 'P', 'M', 'G'];

type Pizza = Extract<ItemPedido, { tipo: 'pizza' }>;

export function Itens({
  cardapio,
  acabou,
  itens,
  aoMudar,
}: {
  /** Cardápio de venda (sem o que acabou) e os nomes do que acabou hoje, para mostrar riscado. */
  cardapio: Cardapio;
  acabou: readonly string[];
  itens: readonly ItemPedido[];
  aoMudar: (itens: ItemPedido[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const [tamanho, setTamanho] = useState<Tamanho>('G');
  const [pizza, setPizza] = useState<Pizza | null>(null);

  const texto = busca.trim();
  const curta = texto.length < 2;
  const sabores = curta ? [] : buscar(cardapio.sabores, texto).slice(0, 8);
  const bebidas = curta ? [] : buscar(cardapio.bebidas, texto).slice(0, 6);
  const outros = curta ? [] : buscar(cardapio.outros, texto).slice(0, 3);
  const combos = curta
    ? []
    : cardapio.combos.filter((c) => `combo ${c.id}`.includes(texto.toLowerCase()) || c.id === texto);
  const riscados = curta ? [] : acabou.filter((n) => n.toLowerCase().includes(texto.toLowerCase()));

  function adicionar(item: ItemPedido) {
    aoMudar([...itens, item]);
    setBusca('');
  }

  function tocarSabor(nome: string) {
    // Meio a meio: o segundo sabor tocado entra na mesma pizza.
    if (pizza && pizza.sabores.length === 1 && pizza.sabores[0] !== nome) {
      setPizza({ ...pizza, sabores: [...pizza.sabores, nome] });
    } else {
      setPizza({ tipo: 'pizza', tamanho, sabores: [nome] });
    }
    setBusca('');
  }

  function mudarQuantidade(i: number, delta: number) {
    const novo = [...itens];
    const item = novo[i];
    if (!item) return;
    const quantidade = (item.quantidade ?? 1) + delta;
    if (quantidade < 1) novo.splice(i, 1);
    else novo[i] = { ...item, quantidade };
    aoMudar(novo);
  }

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex gap-2" aria-label="Tamanho">
        {TAMANHOS.map((t) => (
          <Chip
            key={t}
            ativo={tamanho === t}
            onClick={() => {
              setTamanho(t);
              if (pizza) setPizza({ ...pizza, tamanho: t });
            }}
          >
            {t}
          </Chip>
        ))}
      </fieldset>
      <input
        className="min-h-12 rounded-xl border border-borda bg-cartao px-3"
        placeholder="Buscar sabor, bebida ou combo"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {!curta && (
        <section className="flex flex-wrap gap-2" aria-label="Resultados">
          {sabores.map((s) => (
            <Chip key={`s-${s.nome}`} onClick={() => tocarSabor(s.nome)}>
              {s.nome}
            </Chip>
          ))}
          {bebidas.map((b) => (
            <Chip key={`b-${b.nome}`} onClick={() => adicionar({ tipo: 'bebida', nome: b.nome })}>
              {b.nome} <span className="numero text-apagado">{reais(b.preco)}</span>
            </Chip>
          ))}
          {outros.map((o) => (
            <Chip key={`o-${o.nome}`} onClick={() => adicionar({ tipo: 'outro', nome: o.nome })}>
              {o.nome}
            </Chip>
          ))}
          {combos.map((c) => (
            <Chip key={`c-${c.id}`} onClick={() => adicionar({ tipo: 'combo', id: c.id })}>
              Combo {c.id} <span className="numero text-apagado">{reais(c.preco)}</span>
            </Chip>
          ))}
          {riscados.map((n) => (
            <span key={`x-${n}`} className="flex min-h-12 items-center px-3 text-apagado line-through">
              {n} (acabou)
            </span>
          ))}
          {sabores.length + bebidas.length + outros.length + combos.length + riscados.length === 0 && (
            <span className="text-sm text-apagado">Nada com "{texto}".</span>
          )}
        </section>
      )}

      {pizza && (
        <section aria-label="Pizza" className="flex flex-col gap-2 rounded-xl border border-mel p-2">
          <span className="font-semibold">{descreverItem(pizza)}</span>
          {pizza.sabores.length === 1 && (
            <span className="text-xs text-apagado">Toque em outro sabor para meio a meio.</span>
          )}
          <select
            aria-label="Borda"
            className="min-h-12 rounded-xl border border-borda bg-cartao px-3"
            value={pizza.bordas?.[0] ?? ''}
            onChange={(e) => setPizza({ ...pizza, bordas: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Sem borda</option>
            {cardapio.bordas.map((b) => (
              <option key={b.nome} value={b.nome}>
                Borda {b.nome} ({reais(b.preco)})
              </option>
            ))}
          </select>
          <fieldset className="flex flex-wrap gap-1" aria-label="Adicionais">
            {cardapio.adicionais.map((a) => {
              const tem = pizza.adicionais?.includes(a.nome) ?? false;
              return (
                <Chip
                  key={a.nome}
                  ativo={tem}
                  onClick={() =>
                    setPizza({
                      ...pizza,
                      adicionais: tem
                        ? (pizza.adicionais ?? []).filter((x) => x !== a.nome)
                        : [...(pizza.adicionais ?? []), a.nome],
                    })
                  }
                >
                  + {a.nome}
                </Chip>
              );
            })}
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="fantasma" onClick={() => setPizza(null)}>
              Descartar
            </Botao>
            <Botao
              variante="principal"
              onClick={() => {
                adicionar(pizza);
                setPizza(null);
              }}
            >
              Pôr no pedido
            </Botao>
          </div>
        </section>
      )}

      <ul aria-label="Itens do pedido" className="flex flex-col">
        {itens.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a lista só muda por estes botões
          <li key={i} className="flex min-h-12 items-center gap-2 border-b border-borda">
            <span className="flex-1">
              {descreverItem(item)}
              {item.tipo === 'pizza' && (item.bordas?.length || item.adicionais?.length) ? (
                <span className="block text-xs text-apagado">
                  {[
                    ...(item.bordas ?? []).map((b) => `borda ${b}`),
                    ...(item.adicionais ?? []).map((a) => `+ ${a}`),
                  ].join(', ')}
                </span>
              ) : null}
            </span>
            <Botao
              variante="fantasma"
              aria-label={`Menos ${descreverItem(item)}`}
              onClick={() => mudarQuantidade(i, -1)}
            >
              −
            </Botao>
            <Botao variante="fantasma" aria-label={`Mais ${descreverItem(item)}`} onClick={() => mudarQuantidade(i, 1)}>
              +
            </Botao>
          </li>
        ))}
      </ul>
    </div>
  );
}
