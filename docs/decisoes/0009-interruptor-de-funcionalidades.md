# 0009 Interruptor de funcionalidades em config

- **Contexto:** PADROES (Módulos removíveis) pede desligar uma funcionalidade sem deploy, porque deploy só fora do turno (OPE4).
- **Decisão:** `config.funcionalidades_desligadas` (lista de nomes de módulo). Só o admin muda, por `salvar_config`. O app monta rotas e menu a partir de `apps/web/src/funcionalidades/index.ts` e esconde o que está desligado.
- **Consequência:** desligar não apaga dados nem bloqueia operações no servidor; só some da tela. Para remover de vez, `/remover-funcionalidade`.
