# Arquitetura

Decidida em 30/10/2026 a partir da pesquisa (fontes no fim). As decisões têm o motivo ao lado. Para mudar uma, atualize este arquivo antes do código.

## Em uma frase

Um app web instalável (PWA) em **TypeScript**, usado no balcão (atendimento, Luan e gerente), que funciona sem internet e grava primeiro no aparelho. O motoboy não usa o sistema (decisão 0007). Por trás, o **Supabase** (Postgres, login, tempo real, arquivos e funções), na região de São Paulo. Um **agente de impressão** pequeno roda no computador do balcão. Um servidor de integrações só entra se o Pix escolhido exigir certificado.

## O que a arquitetura precisa atender

1. **Balcão que não para:** computador do balcão e celular do Luan, às vezes com a internet caída. Nada de instalar app de loja.
2. **Várias pessoas ao mesmo tempo:** atendentes, Luan e gerente veem a mesma noite em tempo real.
3. **Dinheiro:** as contas precisam ser exatas, testadas e auditáveis. A falta é descontada de uma pessoa.
4. **Impressora térmica:** comanda na cozinha e no balcão, inclusive sem internet.
5. **Integrações brasileiras:** Pix com confirmação automática, maquininha, NFC-e e WhatsApp.
6. **Um desenvolvedor só, trabalhando com o Claude Code:** uma linguagem, poucas peças e custo baixo.
7. **Crescer por fases** sem reescrever: o modelo de dados já nasce com pedido, saída e pagamento separados.

## Stack

| Parte | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript (strict) em tudo | Uma linguagem só para o front, as funções, o agente e os testes. É a linguagem em que o Claude Code mais acerta, e o Felipe já usa Supabase. |
| App da equipe | React + Vite, PWA (`vite-plugin-pwa`) | Abre pelo link e instala na tela inicial. Usa câmera, localização e funciona offline. |
| Estilo | Tailwind CSS | Rápido para telas de celular. Tema escuro (o turno é à noite). |
| Dados no aparelho | IndexedDB com Dexie e `liveQuery` | O app lê do aparelho e não espera a rede. |
| Validação | Zod, com schemas compartilhados entre o front e as funções | Um lugar só para o formato dos dados. |
| Banco e backend | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions | Regras de acesso (RLS) no próprio banco, tempo real pronto e funções em TypeScript (Deno). |
| Região | `sa-east-1` (São Paulo) | Menor atraso para GO e MT. |
| Hospedagem do front | Cloudflare Pages | O plano grátis permite uso comercial. O plano grátis da Vercel (Hobby) não permite; o Pro custa US$ 20 por mês. |
| Agente de impressão | Node + TypeScript, no computador do balcão | Imprime ESC/POS em impressora de rede ou USB e funciona sem internet na rede local. |
| Servidor de integrações (só se precisar) | Node + TypeScript + Hono, no Fly.io região `gru` | As APIs Pix dos bancos exigem certificado de cliente (mTLS). Segundo a comunidade do Supabase, as Edge Functions publicadas não conseguem apresentar esse certificado. Testar antes de descartar. |
| Testes | Vitest (domínio e banco), Playwright (fluxos de ponta a ponta) | As contas do acerto e do pedido são o que mais precisa de teste. |
| Organização | Monorepo com pnpm workspaces; Biome para lint e formatação | Domínio compartilhado entre app, funções e agente. |
| CI | GitHub Actions: tipos, lint, testes e migrações | Nada vai para produção quebrado. |

### Alternativas consideradas

| Opção | A favor | Contra | Decisão |
|---|---|---|---|
| App nativo (Flutter ou Kotlin) | Bluetooth e USB direto, offline forte | Instalar APK em cada celular, iPhone à parte, outra linguagem | Não. A web cobre o que precisa, e a impressão fica com o agente |
| PHP/Laravel + MySQL, comum em PDV brasileiro | Muita gente sabe, hospedagem barata | Servidor sempre ligado; tempo real e offline ficam por sua conta | Não |
| Firebase | Offline pronto | Banco de documentos atrapalha as contas e os relatórios; as regras de acesso são menos expressivas que SQL | Não |
| Servidor local na pizzaria (SQLite, PocketBase) | Funciona sem internet na rede local | Backup, acesso remoto (gerente fora da loja, manutenção do Felipe) e o servidor ligado ficam com vocês. A fila offline já cobre a internet caída. Trocar agora seria reescrever | Só a impressão fica local (o agente) |
| Next.js com SSR | Tudo num projeto só | O app é offline e não ganha nada com SSR; Vercel comercial é paga | Não |
| PowerSync no lugar da fila própria | Sincronização pronta | US$ 49 por mês no Pro (o grátis desativa após 1 semana parado); mais uma peça | Plano B se a fila própria der problema |

## Desenho

```
 Celular do Luan                 Balcão (atendente, gerente)          Cliente
 ┌───────────────────────┐       ┌──────────────────────────┐       ┌──────────┐
 │ PWA  apps/web         │       │ PWA apps/web             │       │ apps/    │
 │ IndexedDB + fila      │       │ IndexedDB + fila         │       │ cliente  │
 └──────────┬────────────┘       └──────┬───────────┬───────┘       └────┬─────┘
            │ HTTPS + Realtime          │           │ rede local         │
            ▼                           ▼           ▼                    │
 ┌───────────────────────────────────────────┐  ┌─────────────────┐      │
 │ Supabase (São Paulo)                      │  │ Agente de       │      │
 │ Postgres + RLS · Auth · Realtime          │◄─┤ impressão       │      │
 │ Storage · Edge Functions                  │  │ (computador do  │──► impressoras
 │  - aplicar_operacao (RPC)                 │  │ balcão)         │    térmicas
 │  - pix-webhook, nfce                      │  └─────────────────┘
 └───────────────┬───────────────────────────┘◄────────────────────────────┘
                 │ só se o Pix exigir mTLS
                 ▼
 ┌───────────────────────────┐     ┌───────────────────────────────┐
 │ apps/integracoes (Fly.io) │────►│ Banco/PSP Pix · NFC-e         │
 └───────────────────────────┘     └───────────────────────────────┘
```

## Funcionar sem internet

**Leitura:** cada aparelho guarda a noite aberta no IndexedDB (pedidos, saídas, pagamentos, caixas, áreas, cardápio). As telas leem dali com `liveQuery`. Ao abrir, o app baixa a noite; depois recebe as mudanças pelo Realtime, filtradas pela noite. Se ficar mais de 1 minuto sem Realtime, ele baixa de novo.

**Escrita (fila de operações):**
1. Toda ação vira uma **operação**: `{ id, tipo, dados, criada_em, aparelho }`. O `id` é um UUID v7 gerado no aparelho. Exemplos: `despachar`, `trocar_pagamento`, `mudar_estado_saida` (voltou), `confirmar_acerto`.
2. A operação é aplicada na hora no IndexedDB e entra na fila.
3. A fila envia as operações em ordem para a função `aplicar_operacao(op jsonb)` no Postgres (RPC). Ela:
   - é **idempotente**: guarda o `id` em `operacoes` e ignora repetidas;
   - **valida** o papel, a transição de estado e as travas (por exemplo, nada muda depois do acerto confirmado);
   - grava em `eventos` quem fez o quê e quando (OPE2).
4. **Operação recusada:** o aparelho desfaz o efeito local e mostra o motivo. Exemplo: "3557: o acerto já foi confirmado pelo Luan".
5. **Indicador discreto:** "Salvo" ou "3 alterações esperando internet".

**No banco (fase 1):**
- As tabelas só têm políticas de leitura. `anon` e `authenticated` não escrevem direto: toda escrita passa por `aplicar_operacao`, que é `security definer`.
- As regras ficam no esquema `interno`, que a API não expõe: uma função `op_<tipo>` por operação (`aplicar_operacao` chama a do tipo pedido, sem lista a manter), os ajudantes de papel usados nas políticas e a conta do acerto (`interno.conta_caixa`).
- **A conta do acerto existe duas vezes:** em `packages/dominio` (telas) e em SQL (confirmação). Na confirmação, o aparelho manda a `versao_esperada` do caixa e os valores que o Luan viu; o servidor recalcula e recusa se não bater. Os testes de `supabase/tests` conferem que as duas dão o mesmo resultado nos casos da spec (decisão 0003).
- **Versões e anulação:** `pedidos` e `caixas` têm `versao`; `cancelar_saida`, `trocar_pagamento` e `confirmar_acerto` levam `versao_esperada`. Nada de dinheiro é apagado: saídas são canceladas e pagamentos, sobras e faltas anulados, com motivo (decisão 0004). Recusas trazem `codigo`, igual aos do domínio.
- Operações da fase 1: `abrir_noite`, `fechar_noite`, `reabrir_noite`, `abrir_caixa`, `editar_caixa`, `lancar_saida` (vira "Lançar comanda de papel", só da expedição), `cancelar_saida`, `mudar_estado_saida` (só "voltou" e desfazer), `trocar_pagamento`, `sair_de_novo`, `conferir_papel`, `informar_contado`, `confirmar_acerto`, `reabrir_acerto`, `marcar_pix`, `pedir_impressao`, `atualizar_impressao`, `registrar_impressao_local`, `salvar_area`, `salvar_config` e `salvar_perfil`. Entram `despachar`, `mudar_ordem_caixa` (até o primeiro acerto) e `salvar_motoboy`; sai `avisar_retorno` (decisão 0007). O pagamento previsto na comanda do balcão fica sem saída até o despacho; cancelar a única saída de um pedido do balcão o devolve para o despacho, e a de uma comanda de papel desfaz o lançamento. O formato de cada uma está em `packages/db/src/operacoes.ts`.
- **Operação presa:** recusada por erro inesperado várias vezes, ela não some do aparelho. Fica numa lista de presas, com os dados completos, aviso ao admin e botão para reenviar.

**Conflitos e concorrência:** o servidor recebe ações, e não linhas inteiras, então quase não há conflito. Para o resto:
- **Cada operação roda numa transação só.** `aplicar_operacao` trava a linha que vai mudar (`select ... for update` no pedido, no caixa ou na conta da mesa), valida e grava, ou desfaz tudo.
- **Versão.** `pedidos`, `caixas` e, na fase 4, `contas_mesa` têm uma coluna `versao`, que sobe a cada mudança.
  - Operações que dependem do estado atual (fechar conta, confirmar acerto, trocar pagamento, cancelar) levam a `versao_esperada`.
  - Se outra pessoa mudou antes, a operação é recusada com "Fulano mudou este pedido; confira e tente de novo". Ninguém sobrescreve o trabalho de outro sem ver.
- **Itens só se somam.** Adicionar item é uma operação própria (`adicionar_item`, com id gerado no aparelho), e remover também (`remover_item`). Dois garçons lançando na mesma mesa ao mesmo tempo nunca apagam o item um do outro.
- **Uma conta aberta por mesa:** índice único parcial em `contas_mesa (mesa) where fechada_em is null`.
- **Campos simples,** como observações: vale a última alteração.

**Telas:** só conversam com `src/data/repo.ts`, que esconde o IndexedDB, a fila e o Supabase. As telas não fazem conta: as contas ficam em `packages/dominio`.

## Impressão

- **Fila no banco:** a tabela `impressoes` guarda cada trabalho (tipo, impressora de destino, conteúdo, estado, tentativas). Qualquer aparelho da equipe pode pedir uma impressão.
- **Agente** (`apps/agente`, Node + TypeScript):
  - roda no computador do balcão com uma conta de papel `agente` (nunca com a service role);
  - escuta `impressoes` pelo Realtime, e também consulta a cada 10 s;
  - monta o ESC/POS e manda para a impressora pela rede, de preferência sem fio (TCP 9100 pelo Wi-Fi), ou por USB;
  - marca o trabalho como impresso.
- **Sem internet:** o PWA do balcão manda o trabalho direto ao agente pela rede local (`http://localhost` ou o IP do computador). No Chrome, isso exige a permissão de rede local: chamada só a partir de um clique, com `targetAddressSpace: 'loopback'` (ou `'local'`) no `fetch`. O agente imprime e sobe o registro quando a internet voltar.
- **Impressora sem fio (prioridade da Mel):** térmica de 80 mm com guilhotina, ligada ao Wi-Fi da loja com IP fixo (reserva de IP no roteador). Duas formas:
  - **Wi-Fi de fábrica:** a Epson TM-m30III tem Wi-Fi, Bluetooth, rede e USB, corte automático e Server Direct Print (a impressora busca os trabalhos num endereço na internet, sem computador). Confirmar preço e disponibilidade no Brasil.
  - **Rede com ponte Wi-Fi:** os modelos mais comuns no Brasil não têm Wi-Fi. A Elgin i9 Full e a Bematech MP-4200 HS (USB, rede e serial, cerca de R$ 680) ficam sem fio com um mini roteador em modo cliente ao lado. Serve também para a impressora que a Mel já tem, se ela tiver porta de rede.
  - **Bluetooth** só para casos móveis: o alcance é curto e a conexão é instável para cozinha.
- **Layout com ReceiptLine** (biblioteca Apache-2.0): o mesmo texto de marcação gera o ESC/POS para a impressora real (código de página cp860, português) e o SVG para a pré-visualização na tela e para a impressora virtual da bancada de testes. O layout fica no domínio, separado do envio: a mesma comanda sai em qualquer impressora.
- **Server Direct Print (opcional):** com a TM-m30III, a impressora pode buscar os trabalhos numa Edge Function e dispensar o computador. Só funciona com internet; o agente continua como caminho principal, porque funciona sem internet na rede local.

## Integrações

**Sem data** (fora do MVP). Quando uma entrar, ela fica atrás de uma interface em `packages/dominio/src/integracoes/`, para trocar de fornecedor sem mexer nas telas. A interface nasce junto com a integração (PADROES, Enxuto).

| Integração | Como | Onde roda |
|---|---|---|
| Pix automático | Cobrança com QR dinâmico (copia e cola) por pedido, com `txid`, e confirmação por webhook | Depende do provedor (abaixo) |
| Maquininha (Laranjinha, Itaú/Rede) | Primeiro: importar o relatório de vendas do Portal Rede e casar pelo valor, pela maquininha e pela hora. A Rede também compartilha o extrato de conciliação com sistemas autorizados no portal (Conciliação → Compartilhar). A maquininha integrada só viria trocando de adquirente, o que hoje não compensa | Domínio + Edge Function |
| NFC-e | API de emissão (exemplo: Focus NFe), com certificado A1 e credenciamento na SEFAZ-GO; ou continuar no sistema fiscal atual | Edge Function |
| WhatsApp | Links de conversa com o texto pronto (`wa.me/55…?text=…`), sem API. A API paga fica para depois | Front |

**Escolha do provedor Pix:** a maquininha é a Laranjinha do Itaú, então o banco provável é o Itaú (confirmar: pergunta 7 de `PROJETO.md`).
- **Itaú, pela API Pix padrão do Banco Central:** fica tudo no mesmo banco. Exige certificado (mTLS), então precisa do `apps/integracoes`. A tarifa do QR dinâmico vai de 1,30% a 1,45%, conforme a fonte; confirmar a tarifa negociada.
- **Inter PJ só para o Pix antecipado:** 0,9%, mín. R$ 0,10 e máx. R$ 1,50. Também exige certificado. Custa abrir e administrar uma segunda conta.
- **Mercado Pago:** usa token, sem certificado, e roda nas Edge Functions. Também é uma segunda conta.
- **Decisão:** ver primeiro a tarifa negociada no Itaú. Num pedido de R$ 80, a diferença entre o Itaú (cerca de R$ 1,10) e o Inter (R$ 0,72) é de uns R$ 0,40 por Pix.

## Robustez

- **Horário do servidor:** a hora de cada operação é gravada pelo servidor ao aplicar. A hora do aparelho só ordena a fila local. Um celular com relógio errado não muda a noite nem a ordem dos fatos.
- **Versões do app convivendo:**
  - toda operação leva `versao_op`, e o servidor aceita a versão atual e a anterior;
  - `config.versao_minima_app` define quando o app antigo para de valer: abaixo dela, o app pede para atualizar, mas primeiro envia a fila, para nada se perder;
  - as migrações seguem expandir → migrar → contrair (PADROES).
- **Dinheiro só se acrescenta:** pagamentos, acertos, sobras e faltas nunca são apagados. Uma correção é um ajuste com motivo (OPE3).
- **Batimento do agente:** o agente grava "vivo" a cada 30 s. Sem sinal há 2 minutos, o painel mostra "Impressora sem resposta" e oferece a impressão pelo navegador como reserva.
- **Contingência no meio da noite:** "Imprimir folha agora" e "Exportar a noite (CSV)" funcionam com os dados do aparelho, mesmo sem internet. Um plano de cinco linhas fica colado no balcão: o que fazer se cair a internet, a energia ou o sistema.
- **Infraestrutura física:**
  - nobreak para o roteador, o computador e a impressora;
  - internet reserva (roteador com chip 4G, ou um celular roteando);
  - IP da impressora reservado no roteador.
- **Janela de implantação:** deploy e migração só fora do turno. De preferência segunda e terça (folga da casa); de quarta a domingo, só até as 16h. Nunca entre 17h e 01h.
- **Voltar atrás:** o Cloudflare Pages volta para a versão anterior com um clique. Como as migrações são compatíveis, o app volta sem mexer no banco.
- **Monitoramento:**
  - registro de erros (MVP);
  - verificação de disponibilidade a cada 5 minutos no app e numa função `saude` (um serviço gratuito de monitoramento serve);
  - aviso no celular do Felipe quando algo cair.
- **Relatar problema:** um botão no app grava em `erros` a versão, a tela e as últimas 20 operações do aparelho, para achar a causa sem depender da memória de ninguém.

## Segurança e dados pessoais

- **Regras de acesso:** RLS em todas as tabelas, com funções `security definer` para ler o papel (modelo em `referencia/schema-v1.sql`).
- **Papéis em uso:** `admin`, `gerente`, `expedicao`, `atendente` e `agente`. `cozinha` e `garcom` só quando as fases 3 e 4 entrarem. `motoboy` fica no enum sem uso (decisão 0007).
- **Testes de acesso:** um teste por papel com contas reais no Supabase local. Exemplos: o atendente não confirma acerto, ninguém edita depois do acerto confirmado, e `anon` não lê nada.
- **Contas:** MFA (código no app autenticador) obrigatório para `admin` e `gerente`. Os limites de tentativa de login do Supabase ficam ligados.
- **Chaves:** no front, só a anon key. A service role e as chaves de API ficam nos secrets do Supabase ou do servidor. Backups `.json` e `.env` ficam fora do repositório (`.gitignore`).
- **Dados de cliente** (telefone, endereço, localização): só a equipe do balcão vê no sistema; o motoboy recebe na comanda impressa das entregas dele. Os logs não levam dados pessoais.
- **Backups:** os backups diários do Supabase Pro e um `pg_dump` semanal guardado fora do Supabase.

## Hospedagem e custos mensais

| Item | Escolha | Custo |
|---|---|---|
| Front (apps/web e apps/cliente) | Cloudflare Pages | R$ 0 |
| Supabase | Free para desenvolver. Pro antes da primeira noite real, porque o Free pausa após 1 semana sem uso | US$ 25 (uns R$ 140) |
| Servidor de integrações (só se o Pix exigir mTLS) | Fly.io, `gru`, shared-cpu-1x | Uns US$ 3,54 |
| Domínio | `.com.br` no registro.br | Uns R$ 40 por ano |
| NFC-e por API (se o PDV emitir) | Focus NFe, plano Retail | Uns R$ 145 para 2.000 notas |
| Pix automático | Tarifa do provedor | 0,9% a 1,2% por Pix antecipado |
| Hardware | Impressora térmica sem fio (Wi-Fi de fábrica, ou de rede com ponte Wi-Fi); o computador do balcão já existe | Cerca de R$ 680 por impressora de rede, mais a ponte Wi-Fi; uma vez |

## Repositório

```
mel-pdv/
  CLAUDE.md
  .claude/                   settings.json (permissões, plugins, hooks) e hooks/ (ver docs/CLAUDE-CODE.md)
  .mcp.json                  MCP do Supabase, somente leitura, projeto de desenvolvimento
  docs/                      MVP, PROJETO, ARQUITETURA, PADROES, ERROS-PREVISTOS, BANCADA-TESTES,
                             CLAUDE-CODE, O-QUE-MUDOU, decisoes/, fases/, dados/, referencia/
  apps/
    web/                     PWA da equipe: /expedicao (painel do Luan), /atendimento, /gerente
      src/funcionalidades/   um módulo por pasta, listados em index.ts (PADROES, Módulos removíveis)
      src/compartilhado/     o que dois ou mais módulos usam
      src/data/repo.ts       única porta de dados das telas
    agente/                  agente de impressão
  packages/
    dominio/                 regras e contas puras, com testes (acerto, pedido, preço, layout de impressão)
    db/                      tipos gerados do banco (`supabase gen types`) e schemas Zod
  supabase/
    migrations/              uma migração por mudança, sempre versionada
    seed.sql                 áreas, cardápio (de docs/dados/cardapio-mel.json), motoboys e contas de teste
    tests/                   testes de RLS por papel, de aplicar_operacao e dos erros previstos
```

Pastas que só nascem com a sua fase: `apps/cliente` (fase 6), `apps/integracoes` (só se o Pix exigir mTLS), `supabase/functions` (integrações) e `/cozinha` e `/garcom` (fases 3 e 4).

## Modelo de dados (núcleo)

Dinheiro sempre em centavos (`integer`). Os IDs são `uuid` gerados no aparelho. Toda tabela tem `criado_em` e `atualizado_em`.

| Tabela | Campos principais | Fase |
|---|---|---|
| `perfis` | id (auth), nome, papeis (lista), ativo. Só quem usa o sistema | 1 |
| `motoboys` | nome, ativo. Cadastro sem login (decisão 0007) | 1 |
| `config` | fuso (`America/Sao_Paulo`), funcionalidades desligadas (OPE1), padrões (caixa 8000, diária 3000) | 1 |
| `areas` | nome, cidade, taxa, ativa | 1 |
| `noites` | data, promo_desconto, aberta_em, fechada_em | 1 |
| `caixas` | noite, motoboy, caixa_inicial, diaria, ordem_chegada, dinheiro_contado, fechado_em | 1 |
| `pedidos` | noite, codigo (4 dígitos), cliente (nulo na comanda de papel), origem, tipo, area, endereço usado, local pendente, total, promocao, estado, atendendo_por, atendendo_aparelho, atendendo_desde, obs | 1 |
| `pedido_itens` | pedido, tipo, tamanho, sabores, item, quantidade e uma fotografia do momento da venda (nome, faixa cobrada, preço unitário, desconto da promoção). Relatórios antigos não mudam quando o cardápio muda | 2 |
| `saidas` | pedido, motoboy (de `motoboys`), caixa, taxa (gravada), estado (em_rota ou voltou; `separada` e `entregue` ficam sem uso), saiu_em, voltou_em, papel_conferido, cancelada | 1 |
| `pagamentos` | pedido, forma, valor, troco_pix, previsto ou real, saida (quem recebeu na porta), pix_confirmado e origem (manual, webhook, maquininha), referência externa (txid, NSU) | 1 |
| `acertos` | caixa, valores congelados (contado, falta, sobra, pago, do caixa dele, retirado do caixa da empresa, vai para a empresa, completado do bolso), confirmado_por, confirmado_em | 1 |
| `sobras`, `faltas` | caixa, valor, origem descoberta, devolvido_em | 1 |
| `clientes` | telefone completo, nome e o último local (pino, link do Maps, endereço, referência, área) | 2 |
| `cardapio_*` | faixas e preços por tamanho, sabores, bordas, adicionais, bebidas, combos e "acabou hoje" | 2 |
| `impressoes` | tipo (comanda, recibo do acerto, folha), impressora, conteúdo, estado, tentativas | 1 |
| `creditos`, `cobrancas_dobro`, `transacoes_maquininha` | Fora por enquanto (PAG8, PAG9 e integrações) | — |
| `operacoes`, `eventos` | fila aplicada (idempotência) e registro de quem fez o quê | 1 |
| `erros` | erros do front, do agente e das funções, sem dados de cliente | 1 |

## Fontes

- [Supabase: preços e pausa do plano grátis](https://supabase.com/pricing)
- [Supabase Edge Functions e mTLS com a Efí (discussão)](https://github.com/orgs/supabase/discussions/48894)
- [Efí: webhooks Pix e mTLS](https://dev.efipay.com.br/en/docs/api-pix/webhooks/)
- [Vercel: plano Hobby só para uso não comercial](https://vercel.com/docs/plans/hobby-plan)
- [Cloudflare Pages vs Vercel: uso comercial](https://agentdeals.dev/cloudflare-pages-vs-vercel)
- [Fly.io: preços](https://fly.io/pricing.md)
- [PowerSync: preços](https://toolradar.com/tools/powersync/pricing)
- [Chrome: acesso à rede local](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access?hl=pt-br)
- [Impressão ESC/POS a partir de app web](https://yomotherboard.com/question/whats-the-best-way-to-print-esc-pos-receipts-from-a-web-saas-2/)
- [Saipos: impressoras para lanchonete](https://saipos.com/sistema/lanchonete/impressora-para-lanchonete)
- [Epson TM-m30III: especificações](https://www.epson.co.in/For-Work/Printers/POS-Printers/Epson-TM-m30III-Thermal-Receipt-POS-Printer%28USB%2BLAN%2BBT%2BWIFI%29/p/C31CK50442)
- [Bematech MP-4200 HS: conexões e preço](https://www.bztech.com.br/bematech/impressora-mp-4200)
- [Galago: USB, rede, Wi-Fi ou Bluetooth na impressora térmica](https://galago.com.br/blog/impressora-termica-como-escolher.html)
- [ReceiptLine](https://npmjs.com/package/receiptline)
- [Mercado Pago Point: integração com PDV](https://www.mercadopago.com.br/developers/pt/docs/mp-point-legacy/overview)
- [Focus NFe: preços](https://focusnfe.com.br/precos/)
- [Itaú: Nova Laranjinha+ (Rede)](https://www.itau.com.br/empresas/pagamentos-recebimentos/maquininha-cartao/nova-laranjinha-mais)
- [Rede: autorizar o compartilhamento da conciliação (exemplo Alterdata)](https://ajuda.alterdata.com.br/esbdc/tema-eextratos/eextratos-como-configurar-o-aceite-e-autorizacao-da-operadora-rede)
- Pesquisa de pedidos e pagamentos: `referencia/pesquisa-pedidos-pagamentos.md`
