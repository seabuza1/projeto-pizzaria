# Arquitetura

Decidida em 30/10/2026 a partir da pesquisa (fontes no fim). As decisões têm o motivo ao lado. Para mudar uma, atualize este arquivo antes do código.

## Em uma frase

Um app web instalável (PWA) em **TypeScript**, que funciona sem internet e grava primeiro no aparelho. Por trás, o **Supabase** (Postgres, login, tempo real, arquivos e funções), na região de São Paulo. Um **agente de impressão** pequeno roda no computador do balcão. Um servidor de integrações só entra se o Pix escolhido exigir certificado.

## O que a arquitetura precisa atender

1. **Celular na rua:** o motoboy usa o próprio celular (Android ou iPhone), às vezes sem sinal. Nada de instalar app de loja.
2. **Várias pessoas ao mesmo tempo:** atendentes, Luan, motoboys e gerente veem a mesma noite em tempo real.
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
| Servidor local na pizzaria (SQLite, PocketBase) | Funciona sem internet na rede local | O motoboy na rua precisa da nuvem de qualquer jeito; backup e acesso remoto ficam com vocês | Só a impressão fica local (o agente) |
| Next.js com SSR | Tudo num projeto só | O app é offline e não ganha nada com SSR; Vercel comercial é paga | Não |
| PowerSync no lugar da fila própria | Sincronização pronta | US$ 49 por mês no Pro (o grátis desativa após 1 semana parado); mais uma peça | Plano B se a fila própria der problema |

## Desenho

```
 Celulares (motoboys, Luan)      Balcão (atendente, gerente)          Cliente
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
 │  - ler-comanda (IA), pix-webhook, nfce    │  └─────────────────┘
 └───────────────┬───────────────────────────┘◄────────────────────────────┘
                 │ só se o Pix exigir mTLS
                 ▼
 ┌───────────────────────────┐     ┌───────────────────────────────┐
 │ apps/integracoes (Fly.io) │────►│ Banco/PSP Pix · NFC-e · IA    │
 └───────────────────────────┘     └───────────────────────────────┘
```

## Funcionar sem internet

**Leitura:** cada aparelho guarda a noite aberta no IndexedDB (pedidos, saídas, pagamentos, caixas, áreas, cardápio). As telas leem dali com `liveQuery`. Ao abrir, o app baixa a noite; depois recebe as mudanças pelo Realtime, filtradas pela noite. Se ficar mais de 1 minuto sem Realtime, ele baixa de novo.

**Escrita (fila de operações):**
1. Toda ação vira uma **operação**: `{ id, tipo, dados, criada_em, aparelho }`. O `id` é um UUID v7 gerado no aparelho. Exemplos: `lancar_saida`, `marcar_entregue`, `trocar_pagamento`, `voltou`, `confirmar_acerto`.
2. A operação é aplicada na hora no IndexedDB e entra na fila.
3. A fila envia as operações em ordem para a função `aplicar_operacao(op jsonb)` no Postgres (RPC). Ela:
   - é **idempotente**: guarda o `id` em `operacoes` e ignora repetidas;
   - **valida** o papel, a transição de estado e as travas (por exemplo, nada muda depois do acerto confirmado);
   - grava em `eventos` quem fez o quê e quando (OPE2).
4. **Operação recusada:** o aparelho desfaz o efeito local e mostra o motivo. Exemplo: "3557: o acerto já foi confirmado pelo Luan".
5. **Indicador discreto:** "Salvo" ou "3 alterações esperando internet".

**Conflitos:** como o servidor recebe ações, e não linhas inteiras, quase não há conflito. Para campos simples, como observações, vale a última alteração.

**Telas:** só conversam com `src/data/repo.ts`, que esconde o IndexedDB, a fila e o Supabase. As telas não fazem conta: as contas ficam em `packages/dominio`.

## Impressão

- **Fila no banco:** a tabela `impressoes` guarda cada trabalho (tipo, impressora de destino, conteúdo, estado, tentativas). Qualquer aparelho pode pedir uma impressão, inclusive o celular do motoboy.
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

Cada integração fica atrás de uma interface em `packages/dominio/src/integracoes/`, para trocar de fornecedor sem mexer nas telas.

| Integração | Como | Onde roda |
|---|---|---|
| Leitura de comanda por foto (extra) | Gemini ou Claude, com o modelo num secret | Edge Function `ler-comanda` |
| Pix automático | Cobrança com QR dinâmico (copia e cola) por pedido, com `txid`, e confirmação por webhook | Depende do provedor (abaixo) |
| Maquininha (Laranjinha, Itaú/Rede) | Primeiro: importar o relatório de vendas do Portal Rede e casar pelo valor, pela maquininha e pela hora. A Rede também compartilha o extrato de conciliação com sistemas autorizados no portal (Conciliação → Compartilhar). A maquininha integrada só viria trocando de adquirente, o que hoje não compensa | Domínio + Edge Function |
| NFC-e | API de emissão (exemplo: Focus NFe), com certificado A1 e credenciamento na SEFAZ-GO; ou continuar no sistema fiscal atual | Edge Function |
| WhatsApp | Links de conversa com o texto pronto (`wa.me/55…?text=…`), sem API. A API paga fica para depois | Front |

**Escolha do provedor Pix:** a maquininha é a Laranjinha do Itaú, então o banco provável é o Itaú (confirmar: pergunta 7 de `PROJETO.md`).
- **Itaú, pela API Pix padrão do Banco Central:** fica tudo no mesmo banco. Exige certificado (mTLS), então precisa do `apps/integracoes`. A tarifa do QR dinâmico vai de 1,30% a 1,45%, conforme a fonte; confirmar a tarifa negociada.
- **Inter PJ só para o Pix antecipado:** 0,9%, mín. R$ 0,10 e máx. R$ 1,50. Também exige certificado. Custa abrir e administrar uma segunda conta.
- **Mercado Pago:** usa token, sem certificado, e roda nas Edge Functions. Também é uma segunda conta.
- **Decisão:** ver primeiro a tarifa negociada no Itaú. Num pedido de R$ 80, a diferença entre o Itaú (cerca de R$ 1,10) e o Inter (R$ 0,72) é de uns R$ 0,40 por Pix.

## Segurança e dados pessoais

- **Regras de acesso:** RLS em todas as tabelas, com funções `security definer` para ler o papel (modelo em `referencia/schema-v1.sql`).
- **Papéis:** `admin`, `gerente`, `expedicao`, `atendente`, `motoboy`, `cozinha`, `garcom`, `agente`.
- **Testes de acesso:** um teste por papel com contas reais no Supabase local. Exemplos: o motoboy não vê o caixa de outro, e não edita depois do acerto.
- **Chaves:** no front, só a anon key. A service role e as chaves de API ficam nos secrets do Supabase ou do servidor. Backups `.json` e `.env` ficam fora do repositório (`.gitignore`).
- **Dados de cliente** (telefone, endereço, localização): o motoboy vê só os das próprias saídas da noite. Os logs não levam dados pessoais.
- **Backups:** os backups diários do Supabase Pro e um `pg_dump` semanal guardado fora do Supabase.

## Hospedagem e custos mensais

| Item | Escolha | Custo |
|---|---|---|
| Front (apps/web e apps/cliente) | Cloudflare Pages | R$ 0 |
| Supabase | Free para desenvolver. Pro antes da primeira noite real, porque o Free pausa após 1 semana sem uso | US$ 25 (uns R$ 140) |
| Servidor de integrações (só se o Pix exigir mTLS) | Fly.io, `gru`, shared-cpu-1x | Uns US$ 3,54 |
| Domínio | `.com.br` no registro.br | Uns R$ 40 por ano |
| IA da leitura por foto (extra) | Conforme o modelo | R$ 11 a 185 |
| NFC-e por API (se o PDV emitir) | Focus NFe, plano Retail | Uns R$ 145 para 2.000 notas |
| Pix automático | Tarifa do provedor | 0,9% a 1,2% por Pix antecipado |
| Hardware | Impressora térmica sem fio (Wi-Fi de fábrica, ou de rede com ponte Wi-Fi); o computador do balcão já existe | Cerca de R$ 680 por impressora de rede, mais a ponte Wi-Fi; uma vez |

## Repositório

```
mel-pdv/
  CLAUDE.md
  .claude/                   settings.json (permissões, plugins, hooks) e hooks/ (ver docs/CLAUDE-CODE.md)
  .mcp.json                  MCP do Supabase, somente leitura, projeto de desenvolvimento
  docs/                      MVP, PROJETO, ARQUITETURA, BANCADA-TESTES, CLAUDE-CODE, fases/, dados/, referencia/
  apps/
    web/                     PWA da equipe: /motoboy, /expedicao (painel do Luan), /atendimento,
                             /gerente, /cozinha, /garcom, /admin
      src/data/repo.ts       única porta de dados das telas
    cliente/                 página pública de pedido (fase 6)
    agente/                  agente de impressão
    integracoes/             só se o Pix exigir mTLS
    bancada/                 ambiente de testes: Pix falso, impressora virtual, noite simulada (depois do MVP)
  packages/
    dominio/                 regras e contas puras, com testes (acerto, pedido, preço, conciliação,
                             leitura, layout de impressão, interfaces das integrações)
    db/                      tipos gerados do banco (`supabase gen types`) e schemas Zod
  supabase/
    migrations/              uma migração por mudança, sempre versionada
    functions/               aplicar_operacao fica no SQL; ler-comanda, pix-webhook, nfce aqui
    seed.sql                 áreas, cardápio (de docs/dados/cardapio-mel.json) e contas de teste
    tests/                   testes de RLS por papel
```

## Modelo de dados (núcleo)

Dinheiro sempre em centavos (`integer`). Os IDs são `uuid` gerados no aparelho. Toda tabela tem `criado_em` e `atualizado_em`.

| Tabela | Campos principais | Fase |
|---|---|---|
| `perfis` | id (auth), nome, papel, ativo | 1 |
| `config` | fuso (`America/Sao_Paulo`), fases ligadas, padrões (caixa 8000, diária 3000) | 1 |
| `areas` | nome, cidade, taxa, ativa | 1 |
| `noites` | data, promo_desconto, aberta_em, fechada_em | 1 |
| `caixas` | noite, motoboy, caixa_inicial, diaria, ordem_chegada, dinheiro_contado, fechado_em | 1 |
| `pedidos` | noite, codigo (4 dígitos), cliente (nulo na fase 1), origem, tipo, area, total, promocao, estado, atendendo_por, atendendo_desde, obs | 1 |
| `pedido_itens` | pedido, tipo, tamanho, sabores, item, quantidade, preço unitário gravado | 2 |
| `saidas` | pedido, motoboy, caixa, taxa (gravada), estado (separada, em_rota, entregue, voltou), saiu_em, voltou_em, papel_conferido | 1 |
| `pagamentos` | pedido, forma, valor, troco_pix, previsto ou real, saida (quem recebeu na porta), pix_confirmado e origem (manual, webhook, maquininha), referência externa (txid, NSU) | 1 |
| `acertos` | caixa, valores congelados (contado, falta, sobra, pago, do caixa dele, retirado do caixa da empresa, vai para a empresa, completado do bolso), confirmado_por, confirmado_em | 1 |
| `sobras`, `faltas` | caixa, valor, origem descoberta, devolvido_em | 1 |
| `clientes`, `cliente_locais` | telefone completo, nome; pino, link do Maps, endereço, área | 2 |
| `cardapio_*` | faixas e preços por tamanho, sabores, bordas, adicionais, bebidas, combos | 2 |
| `impressoes` | tipo, impressora, conteúdo, estado, tentativas | 2 |
| `creditos`, `cobrancas_dobro` | cliente, valor, motivo, usado_em; pedido, escolha, resolvido | 2 |
| `transacoes_maquininha` | maquininha, valor, hora, NSU, pagamento casado | integrações |
| `operacoes`, `eventos` | fila aplicada (idempotência) e registro de quem fez o quê | 1 |

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
