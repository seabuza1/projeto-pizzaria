---
name: remover-funcionalidade
description: Remove uma funcionalidade inteira do PDV da Mel (tela, rota, papel, operações, tabelas e testes) sem quebrar o resto. Use quando o Felipe pedir para tirar uma funcionalidade.
argument-hint: <nome-da-funcionalidade> [motivo]
disable-model-invocation: true
---

Remova a funcionalidade `$0` do sistema. Pedido completo: $ARGUMENTS

Siga `docs/PADROES.md` (Enxuto e Módulos removíveis). Se houver uma decisão em `docs/decisoes/` sobre esta remoção, leia antes. Se a etapa do `docs/MVP.md` tiver passos próprios para esta remoção, eles valem por cima destes.

## 1. Mapear (sem mudar nada)

- `/graphify query "$0"` e uma busca por nome em `apps/`, `packages/`, `supabase/` e `docs/`.
- Monte uma lista curta, em quatro grupos:
  - **apagar:** pasta da funcionalidade, rotas, itens de menu, testes e testes de ponta a ponta dela;
  - **mover:** o que outra funcionalidade ainda usa (vai para `apps/web/src/compartilhado/` ou para `packages/dominio`);
  - **banco:** operações, papéis, políticas e tabelas que só ela usa;
  - **docs:** specs, ARQUITETURA, CLAUDE.md, ERROS-PREVISTOS e O-QUE-MUDOU.
- Mostre a lista ao Felipe em poucas linhas e **espere o ok**.

## 2. Remover em passos pequenos

Um commit por passo, e `pnpm check` verde antes de cada commit. Se um passo quebrar e não der para corrigir em poucos minutos, `git revert` do passo, pare e avise.

1. **Desligar:** tirar da lista de módulos (`apps/web/src/funcionalidades/index.ts`). O app continua de pé sem ela.
2. **Mover** o que outro módulo usa. Nada de cópia: um lugar só.
3. **Apagar** a pasta, os testes e os testes de ponta a ponta dela. `modulos.test.ts` tem que continuar verde.
4. **Front:** tirar de `repo.ts`, do motor e de `packages/db` as operações que só ela chamava.
5. **Banco:** migração nova, nunca editar uma aplicada.
   - Tabela do núcleo (noite, pedido, saída, pagamento, caixa, acerto) nunca é apagada junto.
   - Dinheiro só se acrescenta: nada de apagar linhas de pagamento, acerto, sobra ou falta.
   - Operação que um app antigo ainda pode mandar continua aceita até a versão seguinte (expandir → migrar → contrair).
   - Valor de enum fica sem uso (o Postgres não remove valor de enum sem recriar o tipo).
   - `supabase db reset`, `pnpm test:db` e `pnpm db:types`.
6. **Docs:** atualizar o que a lista do passo 1 apontou e registrar a decisão em `docs/decisoes/` se ainda não houver.

## 3. Fechar

- `pnpm check` e os testes de ponta a ponta verdes.
- Busca final pelo nome não acha sobra em código (só em docs de decisão e no histórico).
- Resumo em poucas linhas: o que saiu, o que foi movido, o que ficou para contrair numa versão seguinte e por quê.
