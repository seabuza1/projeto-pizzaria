// PADROES, Módulos removíveis: funcionalidade não importa outra; de fora, só a lista importa a ficha.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { donoDaOperacao } from '@mel/db';
import { describe, expect, it } from 'vitest';

const FUNCIONALIDADES = fileURLToPath(new URL('.', import.meta.url));
const SRC = resolve(FUNCIONALIDADES, '..');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

/** Caminhos importados com caminho relativo, já resolvidos. */
function importsRelativos(arquivo: string): string[] {
  const texto = readFileSync(arquivo, 'utf8');
  return [...texto.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) =>
    resolve(dirname(arquivo), m[1] ?? ''),
  );
}

/** Nome do módulo de um caminho dentro de funcionalidades/, ou null. */
function moduloDe(caminho: string): string | null {
  const rel = relative(FUNCIONALIDADES, caminho);
  if (rel.startsWith('..')) return null;
  const [primeiro, ...resto] = rel.split(sep);
  return resto.length > 0 || statSync(join(FUNCIONALIDADES, primeiro ?? '')).isDirectory() ? (primeiro ?? null) : null;
}

const pastas = readdirSync(FUNCIONALIDADES).filter((n) => statSync(join(FUNCIONALIDADES, n)).isDirectory());

describe('módulos removíveis', () => {
  it('cada funcionalidade tem a ficha no index.ts e está na lista', () => {
    const lista = readFileSync(join(FUNCIONALIDADES, 'index.ts'), 'utf8');
    for (const p of pastas) {
      const ficha = readFileSync(join(FUNCIONALIDADES, p, 'index.ts'), 'utf8');
      // O index.ts exporta só a ficha.
      expect(ficha.match(/^export /gm), p).toHaveLength(1);
      expect(ficha, p).toMatch(new RegExp(`export const ${p}: FichaModulo = \\{\\s*nome: '${p}'`));
      expect(lista, p).toContain(`from './${p}'`);
    }
  });

  it('uma funcionalidade não importa outra', () => {
    const violacoes: string[] = [];
    for (const p of pastas) {
      for (const arq of arquivos(join(FUNCIONALIDADES, p))) {
        for (const alvo of importsRelativos(arq)) {
          const outro = moduloDe(alvo);
          if (outro && outro !== p) violacoes.push(`${relative(SRC, arq)} importa ${relative(SRC, alvo)}`);
        }
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('de fora, só a lista importa as funcionalidades, e só pela ficha', () => {
    const violacoes: string[] = [];
    const lista = join(FUNCIONALIDADES, 'index.ts');
    for (const arq of arquivos(SRC)) {
      if (moduloDe(arq)) continue;
      for (const alvo of importsRelativos(arq)) {
        const m = moduloDe(alvo);
        if (!m) continue;
        const pelaFicha = arq === lista && alvo === join(FUNCIONALIDADES, m);
        if (!pelaFicha) violacoes.push(`${relative(SRC, arq)} importa ${relative(SRC, alvo)}`);
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('tudo tem dono: cada operação é do núcleo ou de um módulo da lista', () => {
    // O primeiro teste garante: pasta = nome do módulo = item da lista.
    const nomes = new Set(pastas);
    const semDono = Object.entries(donoDaOperacao).filter(([, dono]) => dono !== 'nucleo' && !nomes.has(dono));
    expect(semDono).toEqual([]);
  });
});
