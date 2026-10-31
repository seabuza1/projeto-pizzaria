# 0006 Dependências fora da stack da ARQUITETURA

- **Contexto:** PADROES pede motivo registrado para cada biblioteca nova.
- **Decisão:**
  - `react-router`: rotas montadas pela lista de módulos (`/expedicao` e as próximas);
  - `dexie-react-hooks`: `useLiveQuery`, que a ARQUITETURA já prevê com o Dexie;
  - `uuid`: UUID v7 gerado no aparelho (o navegador só gera v4);
  - `postgres` (só testes): limpar e conferir o banco local direto;
  - `fake-indexeddb` (só testes): IndexedDB no Node para testar o motor da fila;
  - `@vitest/coverage-v8` (só testes): 100% das linhas do domínio.
- **Consequência:** TypeScript 7 (o compilador nativo) é o atual; se alguma ferramenta pedir a API JS antiga, fixar a 6.0 aqui.
