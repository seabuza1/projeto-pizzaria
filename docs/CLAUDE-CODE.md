# Claude Code: ferramentas, segurança e economia de tokens

Como deixar o Claude Code produzindo um app sólido e seguro gastando pouco. Os arquivos citados já vêm prontos no repositório: `.claude/settings.json`, `.claude/hooks/`, `.mcp.json`, `.gitignore` e `.env.example`.

## Regras que mais economizam

1. **Uma etapa por vez.** As specs mandam parar no fim de cada etapa. Depois do resumo, faça `/clear` e comece a etapa seguinte com um prompt curto. Uma conversa longa reenvia todo o histórico a cada mensagem.
2. **CLAUDE.md curto.** Ele vai em toda mensagem. Detalhe fica nos docs, que o Claude só abre quando precisa.
3. **Graphify para navegar.** Em vez de ler arquivo por arquivo, o Claude consulta o mapa do código (veja abaixo).
4. **Testes no lugar de conferência.** Os hooks rodam formatação e testes sozinhos e só devolvem as linhas do erro. O Claude não precisa ler arquivos para "conferir".
5. **Poucos MCPs e plugins.** Cada um acrescenta texto a toda mensagem. O `/plugin` mostra o custo de cada plugin ("Every turn"); o comando `claude plugin details <nome>` também mostra.
6. **Playwright pelo terminal, não pelo MCP,** no dia a dia. Os testes com `@playwright/test` rodam e devolvem só o resultado. Num comparativo publicado, o Playwright MCP gastou cerca de 4 vezes mais tokens que o Playwright CLI na mesma tarefa, porque cada passo do MCP manda a página inteira em texto.
7. **Modelo e esforço por tipo de tarefa.**
   - Planejamento, banco, RLS e as contas do acerto: o modelo mais forte, com esforço alto.
   - Telas e ajustes: o modelo do dia a dia, com esforço médio (`/model` e `/effort`).
8. **Modo de plano** (Shift+Tab) antes de etapas grandes: o Claude propõe, você aprova, e só então ele escreve.
9. **Docs de referência sob consulta:** a leitura de `docs/referencia/` pede autorização (regra `ask`), para o Claude não abrir 40 KB de levantamento sem necessidade.

## Graphify

Gera um mapa do repositório (funções, arquivos, docs e como se ligam) e deixa o Claude consultar o mapa em vez de reler os arquivos.

- **Instalar** (precisa de Python 3.10 ou mais):
  ```
  uv tool install graphifyy        # ou: pip install graphifyy  (o pacote tem dois "y")
  graphify claude install          # registra a skill /graphify no Claude Code, rodando na pasta do projeto
  ```
- **Gerar o mapa:** `/graphify .` no Claude Code, ou `graphify .` no terminal. O resultado fica em `graphify-out/` (ignorado no git): `GRAPH_REPORT.md`, `graph.json` e `graph.html`.
- **Usar:**
  - `/graphify query "onde a liquidação é calculada?"`;
  - `/graphify path "aplicar_operacao" "acertos"`;
  - `/graphify explain "repo.ts"`.
- **Manter atualizado:** `graphify hook install` atualiza depois de cada commit. Ou `graphify . --update` no fim de cada etapa.
- **O que sai da máquina:**
  - **Código:** é analisado localmente (tree-sitter).
  - **Docs e imagens:** são resumidos pelo Claude, gastando tokens uma vez na geração.
- **Quando compensa:** num repositório pequeno a economia é quase nula, porque tudo cabe no contexto. Ela cresce com o projeto: o benchmark do próprio Graphify mediu até 71,5 vezes menos tokens por pergunta num conjunto de 52 arquivos.
- **Repositório oficial:** confira o oficial (github.com/Graphify-Labs/graphify) antes de instalar, porque há cópias com outros donos.

## MCP: só o Supabase, e com trava

O `.mcp.json` traz o MCP oficial do Supabase:
- **Escopo:** preso a um projeto (`project_ref`), somente leitura (`read_only=true`), com acesso apenas a banco, documentação e diagnóstico (`features=database,docs,debug`).
- **Configurar:**
  1. Troque `SEU_PROJECT_REF_DE_DESENVOLVIMENTO` pelo ref do projeto de **desenvolvimento**. Nunca o de produção.
  2. No terminal, rode `claude`, depois `/mcp`, selecione `supabase` e "Authenticate". O login é feito no navegador, sem token no arquivo.
- **Para que serve:** ver tabelas, rodar SELECT, ler a documentação do Supabase e ver os Advisors (segurança e desempenho) depois de cada migração.
- **Por que só leitura:** as migrações saem como arquivos em `supabase/migrations/`, você revisa, e só então aplica com `supabase db push` (que sempre pede autorização).
- **Skills do Supabase** (boas práticas de RLS, migrações e funções): `npx skills add supabase/agent-skills`.
- **Playwright MCP é opcional,** só para explorar uma tela com o navegador:
  ```
  claude mcp add playwright -- npx @playwright/mcp@latest --headless
  ```
  No Windows, se não subir, use `cmd /c npx @playwright/mcp@latest --headless` como comando.

## Plugins oficiais

O `settings.json` já liga estes plugins; na primeira vez, instale cada um uma vez com `/plugin install <nome>@claude-plugins-official`.
- **`security-guidance`:** revisa as mudanças do Claude atrás de falhas de segurança, como injeção, XSS, segredos expostos e acesso indevido.
- **`code-review`:** revisão com vários agentes antes do commit ou do PR. Use no fim de cada etapa, não a cada arquivo.
- **`commit-commands`:** commits e PRs com mensagem padronizada.
- **Opcional:** `frontend-design`, quando for desenhar as telas da fase 2.

Antes de instalar qualquer outro, veja o custo por mensagem no `/plugin`.

## Hooks (rodam sozinhos, em Node, funcionam no Windows)

| Hook | Quando | O que faz |
|---|---|---|
| `protege-segredos.mjs` | Antes de cada comando no terminal | Bloqueia: ler `.env` (menos o `.env.example`), certificados, listar variáveis de ambiente, `supabase db reset --linked`, `git push --force` e qualquer comando com uma credencial escrita nele |
| `segredos-no-codigo.mjs` | Antes de criar ou editar um arquivo | Bloqueia escrever credencial em arquivo e escrever qualquer `.env` (só o `.env.example` é permitido) |
| `formatar.mjs` | Depois de cada arquivo editado | Roda o Biome só naquele arquivo e devolve até 25 linhas de erro |
| `testes-dominio.mjs` | Quando o Claude vai encerrar | Se `packages/dominio` mudou, roda os testes. Se falharem, devolve as últimas 30 linhas e o Claude continua. Desiste depois de 2 tentativas, para não entrar em ciclo |

Enquanto o repositório ainda não tem Biome ou o pacote do domínio, os hooks de formatação e de testes não fazem nada.

**Credenciais reconhecidas** (em `padroes-segredos.mjs`, usado pelos dois hooks de segredo):
- chaves da Anthropic, da OpenAI e do Google;
- chave secreta do Supabase (`sb_secret_`) e tokens JWT (as chaves anon e service_role antigas do Supabase são JWT);
- URL do Postgres com senha;
- tokens da Meta/WhatsApp, do GitHub e do Mercado Pago;
- chaves da AWS e chaves privadas.

Para incluir outro padrão, acrescente uma linha na lista. A varredura de segredos no CI (gitleaks) continua valendo como segunda barreira.

## Permissões (`.claude/settings.json`)

- **Liberados sem perguntar:** testes, lint, tipos, build, Supabase local (`start`, `status`, `db reset` local, `migration new` e `gen types`), Graphify e git local (`status`, `diff`, `add` e `commit`).
- **Pedem autorização:** `git push`, `supabase db push`, `functions deploy`, `secrets`, `link`, `pnpm add` (dependência nova é risco de segurança) e leitura de `docs/referencia/`.
- **Proibidos:** ler ou editar `.env` de verdade, ler certificados e backups, `db reset --linked` e push forçado.

## Fluxo de cada etapa

1. `/clear`.
2. Prompt curto, por exemplo: `Etapa 3 do docs/MVP.md. Use /graphify query para achar o que precisar.`
3. Para etapa grande, peça o plano antes (modo de plano).
4. O Claude implementa; os hooks formatam e testam sozinhos.
5. No fim: a revisão do plugin `code-review` (aparece ao digitar `/code-review`), depois `graphify . --update` (ou o hook do git), depois um commit pelo `commit-commands`.
6. Depois de cada migração, peça: "rode os Advisors do Supabase pelo MCP e corrija os alertas de segurança".

## Primeira vez (Windows)

1. Instale Node 22 LTS, pnpm, Git, Docker Desktop (para o `supabase start`), Supabase CLI e Python 3.10 ou mais, com `uv`.
2. Extraia o pacote na pasta do repositório novo e rode `git init`.
3. Instale o Graphify e rode `graphify claude install`.
4. Crie dois projetos no Supabase, na região São Paulo:
   - `mel-dev` (Free): use o ref dele no `.mcp.json`;
   - `mel-producao` (Pro, só antes da primeira noite real).
5. Abra o Claude Code na pasta e aceite a confiança da pasta. Depois rode `/mcp` para autenticar o Supabase e `/plugin` para instalar os três plugins.
6. Rode o primeiro prompt (no fim do `MVP.md` e no `CLAUDE.md`).

## Fontes

- [Graphify: instalação](https://codeconductor.ai/blog/graphify-installation-guide/) e [visão geral](https://claudelog.com/claude-code-mcps/graphify)
- [Supabase: MCP no Claude Code](https://supabase.com/docs/guides/getting-started/mcp)
- [Claude Code: settings](https://code.claude.com/docs/en/settings), [hooks](https://code.claude.com/docs/en/hooks), [MCP](https://code.claude.com/docs/en/mcp), [plugins](https://code.claude.com/docs/en/discover-plugins)
- [Plugins oficiais do Claude Code](https://designrevision.com/blog/official-claude-code-plugins)
- [Playwright MCP vs CLI: custo em tokens](https://www.morphllm.com/playwright-mcp)
