// Avisos curtos no rodapé ("3557 lançada · Desfazer"). Sem alert e sem confirm.
import { useSyncExternalStore } from 'react';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'erro';
  desfazer?: () => void;
}

let avisos: Aviso[] = [];
let proximo = 1;
const ouvintes = new Set<() => void>();
const avisar = () => {
  for (const o of ouvintes) o();
};

export function mostrarAviso(texto: string, opcoes: { desfazer?: () => void; tipo?: 'ok' | 'erro'; ms?: number } = {}) {
  const aviso: Aviso = {
    id: proximo++,
    texto,
    tipo: opcoes.tipo ?? 'ok',
    ...(opcoes.desfazer ? { desfazer: opcoes.desfazer } : {}),
  };
  avisos = [...avisos.slice(-2), aviso];
  avisar();
  setTimeout(() => fecharAviso(aviso.id), opcoes.ms ?? (opcoes.tipo === 'erro' ? 8000 : 5000));
}

export function fecharAviso(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  avisar();
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => avisos,
  );
}
