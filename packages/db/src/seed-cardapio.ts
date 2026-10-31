// Gera supabase/seeds/cardapio.sql a partir do cardápio já validado pelo CardapioSchema.
// Atualizar: pnpm db:cardapio. O teste falha se o arquivo não bater com o JSON.
import type { z } from 'zod';
import type { CardapioSchema } from './cardapio';

type Cardapio = z.infer<typeof CardapioSchema>;

const texto = (s: string) => `'${s.replaceAll("'", "''")}'`;
const lista = (itens: readonly string[] = []) =>
  itens.length === 0 ? `'{}'::text[]` : `array[${itens.map(texto).join(', ')}]::text[]`;
const centavos = (reais: number) => String(Math.round(reais * 100));

export function seedDoCardapio(c: Cardapio): string {
  const linhas: string[] = [
    '-- Gerado de docs/dados/cardapio-mel.json por pnpm db:cardapio. Não edite à mão.',
    '-- Idempotente: só acrescenta o que falta; o que a gerente mudou no sistema fica.',
    '',
    'insert into public.cardapio_faixas (faixa, tamanho, preco) values',
    `${Object.entries(c.pizzas.faixas)
      .flatMap(([faixa, precos]) =>
        Object.entries(precos).map(([tamanho, preco]) => `  (${texto(faixa)}, ${texto(tamanho)}, ${centavos(preco)})`),
      )
      .join(',\n')}`,
    'on conflict (faixa, tamanho) do nothing;',
    '',
    'insert into public.cardapio_sabores (nome, faixa, ingredientes, apelidos, ordem) values',
    `${c.pizzas.sabores
      .map(
        (s, i) =>
          `  (${texto(s.nome)}, ${texto(s.faixa)}, ${s.ingredientes ? texto(s.ingredientes) : 'null'}, ${lista(s.apelidos)}, ${i + 1})`,
      )
      .join(',\n')}`,
    'on conflict do nothing;',
    '',
    'insert into public.cardapio_bordas (nome, preco, ordem) values',
    `${c.bordas.map((b, i) => `  (${texto(b.nome)}, ${centavos(b.preco)}, ${i + 1})`).join(',\n')}`,
    'on conflict do nothing;',
    '',
    'insert into public.cardapio_adicionais (nome, preco, avulso, ordem) values',
    `${[
      ...c.adicionais.itens.map((nome) => ({ nome, preco: c.adicionais.preco_cada, avulso: false })),
      ...c.adicionais.outros.map((o) => ({ ...o, avulso: true })),
    ]
      .map((a, i) => `  (${texto(a.nome)}, ${centavos(a.preco)}, ${a.avulso}, ${i + 1})`)
      .join(',\n')}`,
    'on conflict do nothing;',
    '',
    'insert into public.cardapio_bebidas (grupo, nome, preco, apelidos, ordem) values',
    `${c.bebidas
      .map((b, i) => `  (${texto(b.grupo)}, ${texto(b.nome)}, ${centavos(b.preco)}, ${lista(b.apelidos)}, ${i + 1})`)
      .join(',\n')}`,
    'on conflict do nothing;',
    '',
    'insert into public.cardapio_combos (codigo, itens, preco, ordem) values',
    `${c.combos.map((k, i) => `  (${texto(k.id)}, ${lista(k.itens)}, ${centavos(k.preco)}, ${i + 1})`).join(',\n')}`,
    'on conflict do nothing;',
    '',
  ];
  return linhas.join('\n');
}
