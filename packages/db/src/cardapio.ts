// Formato de docs/dados/cardapio-mel.json (F2, 2a: cardápio validado). O seed não roda com cardápio inválido.
import type { CardapioJson } from '@mel/dominio';
import { z } from 'zod';

// Preço em reais com no máximo dois decimais (o domínio converte para centavos).
const reais = z
  .number()
  .nonnegative()
  .max(10_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: 'preço com mais de dois decimais',
  });
const nome = z.string().trim().min(1).max(80);
const apelidos = z.array(z.string().trim().min(1).max(40)).optional();
const faixa = z.enum(['tradicional', 'especial', 'premium', 'doce', 'doce_especial']);
const precosPorTamanho = z.object({ B: reais, P: reais, M: reais, G: reais });

/** Nomes repetidos confundem a busca do atendente. */
const semRepetir = <T extends { nome: string }>(itens: T[]) =>
  new Set(itens.map((i) => i.nome.toLowerCase())).size === itens.length;

export const CardapioSchema = z.object({
  pizzas: z.object({
    faixas: z.object({
      tradicional: precosPorTamanho,
      especial: precosPorTamanho,
      premium: precosPorTamanho,
      doce: precosPorTamanho,
      doce_especial: precosPorTamanho,
    }),
    sabores: z
      .array(z.object({ nome, faixa, ingredientes: z.string().max(300).optional(), apelidos }))
      .min(1)
      .refine(semRepetir, 'sabor repetido'),
  }),
  bordas: z.array(z.object({ nome, preco: reais })).refine(semRepetir, 'borda repetida'),
  adicionais: z.object({
    preco_cada: reais,
    itens: z.array(nome),
    outros: z.array(z.object({ nome, preco: reais })),
  }),
  combos: z.array(z.object({ id: z.string().regex(/^\d{2}$/), itens: z.array(nome).min(1), preco: reais })),
  bebidas: z
    .array(z.object({ grupo: z.string().min(1).max(40), nome, preco: reais, apelidos }))
    .refine(semRepetir, 'bebida repetida'),
}) satisfies z.ZodType<CardapioJson>;
