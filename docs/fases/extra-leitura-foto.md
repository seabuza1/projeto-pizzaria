# Extra: leitura da comanda por foto (plano B)

**Plano B.** Vale só enquanto existir comanda escrita à mão: na fase 1, ou numa noite sem sistema depois da fase 2. Não é o caminho principal: a pesquisa (`docs/referencia/pesquisa-pedidos-pagamentos.md`) mostrou que o pedido digitado pelo atendente resolve melhor. Precisa da fase 1 pronta. As regras PED, ENT, PAG e ACE estão em `docs/PROJETO.md`.

## Objetivo

O motoboy fotografa a comanda ao pegar a entrega. O app preenche código, total e pagamento e sugere a área. A conta pelo cardápio diz se a leitura confere, e o motoboy confirma com um toque. A porta, o acerto e o painel não mudam.

Com letra de mão não existe leitura 100% certa. A segurança vem de três coisas juntas: a leitura, a conferência pelo cardápio e o toque do motoboy.

## O que entra

1. Cardápio, regras e glossário: copiados de `docs/dados/cardapio-mel.json` para `supabase/functions/_shared/cardapio-mel.json` (depois da fase 2, lidos das tabelas do cardápio). A Edge Function manda para a IA, e o domínio usa para a conta.
2. Domínio `packages/dominio/src/leitura.ts`, com os testes L1 a L14. O preço dos itens vem de `packages/dominio/src/preco.ts`, o mesmo da fase 2; se a leitura vier antes, ele nasce aqui, com os testes P1 a P11 de `F2-pedido.md`.
3. Edge Function `ler-comanda`: recebe a foto, faz duas leituras com a IA configurada (Gemini 3.1 Pro por padrão) e devolve as duas.
4. Botão de foto, tela "Lendo" e tela de confirmação.
5. Fila offline das fotos e leitura posterior.
6. Fotos no Storage e tabela `leituras` para medir, numa migração nova.
7. Foto da comanda no painel do Luan.
8. Script `scripts/comparar-modelos.ts` para comparar modelos com as fotos da noite de teste.

Fica de fora: QR code (fase 2), câmera própria com moldura, recorte por campo, leitura do relatório da maquininha e da folha de expedição.

## Regras

- **LEI1 Transcrição.** A IA só transcreve. Não corrige, não deduz e não calcula. Trecho ilegível vira `[?]` e entra em `ilegiveis`. Valores vêm como texto, do jeito que estão escritos, e o domínio converte.
- **LEI2 Cardápio como dicionário.** O item que a IA casa com o cardápio vem com `casou_pelo_cardapio: true`. Se a palavra lida cabe em sabores de faixas com preços diferentes (lista `ambiguidades` do JSON, como "frango" e "lombo"), a IA devolve as opções e o item fica sem preço até o motoboy escolher.
- **LEI3 Preço dos itens.** Pizza: preço da faixa no tamanho. Meio a meio: o maior preço entre os sabores (PED3). Bebida, borda e adicional saem do cardápio. Combo: preço do combo.
- **LEI4 Área sugerida, nesta ordem:**
  1. Local escrito na comanda, pelo glossário ("Arag." = Aragarças) → origem `escrito`.
  2. Sem local: total lido − itens = taxa de exatamente uma área ativa da tabela `areas` → origem `valor`.
  3. Senão, Aragarças → origem `padrao`.

  A área é sempre só sugestão: o motoboy toca nela para confirmar. Um 3 lido como 8 transforma 113 (Aragarças) em 118 (Pontal), e a conta fecha errada (teste L3).
- **LEI5 Promoção da noite** (PED4). Asterisco = desconto em reais nas pizzas cuja faixa cobrada é `tradicional`. Vai de R$ 3 a R$ 23 e muda toda noite.
  - Se a faixa cobrada não for tradicional (como no meio a meio premium/tradicional da 3557), não tem desconto.
  - O valor da noite fica em `noites.promo_desconto`.
  - Ainda sem valor, se a comanda tem asterisco e pizza tradicional e esperado − lido fica entre 3 e 23, ela fica amarela com "Promoção de R$ X hoje?". Confirmando, o valor é gravado no caixa e passa a valer para os próximos pedidos.
  - Por enquanto o desconto vale uma vez por pizza tradicional (ver Pendências).
- **LEI6 Conferência.** Esperado = itens − promoção + taxa da área tocada.
  - **Verde:** telefone com 4 dígitos, total e pagamento lidos, as duas leituras iguais nos campos críticos, todos os itens com preço e esperado = lido.
  - **Amarelo:** a conta fecha, mas tem algo para olhar: promoção sugerida, alerta (LEI8) ou trecho ilegível que não entra na conta.
  - **Vermelho:** esperado ≠ lido, campo crítico ilegível ou divergente, ou item sem preço. Só lança depois de corrigir, ou com dois toques em "Lançar assim". Esse caso fica marcado como `forcado` na leitura.
  - Corrigir um campo recalcula na hora.
- **LEI7 Dupla leitura.** Duas chamadas em paralelo: uma completa e outra só com os campos críticos (telefone e total dígito por dígito, forma de pagamento, local e asterisco). Se um campo crítico divergir, ele fica vermelho e a tela mostra as duas versões para escolher. A conferência pode usar outro modelo (`IA_MODELO_CONFERENCIA`): modelos diferentes tendem a não errar o mesmo dígito.
- **LEI8 Alertas (amarelo).** Total abaixo de R$ 20 ou acima de R$ 300. Total terminando em ,99 sem combo casado. O código repetido continua como na PED1.
- **LEI9 Foto e medição.** A foto fica ligada à comanda e o Luan vê no painel. Toda leitura grava em `leituras` o que a IA leu, o que foi lançado, se houve correção, se foi forçada, o provedor, o modelo, os tokens e o tempo.
- **LEI10 Sem internet.** A foto entra na fila e o motoboy lança à mão como hoje. Quando a leitura chega depois, ela vira conferência: se discordar do que foi lançado, a comanda ganha um aviso na lista. Nada muda sozinho.
- **LEI11 Pagamento.** "Cartão" → `cartao`. "Dinheiro" → `dinheiro`. "Pix" pede um toque entre `pix_antecipado` e `pix_maquina` (ver Pendências). No pagamento misto, a IA traz o valor de cada parte quando está escrito.

## Saída da IA

A saída vem em JSON validado por um schema, igual para qualquer provedor. O schema fica em `supabase/functions/_shared/schema.ts` (JSON Schema simples: `type`, `properties`, `required`, `enum`, `items`, sem `$ref`). O exemplo completo está em `supabase/functions/_shared/exemplos/3557.json`.

Leitura completa:
```
telefone_final:  string | null       // 4 dígitos como escritos
promocao:        boolean             // asterisco presente
local_escrito:   string | null       // bairro, cidade ou referência como escritos
itens: [{
  lido: string                       // o trecho como escrito
  tipo: "pizza" | "bebida" | "borda" | "adicional" | "combo" | "outro"
  quantidade: number
  tamanho: "B" | "P" | "M" | "G" | null
  sabores: string[]                  // nomes exatos do cardápio
  item: string | null                // nome exato do cardápio (bebida, borda, adicional, combo "01".."04")
  casou_pelo_cardapio: boolean
  opcoes: string[]                   // quando ambíguo: os sabores possíveis
}]
pagamento: [{ forma_escrita: string, forma: "dinheiro" | "cartao" | "pix" | null, valor_escrito: string | null }]
total_escrito:   string | null       // ex.: "113,00"
transcricao:     string[]            // linha por linha
ilegiveis:       string[]
```

Leitura de conferência:
```
telefone_digitos: string[]   // ["3","5","5","7"]
total_digitos:    string[]   // ["1","1","3",",","0","0"]
forma_escrita:    string | null
local_escrito:    string | null
promocao:         boolean
```

## Prompt

Fica em `supabase/functions/_shared/prompt.ts`, igual para todos os provedores. O system leva:
1. As regras:
   > Você está lendo uma comanda de pizzaria escrita à mão. Transcreva exatamente o que está escrito, linha por linha, sem corrigir, deduzir ou completar nada. Marque trechos ilegíveis com [?] e liste-os em "ilegiveis". Transcreva o total e o telefone dígito por dígito. Use o cardápio e o glossário só para identificar itens, e marque casou_pelo_cardapio quando usar. Se uma palavra couber em mais de um sabor, devolva as opções em vez de escolher. Não calcule valores.
2. O glossário.
3. O cardápio: nomes dos sabores por faixa, tamanhos, bebidas, bordas, adicionais e combos. Os ingredientes não vão.
4. Os exemplos de `exemplos/`, cada um com a foto e o JSON esperado. Por enquanto só a 3557. Depois da noite de teste entram de 3 a 5 comandas de cada uma das duas pessoas que escrevem.

A parte fixa (system e exemplos) vem sempre primeiro e idêntica em toda chamada; a foto da comanda vem por último. Assim o cache do provedor funciona: no Gemini é automático; na Anthropic, usar `cache_control` no system e nos exemplos.

## Edge Function `ler-comanda`

- `POST { imagem: string }` (JPEG em base64) → `{ leitura, conferencia, provedor, modelo, ms }` ou `{ erro }`.
- Exige usuário logado (verificação de JWT padrão).
- Faz as duas chamadas em paralelo, com timeout de 30 s. Em qualquer erro, devolve `{ erro }` e o front volta para o lançamento manual.
- Recusa imagem acima de 2 MB.
- Nenhuma chave vai para o front nem para os logs.

### Provedor configurável

Cada provedor é um adaptador em `supabase/functions/_shared/ia/` com a mesma interface:
```ts
ler(imagemBase64: string, modo: 'completa' | 'conferencia', modelo: string)
  → Promise<{ json: unknown, tokens: { entrada: number, cache: number, saida: number }, ms: number }>
```
- `google.ts` (padrão) e `anthropic.ts`. Trocar de modelo ou provedor é só mudar os secrets.
- O resultado passa pela mesma validação do schema antes de voltar ao front.

Secrets:

| Secret | Padrão | Uso |
|---|---|---|
| `IA_PROVEDOR` | `google` | `google` ou `anthropic` |
| `IA_MODELO` | `gemini-3.1-pro-preview` | modelo da leitura completa |
| `IA_MODELO_CONFERENCIA` | igual a `IA_MODELO` | modelo da leitura de conferência (LEI7) |
| `GEMINI_API_KEY` | | chave do Google AI Studio |
| `ANTHROPIC_API_KEY` | | só se usar a Anthropic |

### Gemini (`google.ts`)

Conferir os detalhes na documentação antes de implementar (links no fim): a API mudou para o endpoint Interactions.
- `POST https://generativelanguage.googleapis.com/v1beta/interactions`, com o header `x-goog-api-key`.
- Corpo:
  - `model`: o do secret;
  - `system_instruction`: o prompt fixo;
  - `input`: exemplos e, por último, `{ "type": "image", "mime_type": "image/jpeg", "data": "<base64>", "resolution": "high" }` mais o texto do modo;
  - `generation_config: { "thinking_level": "low" }` (no 3.1 Pro não existe `minimal`); não baixar a temperatura, o Google recomenda manter 1.0 nos modelos Gemini 3;
  - `response_format: { "type": "text", "mime_type": "application/json", "schema": <schema do modo> }`;
  - `store: false`, para o Google não guardar a interação.
- A resposta em texto fica em `steps`: o passo `model_output`, conteúdo `text`. Os tokens vêm em `usage` (`total_input_tokens`, `total_cached_tokens`, `total_output_tokens`, `total_thought_tokens`).
- Conta paga: o 3.1 Pro não tem nível grátis. Usar só conta paga, onde o Google não usa os dados para treinar.

### Anthropic (`anthropic.ts`)

- Messages API com tool use forçado, `input_schema` igual ao schema do modo, e `cache_control` na parte fixa.

## Front

- **Botão "Foto"** grande na tela Noite, acima do formulário. Usar `<input type="file" accept="image/*" capture="environment">`.
- **Antes de enviar:**
  - redimensionar para no máximo 1600 px no lado maior, em JPEG com qualidade 0,8;
  - medir a nitidez (variância do Laplaciano num canvas, em tons de cinza). Abaixo do limite, mostrar "Foto tremida, tire de novo". O limite é calibrado com as fotos da noite de teste.
- **"Lendo…":** mostra a foto, com o link "Digitar" para voltar ao manual a qualquer momento.
- **Tela de confirmação:**
  - foto no topo, que amplia com um toque;
  - itens com preço, taxa, esperado × lido e o estado;
  - chips de área com a sugestão em destaque e a origem escrita embaixo ("escrito na comanda", "pelo valor" ou "padrão");
  - forma de pagamento já marcada;
  - código e total editáveis;
  - quando a área veio "pelo valor", os dígitos do total que se confundem (3/8, 1/7, 5/6, 0/6) aparecem sublinhados.
  - **Verde ou amarelo:** tocar na área lança, como o toque na forma da fase 1, com "3557 lançada · Desfazer".
  - **Vermelho:** o campo com problema aparece em vermelho e a tela oferece "Lançar assim" com dois toques.
- **Lista da noite:** ícone de câmera nas comandas com foto e aviso de "leitura não confere" (LEI10).
- **Painel do Luan:** tocar no código abre a foto.

## Banco (migração nova)

- `noites.promo_desconto` já existe desde a fase 1 (em centavos, nulo até ser definido).
- `pedidos.foto_path` e `pedidos.area_origem` (`escrito`, `valor`, `padrao` ou `manual`).
- Tabela `leituras`, com as mesmas regras de acesso de `pedidos`. Inclui `provedor`, `modelo`, `tokens_entrada`, `tokens_cache`, `tokens_saida` e `ms`.
- Bucket privado `comandas`, com caminho `{noite_id}/{pedido_id}.jpg`, só JPEG e até 2 MB.
  - Lê o dono do caixa ou a equipe.
  - Envia o dono do caixa enquanto o acerto não foi confirmado, ou a equipe.
  - Apaga só o admin.
  - Fotos com mais de 30 dias podem ser apagadas (o plano grátis do Supabase tem 1 GB); o que a IA leu continua em `leituras`.

## Comparar modelos: `scripts/comparar-modelos.ts`

Roda local (Node ou Deno), com as chaves num `.env` fora do repositório.
- Entrada: uma pasta com as fotos da noite de teste e um `gabarito.csv` com o certo de cada comanda (código, total, área, forma), tirado do que foi lançado e conferido.
- Roda cada foto em cada modelo de uma lista (padrão: `google:gemini-3.1-pro-preview`, `google:gemini-3.8-flash`, `anthropic:claude-haiku-5-5`), usando os mesmos adaptadores, prompt e `leitura.ts`.
- Saída `comparacao.csv` e um resumo por modelo: verdes certas, **verdes erradas** (meta: zero), amarelas, vermelhas, tempo médio e custo por foto (tokens × preço da tabela no script).
- Escolher o mais barato com zero verdes erradas e poucas vermelhas, e gravar nos secrets.

## Casos de teste do domínio (R$)

Usam o cardápio real e as áreas iniciais: Aragarças 5, Pontal 10, Barra 12, Parque de Exposições 15.

Comanda base, a 3557 real: G meio a meio Filé Mignon / Calabresa (93) + Refrigerante 2L (15) = itens 108. Tem asterisco, local "hospital da Arag.", total "113,00" e pagamento Cartão.

| Teste | Entrada | Esperado |
|---|---|---|
| L1 | 3557 como lida | área Aragarças (escrito), esperado 113, **verde** |
| L2 | 3557 sem local | Aragarças (valor), **verde** |
| L3 | 3557 sem local, total "118,00" | sugere Pontal (valor) e fecha em 118, **verde**: mostra por que a área precisa de toque. Tocando Aragarças: esperado 113 ≠ 118, **vermelho** |
| L4 | 3557, motoboy toca Barra | esperado 120 ≠ 113, **vermelho** |
| L5 | 3557 sem local, total "110" | nenhuma área (diferença 2) → Aragarças (padrão), **vermelho** |
| L6 | 3557 sem local, total "123" | Parque de Exposições (valor), **verde** |
| L7 | G Calabresa + Refrigerante 2L, asterisco, "Arag.", total "83", sem promoção definida | esperado 93, **amarelo** "Promoção de R$ 10 hoje?". Confirmando: `promo_desconto` = 1000, **verde** |
| L8 | Promoção 10 definida. G Portuguesa, asterisco, "Arag.", total "68" | 73 − 10 + 5 = 68, **verde** |
| L9 | Promoção 10 definida. 3557 | faixa cobrada premium, sem desconto: esperado 113, **verde** |
| L10 | "G frango", "Arag.", total "78" | opções de 73, 86 e 93: item sem preço, **vermelho**, com as 4 opções listadas |
| L11 | 3557 com as leituras divergindo no total ("113,00" × "118,00") | **vermelho** no total, mostrando as duas |
| L12 | Conversão do valor lido | "113" → 11300; "113,00" → 11300; "R$ 113,50" → 11350; "1.130,00" → 113000; "11a,00" → nulo |
| L13 | Combo 01, "Arag.", total "154,99" | 149,99 + 5 = 154,99, **verde** |
| L14 | Refrigerante 1L, "Arag.", total "15,00" | 10 + 5 = 15 fecha, mas fica **amarelo** pelo alerta de valor abaixo de R$ 20 |

Os valores esperados foram conferidos por um cálculo à parte.

## Ordem de construção

1. `leitura.ts` com L1 a L14 passando, local e sem rede.
2. Migração da leitura.
3. Edge Function com o adaptador `google.ts` e os secrets. Testar com `exemplos/3557.jpg`: tem que dar verde em Aragarças.
4. Botão de foto, "Lendo" e tela de confirmação.
5. Fila offline e leitura posterior (LEI10).
6. Foto no painel do Luan.
7. Exportar `leituras` em CSV para medir.
8. Adaptador `anthropic.ts` e `scripts/comparar-modelos.ts`, rodados com as fotos da noite de teste.

## Pronto quando

- L1 a L14 passam, e os testes da fase 1 continuam passando.
- A foto da 3557 lida pela função dá verde em Aragarças.
- Em modo avião, a foto entra na fila e o lançamento manual funciona.
- Nenhuma chave de API aparece no bundle do front.
- Trocar `IA_PROVEDOR` e `IA_MODELO` muda o modelo sem mexer no código.
- Uma noite real foi medida: quantas comandas ficaram verdes, quantas verdes estavam erradas (meta: zero) e o tempo e o custo por comanda.

## Pendências

- Como a comanda diferencia Pix já pago de Pix na hora? Até saber, "Pix" pede um toque (LEI11).
- O desconto da promoção vale por pizza tradicional? Vale no meio a meio de duas tradicionais?
- Exemplos de 3 a 5 comandas de cada uma das duas pessoas que escrevem, depois da noite de teste.
- O `gemini-3.1-pro-preview` é versão de testes do Google e pode ser desligado com aviso prévio (o `gemini-3-pro-preview` foi desligado em março de 2026). Por isso o modelo fica num secret.

## Documentação

- Gemini, API Interactions: https://ai.google.dev/api/interactions-api
- Gemini, imagens: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini, resolução da imagem: https://ai.google.dev/gemini-api/docs/media-resolution
- Gemini, saída estruturada: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini, raciocínio: https://ai.google.dev/gemini-api/docs/thinking
- Gemini, modelos que serão desligados: https://ai.google.dev/gemini-api/docs/deprecations
- Anthropic, visão: https://platform.claude.com/docs/en/build-with-claude/vision
