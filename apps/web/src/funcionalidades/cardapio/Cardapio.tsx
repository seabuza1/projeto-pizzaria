// Cardápio (F2, 2a): gerente e admin mudam preços e itens; gerente, expedição e atendimento marcam "acabou hoje".
// Pedido antigo não muda: cada pedido guarda a fotografia do preço (pedido_itens).
import { type Faixa, normalizar } from '@mel/dominio';
import { type FormEvent, useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { CampoValor } from '../../compartilhado/CampoValor';
import { IndicadorFila } from '../../compartilhado/status';
import { Botao, reais, Secao } from '../../compartilhado/ui';
import { acoes, type Perfil, useAcabou, useLinhasCardapio, useNoite } from '../../data/repo';

type Tipo = 'sabor' | 'borda' | 'adicional' | 'bebida' | 'combo';

const NOME_FAIXA: Record<Faixa, string> = {
  tradicional: 'Tradicional',
  especial: 'Especial',
  premium: 'Premium',
  doce: 'Doce',
  doce_especial: 'Doce especial',
};
const FAIXAS = Object.keys(NOME_FAIXA) as Faixa[];
const TAMANHOS = ['B', 'P', 'M', 'G'] as const;
const campo = 'min-h-12 rounded-xl border border-borda bg-cartao px-3';

function Topo() {
  return (
    <header className="sticky top-[var(--faixa)] z-30 flex items-center justify-between gap-2 border-b border-borda bg-fundo/95 px-3 py-2 backdrop-blur">
      <span className="font-semibold">Cardápio</span>
      <IndicadorFila />
    </header>
  );
}

interface Item {
  id: string;
  tipo: Tipo;
  nome: string;
  detalhe?: string;
  preco: number | null;
  ativo: boolean;
}

function LinhaItem({
  item,
  acabou,
  noiteId,
  gerente,
  aoMudarPreco,
  aoMudarAtivo,
}: {
  item: Item;
  acabou: boolean;
  noiteId: string | null;
  gerente: boolean;
  aoMudarPreco: (preco: number) => void;
  aoMudarAtivo: () => void;
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-borda py-2">
      <div className="flex items-center gap-2">
        <span className={`flex-1 ${acabou || !item.ativo ? 'text-apagado line-through' : ''}`}>
          {item.nome}
          {item.detalhe && <span className="block text-xs text-apagado">{item.detalhe}</span>}
        </span>
        {!gerente && item.preco !== null && <span className="numero">{reais(item.preco)}</span>}
        {noiteId && item.ativo && (
          <Botao
            aria-pressed={acabou}
            aria-label={`Acabou hoje: ${item.tipo} ${item.nome}`}
            variante={acabou ? 'perigo' : 'fantasma'}
            onClick={() =>
              void acoes.marcarAcabou({ noite_id: noiteId, tipo: item.tipo, item_id: item.id, acabou: !acabou })
            }
          >
            {acabou ? 'Acabou' : 'Tem'}
          </Botao>
        )}
      </div>
      {gerente && (
        <div className="flex items-center gap-2">
          {item.preco !== null && (
            <div className="flex-1">
              <CampoValor
                rotulo={`Preço de ${item.nome}`}
                inicial={item.preco}
                aoSalvar={(v) => v !== null && aoMudarPreco(v)}
              />
            </div>
          )}
          <Botao
            aria-pressed={item.ativo}
            aria-label={`${item.nome} ${item.ativo ? 'no cardápio' : 'fora do cardápio'}`}
            variante={item.ativo ? 'normal' : 'fantasma'}
            onClick={aoMudarAtivo}
          >
            {item.ativo ? 'No cardápio' : 'Fora'}
          </Botao>
        </div>
      )}
    </li>
  );
}

function NovoItem() {
  const [tipo, setTipo] = useState<Exclude<Tipo, 'combo'>>('bebida');
  const [nome, setNome] = useState('');
  const [faixa, setFaixa] = useState<Faixa>('tradicional');
  const [preco, setPreco] = useState<number | null>(null);

  function salvar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (n === '') return;
    if (tipo === 'sabor') void acoes.salvarItemCardapio({ tipo, nome: n, faixa, ativo: true, ordem: 999 });
    else if (preco !== null) void acoes.salvarItemCardapio({ tipo, nome: n, preco, ativo: true, ordem: 999 });
    else return;
    mostrarAviso(`${n} no cardápio`);
    setNome('');
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={salvar}>
      <select
        aria-label="Tipo do item"
        className={campo}
        value={tipo}
        onChange={(e) => setTipo(e.target.value as typeof tipo)}
      >
        <option value="sabor">Sabor de pizza</option>
        <option value="borda">Borda</option>
        <option value="adicional">Adicional</option>
        <option value="bebida">Bebida</option>
      </select>
      <input className={campo} placeholder="Nome do item" value={nome} onChange={(e) => setNome(e.target.value)} />
      {tipo === 'sabor' ? (
        <select aria-label="Faixa" className={campo} value={faixa} onChange={(e) => setFaixa(e.target.value as Faixa)}>
          {FAIXAS.map((f) => (
            <option key={f} value={f}>
              {NOME_FAIXA[f]}
            </option>
          ))}
        </select>
      ) : (
        <CampoValor rotulo="Preço do item novo" inicial={preco} aoSalvar={setPreco} />
      )}
      <Botao variante="principal" type="submit" disabled={nome.trim() === '' || (tipo !== 'sabor' && preco === null)}>
        Pôr no cardápio
      </Botao>
    </form>
  );
}

export function Cardapio({ perfil }: { perfil: Perfil }) {
  const linhas = useLinhasCardapio();
  const noite = useNoite();
  const noiteId = noite && !noite.fechada_em ? noite.id : null;
  const acabou = useAcabou(noiteId ?? undefined);
  const [busca, setBusca] = useState('');
  const gerente = perfil.papeis.some((p) => p === 'admin' || p === 'gerente');

  if (!linhas) return <Topo />;
  const alvo = normalizar(busca);
  const mostra = (i: Item) => alvo === '' || normalizar(i.nome).includes(alvo);

  const secoes: {
    titulo: string;
    itens: Item[];
    salvar: (i: Item, mudanca: { preco?: number; ativo?: boolean }) => void;
  }[] = [
    {
      titulo: 'Sabores',
      itens: linhas.sabores.map((s) => ({
        id: s.id,
        tipo: 'sabor',
        nome: s.nome,
        detalhe: NOME_FAIXA[s.faixa],
        preco: null,
        ativo: s.ativo,
      })),
      salvar: (i, m) => {
        const s = linhas.sabores.find((x) => x.id === i.id);
        if (s)
          void acoes.salvarItemCardapio({
            tipo: 'sabor',
            item_id: s.id,
            nome: s.nome,
            faixa: s.faixa,
            ...(s.ingredientes ? { ingredientes: s.ingredientes } : {}),
            apelidos: s.apelidos,
            ativo: m.ativo ?? s.ativo,
            ordem: s.ordem,
          });
      },
    },
    {
      titulo: 'Bordas',
      itens: linhas.bordas.map((b) => ({ id: b.id, tipo: 'borda', nome: b.nome, preco: b.preco, ativo: b.ativo })),
      salvar: (i, m) =>
        void acoes.salvarItemCardapio({
          tipo: 'borda',
          item_id: i.id,
          nome: i.nome,
          preco: m.preco ?? i.preco ?? 0,
          ativo: m.ativo ?? i.ativo,
          ordem: linhas.bordas.find((x) => x.id === i.id)?.ordem ?? 0,
        }),
    },
    {
      titulo: 'Adicionais',
      itens: linhas.adicionais.map((a) => ({
        id: a.id,
        tipo: 'adicional',
        nome: a.nome,
        ...(a.avulso ? { detalhe: 'avulso' } : {}),
        preco: a.preco,
        ativo: a.ativo,
      })),
      salvar: (i, m) => {
        const a = linhas.adicionais.find((x) => x.id === i.id);
        if (a)
          void acoes.salvarItemCardapio({
            tipo: 'adicional',
            item_id: a.id,
            nome: a.nome,
            preco: m.preco ?? a.preco,
            avulso: a.avulso,
            ativo: m.ativo ?? a.ativo,
            ordem: a.ordem,
          });
      },
    },
    {
      titulo: 'Bebidas',
      itens: linhas.bebidas.map((b) => ({ id: b.id, tipo: 'bebida', nome: b.nome, preco: b.preco, ativo: b.ativo })),
      salvar: (i, m) => {
        const b = linhas.bebidas.find((x) => x.id === i.id);
        if (b)
          void acoes.salvarItemCardapio({
            tipo: 'bebida',
            item_id: b.id,
            nome: b.nome,
            preco: m.preco ?? b.preco,
            grupo: b.grupo,
            apelidos: b.apelidos,
            ativo: m.ativo ?? b.ativo,
            ordem: b.ordem,
          });
      },
    },
    {
      titulo: 'Combos',
      itens: linhas.combos.map((c) => ({
        id: c.id,
        tipo: 'combo',
        nome: `Combo ${c.codigo}`,
        detalhe: c.itens.join(' + '),
        preco: c.preco,
        ativo: c.ativo,
      })),
      salvar: (i, m) => {
        const c = linhas.combos.find((x) => x.id === i.id);
        if (c)
          void acoes.salvarItemCardapio({
            tipo: 'combo',
            item_id: c.id,
            nome: c.codigo,
            itens: c.itens,
            preco: m.preco ?? c.preco,
            ativo: m.ativo ?? c.ativo,
            ordem: c.ordem,
          });
      },
    },
  ];

  return (
    <>
      <Topo />
      <div className="flex flex-col gap-3 p-3">
        <input
          className={campo}
          placeholder="Buscar no cardápio"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {!noiteId && <p className="text-sm text-apagado">Com a noite aberta, dá para marcar "acabou hoje".</p>}

        {gerente && alvo === '' && (
          <Secao titulo="Preço das pizzas">
            {FAIXAS.map((f) => (
              <div key={f} className="flex flex-col gap-1 border-b border-borda py-2">
                <span className="font-semibold">{NOME_FAIXA[f]}</span>
                {TAMANHOS.map((t) => {
                  const linha = linhas.faixas.find((x) => x.faixa === f && x.tamanho === t);
                  return (
                    <CampoValor
                      key={`${f}${t}-${linha?.preco}`}
                      rotulo={`${NOME_FAIXA[f]} ${t}`}
                      inicial={linha?.preco ?? null}
                      aoSalvar={(v) => v !== null && void acoes.salvarPrecoFaixa({ faixa: f, tamanho: t, preco: v })}
                    />
                  );
                })}
              </div>
            ))}
          </Secao>
        )}

        {secoes.map((s) => {
          const itens = s.itens.filter(mostra);
          if (itens.length === 0) return null;
          return (
            <Secao key={s.titulo} titulo={s.titulo}>
              <ul>
                {itens.map((i) => (
                  <LinhaItem
                    key={`${i.id}-${i.preco}-${i.ativo}`}
                    item={i}
                    acabou={acabou.has(i.id)}
                    noiteId={noiteId}
                    gerente={gerente}
                    aoMudarPreco={(preco) => s.salvar(i, { preco })}
                    aoMudarAtivo={() => s.salvar(i, { ativo: !i.ativo })}
                  />
                ))}
              </ul>
            </Secao>
          );
        })}

        {gerente && (
          <Secao titulo="Item novo">
            <NovoItem />
          </Secao>
        )}
      </div>
    </>
  );
}
