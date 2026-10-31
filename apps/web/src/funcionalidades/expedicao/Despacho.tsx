// Despacho (F1): o Luan toca num ou mais códigos e depois no nome do motoboy. "Desfazer" por 5 s.
import { useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { Chip } from '../../compartilhado/ui';
import { acoes, type DadosNoite, prontosDaNoite, useAreas } from '../../data/repo';

export function Despacho({ dados, caixas }: { dados: DadosNoite; caixas: { id: string; nome: string }[] }) {
  const areas = useAreas(true);
  const [marcados, setMarcados] = useState<string[]>([]);
  const prontos = prontosDaNoite(dados);
  if (prontos.length === 0) return null;

  const nomeArea = (id: string | null) => areas.find((a) => a.id === id)?.nome ?? 'sem área';
  const escolhidos = prontos.filter((p) => marcados.includes(p.pedido.id));
  const conferir = escolhidos.filter((p) => p.pix === 'conferir').map((p) => p.pedido.codigo);

  function alternar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function despachar(caixa: { id: string; nome: string }) {
    const codigos = escolhidos.map((p) => p.pedido.codigo).join(', ');
    const saidas = await acoes.despachar(
      caixa.id,
      escolhidos.map((p) => p.pedido.id),
    );
    setMarcados([]);
    // ERROS-PREVISTOS: despachou para o motoboy errado. Depois dos 5 s, "Cancelar saída" com motivo.
    mostrarAviso(`${codigos} com ${caixa.nome}`, {
      desfazer: () => {
        for (const id of saidas) void acoes.cancelarSaida(id, 'Desfeito: motoboy errado');
      },
    });
  }

  return (
    <section aria-label="Despacho" className="flex flex-col gap-2 border-b border-borda p-3">
      <h2 className="text-sm text-apagado">Para sair ({prontos.length})</h2>
      <div className="flex flex-wrap gap-2">
        {prontos.map(({ pedido, pix }) => {
          const marcado = marcados.includes(pedido.id);
          return (
            <button
              type="button"
              key={pedido.id}
              aria-pressed={marcado}
              aria-label={`Pedido ${pedido.codigo}`}
              className={`flex min-h-12 flex-col items-start justify-center rounded-xl border px-3 text-left ${
                marcado ? 'border-mel bg-amber-950' : 'border-borda bg-cartao'
              }`}
              onClick={() => alternar(pedido.id)}
            >
              <span className="numero text-lg">{pedido.codigo}</span>
              <span className="text-xs text-apagado">
                {nomeArea(pedido.area_id)}
                {pix === 'conferir' && <span className="text-aviso"> · PIX: CONFERIR</span>}
                {pix === 'caiu' && <span className="text-ok"> · Pix caiu</span>}
              </span>
            </button>
          );
        })}
      </div>
      {conferir.length > 0 && (
        <p className="rounded-xl bg-amber-950 px-3 py-2 text-aviso">
          Confira o Pix da {conferir.join(', ')} antes de entregar a comanda.
        </p>
      )}
      {escolhidos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-apagado">Saiu com:</span>
          {caixas.map((c) => (
            <Chip key={c.id} onClick={() => void despachar(c)}>
              {c.nome}
            </Chip>
          ))}
          {caixas.length === 0 && <span className="text-sm text-apagado">Nenhum motoboy com caixa aberto.</span>}
        </div>
      )}
    </section>
  );
}
