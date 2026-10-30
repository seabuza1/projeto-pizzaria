# 0002 Escrita só por aplicar_operacao, regras no esquema interno

- **Contexto:** a escrita vem de aparelhos offline e precisa ser idempotente, validada e registrada (OPE2).
- **Decisão:** as tabelas têm RLS só de leitura; `anon` e `authenticated` não escrevem direto. Toda escrita passa por `public.aplicar_operacao` (`security definer`), que chama uma função `interno.op_<tipo>` por operação. O esquema `interno` não é exposto pela API.
- **Consequência:** uma regra nova é uma função nova em `interno` e um schema novo em `packages/db/src/operacoes.ts`. Testes em `supabase/tests`.
