// /atendimento (F2, 2b e 2e): a lateral com os pedidos abertos ("aguardando cliente há 8 min") e as retiradas,
// e o pedido em edição. Tela larga ao lado do WhatsApp Web; no celular, uma coluna só.
import { avisoRetirada, linkWhatsApp, minutosParado, situacaoDaTrava } from '@mel/dominio';
import { useEffect, useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { IndicadorFila } from '../../compartilhado/status';
import { Botao, DoisToques } from '../../compartilhado/ui';
import { acoes, meuAparelho, type Pedido, useDadosNoite, useNoite } from '../../data/repo';
import { Editor, type Formulario, formularioDoPedido, formularioVazio } from './Editor';

const ESTADO: Partial<Record<Pedido['estado'], string>> = {
  rascunho: 'digitando',
  aguardando: 'aguardando cliente',
  em_producao: 'em produção',
};

function useAgora(ms = 30_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

export function Atendimento() {
  const noite = useNoite();
  const aberta = noite && !noite.fechada_em ? noite : null;
  const dados = useDadosNoite(aberta?.id);
  const agora = useAgora();
  const [edicao, setEdicao] = useState<{ chave: number; inicial: Formulario }>({
    chave: 0,
    inicial: formularioVazio(),
  });
  const abrir = (inicial: Formulario) => setEdicao((e) => ({ chave: e.chave + 1, inicial }));

  if (dados === undefined) return null;
  const abertos = dados.pedidos
    .filter((p) => p.estado === 'rascunho' || p.estado === 'aguardando')
    .sort((a, b) => a.atualizado_em.localeCompare(b.atualizado_em));
  const producao = dados.pedidos
    .filter((p) => p.estado === 'em_producao' && p.origem !== 'papel')
    .sort((a, b) => (a.autorizado_em ?? '').localeCompare(b.autorizado_em ?? ''));

  function abrirPedido(p: Pedido) {
    const trava = situacaoDaTrava({ aparelho: p.atendendo_aparelho, desde: p.atendendo_desde }, meuAparelho(), agora);
    if (!trava.livre) void acoes.assumirPedido(p.id);
    abrir(formularioDoPedido(p));
  }

  return (
    <>
      <header className="sticky top-[var(--faixa)] z-30 flex items-center justify-between gap-2 border-b border-borda bg-fundo/95 px-3 py-2 backdrop-blur">
        <span className="font-semibold">Atendimento</span>
        <IndicadorFila />
      </header>
      <div className="grid gap-3 p-3 lg:grid-cols-[18rem_1fr]">
        <aside aria-label="Pedidos abertos" className="flex flex-col gap-2">
          <Botao variante="principal" onClick={() => abrir(formularioVazio())}>
            Novo pedido
          </Botao>
          {abertos.map((p) => {
            const trava = situacaoDaTrava(
              { aparelho: p.atendendo_aparelho, desde: p.atendendo_desde },
              meuAparelho(),
              agora,
            );
            return (
              <button
                type="button"
                key={p.id}
                className="flex min-h-12 flex-col items-start rounded-xl border border-borda bg-cartao px-3 py-2 text-left"
                onClick={() => abrirPedido(p)}
              >
                <span className="numero text-lg">{p.codigo}</span>
                <span className="text-xs text-aviso">
                  {ESTADO[p.estado]} há {minutosParado(p.atualizado_em, agora)} min
                  {!trava.livre && ' · em outro aparelho'}
                </span>
              </button>
            );
          })}
          {producao.length > 0 && <h2 className="pt-2 text-sm text-apagado">Em produção</h2>}
          {producao.map((p) => (
            <div key={p.id} className="flex flex-col gap-1 rounded-xl border border-borda px-3 py-2">
              <button
                type="button"
                className="flex min-h-10 items-center justify-between"
                onClick={() => abrirPedido(p)}
              >
                <span className="numero text-lg">{p.codigo}</span>
                <span className="text-xs text-apagado">
                  {p.tipo === 'retirada' ? 'retirada' : 'entrega'}
                  {p.alterado && ' · alterado'}
                </span>
              </button>
              {/* F2, 2e: "Avisar" abre a conversa com a mensagem pronta; "Retirado" encerra. */}
              {p.tipo === 'retirada' && p.telefone && (
                <div className="grid grid-cols-2 gap-2">
                  <Botao
                    onClick={() =>
                      window.open(linkWhatsApp(p.telefone ?? '', avisoRetirada(p.codigo)), '_blank', 'noopener')
                    }
                  >
                    Avisar
                  </Botao>
                  <DoisToques
                    rotulo="Retirado"
                    aoConfirmar={() => {
                      void acoes.marcarRetirado(p.id);
                      mostrarAviso(`${p.codigo} retirado`);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </aside>
        <main>
          <Editor
            key={edicao.chave}
            noite={aberta}
            dados={dados}
            inicial={edicao.inicial}
            aoTerminar={() => abrir(formularioVazio())}
            aoAbrir={(p) => abrir(formularioDoPedido(p))}
          />
        </main>
      </div>
    </>
  );
}
