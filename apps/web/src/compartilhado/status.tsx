// Faixas e avisos que aparecem em todas as telas.
import { useEffect } from 'react';
import { sair, useBloqueio, useConfig, usePendentes } from '../data/repo';
import { fecharAviso, useAvisos } from './avisos';

/** "Salvo" ou "N alterações esperando internet" (MVP, Base técnica). */
export function IndicadorFila() {
  const pendentes = usePendentes();
  return pendentes === 0 ? (
    <span className="text-sm text-ok">● Salvo</span>
  ) : (
    <span className="text-sm text-aviso">
      ● {pendentes} {pendentes === 1 ? 'alteração esperando' : 'alterações esperando'} internet
    </span>
  );
}

/** Em teste, uma faixa amarela fixa em todas as telas. */
export function FaixaTeste() {
  const cfg = useConfig();
  const teste = cfg?.ambiente === 'teste';
  useEffect(() => {
    if (teste) document.documentElement.dataset.teste = '1';
    else delete document.documentElement.dataset.teste;
  }, [teste]);
  if (!teste) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-6 items-center justify-center bg-aviso text-xs font-bold tracking-widest text-black">
      AMBIENTE DE TESTE
    </div>
  );
}

/** A fila parou até a pessoa agir: app antigo ou código do autenticador. */
export function AvisoBloqueio() {
  const bloqueio = useBloqueio();
  if (!bloqueio) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-red-950 px-4 py-2 text-sm text-erro">
      <span>{bloqueio.mensagem} Nada do que você lançou se perdeu.</span>
      {bloqueio.tipo === 'atualizar' ? (
        <button type="button" className="min-h-12 font-semibold underline" onClick={() => location.reload()}>
          Atualizar
        </button>
      ) : (
        <button type="button" className="min-h-12 font-semibold underline" onClick={() => void sair(true)}>
          Entrar de novo
        </button>
      )}
    </div>
  );
}

/** Avisos curtos com "Desfazer" (sem alert). */
export function RodapeAvisos() {
  const avisos = useAvisos();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-3">
      {avisos.map((a) => (
        <div
          key={a.id}
          role="status"
          className={`pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl px-4 py-2 shadow-lg ${
            a.tipo === 'erro' ? 'bg-red-950 text-erro' : 'bg-stone-800 text-texto'
          }`}
        >
          <span>{a.texto}</span>
          {a.desfazer && (
            <button
              type="button"
              className="min-h-12 font-semibold text-mel"
              onClick={() => {
                a.desfazer?.();
                fecharAviso(a.id);
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
