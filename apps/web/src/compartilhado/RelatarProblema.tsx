// "Relatar problema" (ARQUITETURA, Robustez): para achar a causa sem depender da memória de ninguém.
import { relatarProblema, VERSAO } from '../data/repo';
import { mostrarAviso } from './avisos';
import { Botao } from './ui';

export function RelatarProblema() {
  return (
    <footer className="flex items-center justify-between gap-2 px-3 pb-24 pt-6 text-xs text-apagado">
      <span className="numero">versão {VERSAO}</span>
      <Botao
        variante="fantasma"
        onClick={() => {
          void relatarProblema();
          mostrarAviso('Problema enviado, com a tela e as últimas operações. Obrigado!');
        }}
      >
        Relatar problema
      </Botao>
    </footer>
  );
}
