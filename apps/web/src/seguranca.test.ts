// Checklist de segurança do MVP (MVP.md, Segurança), na parte do front.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const fontes = arquivos(SRC).map((caminho) => ({
  caminho: relative(SRC, caminho),
  texto: readFileSync(caminho, 'utf8'),
}));

describe('segurança no front', () => {
  it('texto livre aparece sempre como texto, nunca como HTML', () => {
    const html = fontes.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=/.test(f.texto));
    expect(html.map((f) => f.caminho)).toEqual([]);
  });

  it('no front, só a anon key: nada de service role nem chave escrita no código', () => {
    const chaves = fontes.filter((f) => /service_role|SERVICE_ROLE|eyJhbGciOi|sb_secret_/.test(f.texto));
    expect(chaves.map((f) => f.caminho)).toEqual([]);
  });
});
