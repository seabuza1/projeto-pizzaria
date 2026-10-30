# 0003 Conta do acerto em TypeScript e em SQL

- **Contexto:** as telas calculam a conta offline (`packages/dominio`), mas a confirmação não pode confiar no aparelho (MVP, Segurança).
- **Decisão:** a conta existe também em SQL (`interno.conta_caixa`). Na confirmação, o servidor recalcula, confere a `versao_esperada` do caixa e os valores que o Luan viu, e só então grava o acerto.
- **Consequência:** toda mudança na conta é feita nos dois lugares. `supabase/tests/acerto-sql.test.ts` compara os dois nos casos da spec, e a bancada vai conferir de novo com uma terceira implementação.
