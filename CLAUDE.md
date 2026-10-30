# PDV da Mel Pizzaria

Sistema para a Mel Pizzaria (Aragarças, GO), construído aos poucos, uma fase por vez, sem atrapalhar a operação. Quem desenvolve é o Felipe, motoboy da casa, com o Claude Code.

## Leia antes de tudo
- `docs/MVP.md`: **o que construir agora** e em que ordem.
- `docs/PADROES.md`: padrões de código (organização, nomes, erros, testes, migrações, dependências). **Siga em todo código.**
- `docs/PROJETO.md`: a pizzaria, os princípios, as regras de negócio (PED, ENT, PAG, ACE e OPE), as fases e as perguntas em aberto. **As regras valem daqui.**
- `docs/ARQUITETURA.md`: stack, desenho, offline, impressão, integrações, custos, estrutura do repositório e modelo de dados.
- `docs/ERROS-PREVISTOS.md`: erros do cliente, da equipe e críticos, e quem resolve. Cada linha "Sistema" vira teste.
- `docs/fases/`: a spec de cada fase. Implemente só a fase pedida. **Foco atual: atendimento e despacho** (o MVP junta as fases 1 e 2). Não comece as fases 3 a 6 sem o Felipe pedir.
  - `F1-acerto.md`: despacho e acerto no painel do Luan.
  - `F2-pedido.md`: pedido digitado, clientes, cardápio e comanda impressa.
  - `F3-a-F6.md`: cozinha, garçom, caixa geral, link do cliente e integrações (em nível de roteiro).
- `docs/BANCADA-TESTES.md`: noite simulada, impressora virtual e falhas de rede (depois do MVP).
- `docs/CLAUDE-CODE.md`: ferramentas, hooks, permissões e economia de tokens.
- `docs/dados/cardapio-mel.json`: o cardápio real, usado para o seed e nos testes.
- `docs/referencia/`: levantamento original, pesquisa e schema antigo. Servem só de contexto: não implemente a partir deles.

## Como trabalhar
- Siga a "Ordem de construção" da spec. **Comece pelos testes do domínio**, e pare no fim de cada etapa com um resumo de poucas linhas.
- Se a spec estiver ambígua ou contradizer `PROJETO.md`, pergunte antes de decidir. Não invente regra de negócio.
- **Enxuto:** não crie tela, tabela, papel ou interface que a etapa não pede. Na dúvida, pergunte (PADROES, Enxuto).
- **Módulos removíveis:** uma pasta por funcionalidade, registrada na lista de módulos; uma funcionalidade não importa outra. Para tirar uma, use `/remover-funcionalidade <nome>` (PADROES, Módulos removíveis).
- Mudou uma decisão de arquitetura? Atualize `docs/ARQUITETURA.md` no mesmo commit.
- Toda mudança de banco é uma migração nova em `supabase/migrations/`. Nunca edite migração já aplicada.
- Antes de dizer que terminou, rode os tipos, o lint e os testes.
- **Economize contexto:**
  - para achar código, use `/graphify query` antes de abrir arquivos;
  - leia só os docs da etapa;
  - não abra `docs/referencia/` sem motivo;
  - devolva resumos curtos.
- Nunca leia `.env` nem certificados. Migração vai para produção só com `supabase db push` autorizado pelo Felipe.

## Stack (detalhes em ARQUITETURA)
TypeScript strict em tudo, num monorepo pnpm:
- `apps/web`: PWA da equipe do balcão (React, Vite, Tailwind, Dexie);
- `apps/agente`: impressão ESC/POS no balcão;
- `packages/dominio`: regras e contas puras;
- `packages/db`: tipos e schemas Zod.

Só nascem com a sua fase: `apps/cliente` (fase 6) e `apps/integracoes` (só se o Pix exigir mTLS).

Nomes dos pacotes: `@mel/web`, `@mel/agente`, `@mel/dominio` e `@mel/db` (depois, `@mel/cliente` e `@mel/integracoes`).

Supabase em São Paulo (Postgres com RLS, Auth, Realtime, Storage, Edge Functions). Front no Cloudflare Pages. Testes com Vitest e Playwright. Lint e formatação com Biome.

## Convenções
- **Dinheiro:** sempre em centavos (inteiro). Exibir como `R$ 1.234,56`.
- **Fuso:** sempre o da pizzaria, `America/Sao_Paulo`, lido de `config`. As três cidades usam o horário de Brasília (Felipe, 30/10). Mesmo assim, nunca use o fuso do aparelho: um celular em MT com fuso automático pode marcar o horário de Cuiabá. Uma noite aberta entre 00h e 06h pertence ao dia anterior.
- **Contas e regras:** só em `packages/dominio`, em funções puras e testadas. As telas não fazem conta.
- **Dados:** as telas só falam com `apps/web/src/data/repo.ts`. Toda escrita vira uma operação com UUID v7 gerado no aparelho e vai pela fila para `aplicar_operacao`, que é idempotente e valida papel e estado.
- **Banco:** IDs `uuid`. Toda tabela tem `criado_em` e `atualizado_em`. RLS em todas as tabelas. Mudanças em pagamento, saída e acerto gravam em `eventos`.
- **Interface:**
  - em português do Brasil e mobile-first, com uso de uma mão, botões de 48 px e tema escuro;
  - números em fonte mono tabular;
  - sem `alert` e sem `confirm`: use desfazer ou confirmação com dois toques;
  - textos curtos.
- **Papéis em uso:** `admin`, `gerente`, `expedicao`, `atendente` e `agente`. O motoboy não usa o sistema: é um cadastro (decisão 0007). `cozinha` e `garcom` só nas fases 3 e 4.
- **Segurança:**
  - no front, só a anon key; a service role nunca;
  - chaves de API ficam nos secrets do Supabase ou do servidor;
  - backups `.json` e `.env` ficam fora do repositório (`.gitignore`).
- **Dados de cliente:** só a equipe do balcão vê no sistema; o motoboy recebe na comanda impressa. Logs sem telefone nem endereço.
- **Respostas e resumos:** curtos.

## Glossário curto
O glossário completo está em `PROJETO.md`, seção 5.
- **noite:** um dia de operação.
- **pedido:** o que o cliente pediu.
- **código:** os 4 últimos dígitos do telefone.
- **saída:** uma ida do motoboy para entregar; um pedido que volta e sai de novo tem duas.
- **caixa:** o caixa do motoboy na noite, com o troco de R$ 80.
- **acerto:** o fechamento com o Luan.
- **liquidação:** paga primeiro com o caixa do motoboy, e o resto sai do caixa da empresa.
- **diária:** R$ 30.
- **taxa:** por área; o motoboy recebe a mesma taxa que o cliente paga.
- **Pix antecipado:** não passa pela mão do motoboy.
- **troco por Pix:** o motoboy fica com esse valor a mais em mãos.
- **papel conferido:** a comanda chegou ao Luan.
