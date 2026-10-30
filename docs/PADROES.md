# Padrões de código

Para o sistema crescer até o PDV completo sem virar um emaranhado. Vale para todo código novo; o Claude Code segue isto em toda etapa.

## Organização

- **Por funcionalidade, não por tipo de arquivo.** Exemplo: `apps/web/src/funcionalidades/acerto/` guarda as telas, os hooks e os testes do acerto, juntos. Pastas compartilhadas só para o que é usado por três ou mais funcionalidades.
- **Direção das dependências:** tela → `repo.ts` → `packages/dominio`.
  - O domínio não importa React, Supabase, Dexie nem `Date.now()`. Recebe tudo como parâmetro, incluindo o horário. Assim, cada regra é testável sozinha.
- **Integrações atrás de interfaces** (`ProvedorPix`, `Impressora`, `EmissorNfce`). Trocar fornecedor é escrever outro adaptador.

## Nomes

- **Assuntos do negócio em português,** iguais às specs: `pedido`, `saida`, `caixa`, `acerto`, `liquidacao`. Termos técnicos padrão de biblioteca podem ficar em inglês.
- **Formato dos arquivos:** arquivos em `kebab-case`, componentes React em `PascalCase`, e funções e variáveis em `camelCase`.
- **Regra de negócio citada pelo ID** no comentário que explica o porquê: `// PED3: meio a meio cobra o sabor mais caro`.

## Tipos e dados

- **TypeScript:** strict, com `noUncheckedIndexedAccess`, e sem `any`. Use `unknown` e valide.
- **Dinheiro:** tipo `Centavos` (número inteiro com marca de tipo), com funções próprias para somar, comparar e formatar como `R$ 1.234,56`. Nunca use número quebrado para dinheiro.
- **Tempo:**
  - no banco, `timestamptz`;
  - o horário que vale é o do servidor (ARQUITETURA, Robustez);
  - a conversão para o fuso da pizzaria acontece só na tela e no cálculo da noite.
- **Identificadores:** UUID v7, gerado no aparelho.
- **Validação nas bordas:** tudo que entra passa por um schema Zod de `packages/db` (operação, webhook, formulário, JSON de dados). Dentro do domínio, os dados já são confiáveis.

## Erros

- **Regra de negócio não lança exceção:** a função devolve um resultado, `{ ok: true, valor }` ou `{ ok: false, erro: { codigo, mensagem } }`. Exceção é só para falha inesperada.
- **Mensagem para quem usa:** português simples e o que fazer ("Pagamentos somam R$ 110,00, mas o total é R$ 113,00"). O código vai para o registro de erros.
- **Nenhum erro engolido em silêncio:** ou aparece na tela, ou vai para `erros`, ou os dois.

## Dinheiro só se acrescenta

Pagamentos, acertos, sobras e faltas nunca são apagados nem sobrescritos. Uma correção é um novo lançamento de ajuste, com motivo, quem fez e quando (OPE3). É isso que permite explicar qualquer diferença meses depois.

## Testes

- **Domínio:** todas as regras e todos os casos das specs (T, P), com 100% das linhas de `packages/dominio` cobertas.
- **Banco:** RLS por papel, `aplicar_operacao` (idempotência, versões e travas) e migrações rodando do zero.
- **Ponta a ponta (Playwright):** poucos testes, só nos fluxos que dão dinheiro: lançar, entregar, acertar e imprimir.
- **Todo bug corrigido ganha um teste** que falhava antes da correção.

## Banco e migrações

- **Só para frente:** uma migração por mudança. Nunca edite uma migração já aplicada.
- **Mudança compatível em três passos:** expandir (cria o novo), migrar (o app passa a usar) e contrair (apaga o velho, numa versão seguinte). Assim um celular com o app antigo continua funcionando no dia do deploy.
- **Tipos gerados** (`supabase gen types`) ficam no repositório. O CI falha se estiverem desatualizados.

## Dependências

- **Poucas:** cada biblioteca nova precisa de um motivo registrado numa decisão (abaixo). Prefira o que a plataforma já oferece.
- **Atualização semanal** pelo Dependabot e `pnpm audit` no CI.
- **Versões fixas:** Node LTS em `.nvmrc` e o pnpm no campo `packageManager` do `package.json`.

## Decisões registradas

Cada decisão que muda a arquitetura ou acrescenta dependência vira um arquivo curto em `docs/decisoes/NNNN-titulo.md`, com até dez linhas: contexto, decisão e consequência. A `ARQUITETURA.md` resume; as decisões explicam.

## Scripts (iguais em todo o monorepo)

| Script | O que faz |
|---|---|
| `pnpm dev` | Sobe o app e o Supabase local |
| `pnpm check` | Tipos, lint e testes |
| `pnpm test` | Testes |
| `pnpm db:reset` | Recria o banco local com o seed |
| `pnpm db:types` | Gera os tipos do banco |

## Commits e revisão

- **Commits:** Conventional Commits em português, por exemplo `feat(acerto): liquidação pelo caixa do motoboy`.
- **Mudanças pequenas:** uma etapa da spec por branch.
- **Checklist antes de juntar:**
  - `pnpm check` passou;
  - migração revisada;
  - docs atualizados;
  - Advisors do Supabase sem alerta;
  - testado num celular de verdade;
  - linha no "O que mudou".

## "O que mudou"

O arquivo `docs/O-QUE-MUDOU.md` é escrito para o Luan e a gerente, não para programador: data, o que mudou na tela e se alguém precisa fazer algo diferente. Uma linha por mudança visível.

## Pronto quando (qualquer etapa)

- `pnpm check` verde.
- Os casos da spec viraram testes.
- Nenhuma regra de negócio fora de `packages/dominio`.
- Nenhum segredo no código (os hooks barram; o CI confere com o gitleaks).
- Docs e "O que mudou" atualizados.
