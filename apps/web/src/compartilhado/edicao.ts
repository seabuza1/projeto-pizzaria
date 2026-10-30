// Marca quando há um lançamento em andamento: a atualização do PWA espera ele terminar.
import { useSyncExternalStore } from 'react';

const abertas = new Set<string>();
const ouvintes = new Set<() => void>();

export function marcarEdicao(id: string, ativa: boolean) {
  const antes = abertas.size;
  if (ativa) abertas.add(id);
  else abertas.delete(id);
  if (antes !== abertas.size) for (const o of ouvintes) o();
}

export function useEmEdicao(): boolean {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => abertas.size > 0,
  );
}
