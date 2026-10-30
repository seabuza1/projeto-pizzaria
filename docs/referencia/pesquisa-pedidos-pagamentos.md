# Pedidos e pagamentos: o que outros fizeram e o que serve para a Mel

> **Atualização de 30/10/2026:** a leitura da comanda por foto (porta C) saiu do projeto. Numa noite sem sistema, a comanda é escrita à mão e lançada depois pelo lançamento rápido da fase 1.

Pesquisa de 30/10/2026 (corrigida no mesmo dia: a Mel fica em Aragarças, GO). Base para decidir a fase 2 (pedido) e a conferência automática de Pix e cartão. As fontes estão no fim; os números de fornecedores (Anota AI, Brendi, Efí, Jota) são propaganda deles e estão marcados.

## Resumo

1. **Ninguém que deu certo tirou o atendimento humano.** O que funciona é o humano **digitar o pedido no sistema durante a conversa**, em vez de escrever no papel, e o link do cardápio ficar como opção para quem quiser. Foi o que faltou na tentativa com o Saipos.
2. **Pix automático exige cobrança com QR dinâmico (copia e cola) gerada por pedido.** Com chave fixa, não há como saber sozinho qual pedido foi pago. Custa de 0,9% a 1,2% por Pix recebido. O Pix feito na maquininha já é confirmado pela própria máquina.
3. **Cartão:** dá para casar o relatório da maquininha com as comandas sem trocar de máquina. A maquininha integrada (o sistema manda o valor e recebe a resposta) é o passo seguinte, se valer a troca.
4. **Nota fiscal:** a NFC-e é obrigatória para a Mel. Um PDV completo precisa emitir NFC-e ou continuar com o sistema fiscal que a Mel usa hoje.

## 1. Como outros resolveram a coleta de pedidos

**Números**
- **Brasil:** o WhatsApp responde por 26% do faturamento de delivery de bares e restaurantes, e 63% dos que fazem delivery vendem por ele. O telefone ainda é 8% e 41% ainda recebem por telefone. 38% usam alguma automação no atendimento: 21% robô com gente e 17% só IA (Abrasel 2025, 2.176 donos).
- **EUA:** 42% dos clientes pediram por telefone nos últimos 3 meses, contra 17% por aplicativo de entrega (PYMNTS/Paytronix, 2022).

**Casos**
- **Redes de pizza nos EUA (NRN, 2009, reportagem antiga mas com a lição ainda válida)** mantêm central telefônica mesmo com pedido online, porque "o povo está acostumado a ligar". A zpizza tentou fazer o atendente digitar o pedido do telefone na mesma tela do pedido online e desistiu: havia "lacunas enormes entre a interface online e o pedido conversado" (NRN).
  - **Lição:** a tela de quem atende tem que ser feita para conversa, não pode ser a tela do cliente.
- **Pizzaria nos EUA (Pizza Today, 2021):** o pedido online foi de 27% para 73% da retirada.
  - **O que fizeram:** gravação na ligação avisando do link, link curto, divulgação na caixa da pizza e nas redes, e pedido online caindo direto no sistema, sem redigitar.
  - **Quem não quis mudar** continuou ligando. O dono retornava as ligações, e muitos já tinham pedido pelo link.
  - **Frase do autor:** "não é porque você constrói que eles vêm".
- **Casos brasileiros contados pela Anota AI** (Pizzaria do Maestro e Galeria da Pizza), sem números de adesão:
  - um robô no WhatsApp manda o link do cardápio e o pedido cai direto na cozinha;
  - o atendimento humano fica para quem tem dificuldade.
- **Saipos e Anota AI fazem coisas diferentes.** O Saipos é o sistema de dentro (PDV, cozinha, fiscal). A Anota AI é a porta de entrada (cardápio, robô). A própria Anota AI recomenda começar pelo maior gargalo, não por tudo de uma vez.
- **IA que lê texto e áudio do WhatsApp e monta o pedido** já é vendida (Brendi e outros).
  - Os fornecedores não divulgam taxa de erro.
  - A IA precisa das regras do cardápio (meio a meio, combos) para não mandar pedido impossível para a cozinha.

**O padrão que se repete**
1. O canal humano nunca sai.
2. O humano digita no sistema em vez de escrever no papel.
3. O link cresce com divulgação e facilidade, não por obrigação.
4. Tudo cai numa fila só, para a cozinha e para a expedição.

## 2. Modelo misto para a Mel: um pedido, três portas

Sim, rola. É o que quase todo mundo faz. O cliente escolhe como quer pedir, e o pedido sempre termina igual: digitado, com código, impresso para a cozinha e visível na expedição.

| Porta | Como o cliente pede | Quem digitaliza | Quando entra |
|---|---|---|---|
| **A. Conversa** (como hoje) | Texto ou áudio no WhatsApp | O atendente digita no sistema enquanto conversa | Primeiro |
| **B. Link** (opcional) | Recebe o link na primeira mensagem e monta o pedido | Ninguém: o atendente só confirma | Depois da A estar firme |
| **C. Papel** (reserva) | Igual a hoje | Foto da comanda lida por IA, depois | Só se cair internet ou sistema |

**Porta A: a tela de pedido do atendente.** É o coração da fase 2. Tem que ser mais rápida que escrever à mão:
- digita o telefone e aparecem o nome, o último endereço e os últimos pedidos, com "repetir";
- sabores com busca por 2 ou 3 letras, meio a meio num toque, borda, bebida e combo;
- área sugerida pelo endereço e taxa somada sozinha, com o total calculado (sem conta de cabeça);
- forma de pagamento (inclusive mista) e troco;
- imprime a comanda com o código grande (os 4 dígitos) e um QR;
- **opcional, depois:** botão "colar mensagem". O atendente cola o texto do cliente e a IA monta um rascunho do pedido para ele conferir. Com texto, isso custa centavos por noite.

**Porta B: link.** Para mandar o link não precisa da API paga do WhatsApp: basta a mensagem de saudação automática do WhatsApp Business ("Quer pedir pelo link? …"). O pedido cai na mesma fila e o atendente confirma. Ninguém é obrigado. Mede-se a porcentagem por porta toda semana.

**Porta C: papel.** A leitura de comanda por foto, que já tem spec, deixa de ser o caminho principal e vira o plano B para noite sem sistema.

**Dois atendentes no mesmo WhatsApp.** Hoje uma pessoa começa um atendimento e a outra não sabe.
- **De graça, já:** o WhatsApp Business aceita 1 celular e mais 4 aparelhos, mas não diz quem está atendendo. Dá para usar etiquetas ("Luan atendendo").
- **Com o sistema:** quando alguém digita o telefone na tela de pedido, o sistema marca "Fulana está atendendo 3557" para os outros. A coordenação acontece no PDV, sem custo.
- **WhatsApp API com caixa de entrada compartilhada** (atribuição de conversa, robô, IA lendo as mensagens):
  - **Coexistência:** desde 2026 dá para manter o app no celular junto com a API, no mesmo número.
  - **Cobrança por mensagem desde 01/10/2026:** são 1.000 mensagens de atendimento grátis por mês e por número. Depois disso, cerca de US$ 0,0068 por mensagem no Brasil.
  - **Conta:** 70 pedidos × 8 mensagens da pizzaria × 22 noites ≈ 12.300 mensagens ≈ **R$ 420 por mês**, mais a plataforma (exemplo: US$ 24 por usuário). Só vale se o volume ou a IA justificarem.

**Ordem de transição**, sem repetir o erro do Saipos:
1. **Porta A numa noite fraca (quarta):** pedidos digitados com o papel em paralelo, comparando no fim da noite.
2. **Porta A em todas as noites:** o papel vira reserva.
3. **Porta B:** saudação com link, sem forçar ninguém.
4. **Medir a porcentagem por porta.** Se o link passar de uns 30%, pensar em incentivo (brinde, prioridade).

## 3. Conferência automática de Pix

**Chave fixa (como hoje).** O dinheiro cai, mas nada liga o Pix ao pedido. A conferência é olhar o extrato, e o comprovante pode ser falso: há vários casos de pizzarias que receberam print de Pix falso. Comprovante não prova nada; só a consulta ao banco prova.

**Cobrança Pix (QR dinâmico ou copia e cola) pela API do banco.** É assim que se automatiza:
1. Ao fechar um pedido "Pix antecipado", o sistema pede ao banco uma cobrança com o valor exato e um identificador do pedido (`txid`).
2. O sistema manda o copia e cola (ou o QR) para o cliente no WhatsApp.
3. Quando o cliente paga, o banco avisa o sistema por webhook (uma chamada automática para o servidor).
4. O pedido vira "Pix confirmado" sozinho. A coluna PIX da folha do Luan se preenche sozinha.
5. Se o cliente não pagar, a cobrança expira e o pedido fica "aguardando Pix".

**Custo de receber Pix por QR dinâmico (pessoa jurídica):**

| Banco ou PSP | Tarifa | Num pedido de R$ 80 |
|---|---|---|
| Inter | 0,9% (mín. R$ 0,10, máx. R$ 1,50) | R$ 0,72 |
| Banco do Brasil | 0,99% (máx. R$ 140) | R$ 0,79 |
| Efí (fornecedor) | 1,19% | R$ 0,95 |
| Bradesco | 1,40% (máx. R$ 145) | R$ 1,12 |
| Itaú | 1,30% a 1,45%, conforme a fonte | R$ 1,04 a 1,16 |

Cada 10 Pix antecipados por noite dão uns **R$ 160 por mês no Inter** (220 Pix × R$ 0,72).

**Pix na porta: na maquininha.** A própria máquina confirma. A tarifa vai de 0% (Ton, InfinitePay, SumUp) a 0,49% (Mercado Pago Point), conforme o plano.

**Troco por Pix:** continua manual no começo. Dá para automatizar depois pela mesma API (Pix de saída).

## 4. Conferência da maquininha

| Nível | Como funciona | Troca de máquina? |
|---|---|---|
| 0. Hoje | O Luan imprime o relatório e confere comanda por comanda | Não |
| 1. Conciliação por arquivo | Importa o relatório ou extrato da adquirente (CSV, ou o arquivo diário EDI da Cielo, por exemplo) e o sistema casa pelo valor, pela maquininha e pela hora. Mostra "cartão sem comanda" e "comanda sem cartão" | Não |
| 2. Maquininha integrada | O motoboy toca "Cobrar" no app, o valor aparece na maquininha dele, o cliente paga e a comanda fecha sozinha com a forma e o valor certos | Talvez |

**Maquininha integrada: opções encontradas**
- **Mercado Pago Point** (Smart 1 e 2, Pro 2), pela API de Orders: o sistema cria a cobrança, a maquininha mostra e o sistema recebe a notificação. A documentação não cita homologação. Tarifas do plano padrão: débito 1,99% e crédito 4,98% (o Point Tap é mais barato). Comparar com as tarifas atuais da Mel.
- **Stone Connect 2.0:** pelo programa de parceiros da Stone.
- **PagBank SmartPOS:** exige parceria comercial, app em Java ou Kotlin e homologação de cerca de 7 dias úteis.

O nível 2 resolve de vez o "trocou a forma na porta e ninguém anotou". **Recomendação:** nível 1 primeiro, porque funciona com as máquinas de hoje. O nível 2 só se a troca de adquirente compensar nas tarifas.

## 5. Nota fiscal: não dá para ignorar num PDV

- **Obrigação:** a NFC-e é obrigatória no varejo em quase todo o país. Em MT, por exemplo, vale desde 2019 para quem fatura mais de R$ 120 mil por ano. A Mel fica em Aragarças (GO), então quem manda é a SEFAZ-GO; confirmar com o contador. Com cerca de R$ 100 mil por mês, ela está obrigada.
- **Duas saídas:**
  - o PDV emite a NFC-e por uma API;
  - o PDV cuida só da operação e a nota continua no sistema que a Mel usa hoje.
- **Por API:** precisa de certificado A1, credenciamento na SEFAZ-GO e CSC. Exemplo: Focus NFe, plano Retail, R$ 62,90 por mês com 500 NFC-e e R$ 0,055 por nota a mais. São cerca de **R$ 145 por mês** para 2.000 notas.
- **Reforma tributária:** os campos novos (IBS e CBS) passam a ser obrigatórios para o Simples Nacional em 2027. Mais um motivo para usar uma API pronta em vez de fazer na mão.

## 6. Custos mensais estimados

| Item | Custo por mês |
|---|---|
| Tela de pedido (porta A) e link (porta B) | Só a hospedagem que já existe (Supabase e Vercel) |
| "Colar mensagem" com IA (opcional) | Centavos por noite |
| Pix automático | 0,9% a 1,2% por Pix antecipado (R$ 160 a cada 10 Pix por noite, no Inter) |
| Maquininha, nível 1 | R$ 0 |
| Maquininha, nível 2 | Depende das tarifas da adquirente |
| NFC-e por API (se o PDV emitir) | Cerca de R$ 145 |
| WhatsApp API com caixa compartilhada (opcional) | Cerca de R$ 420, mais a plataforma |
| Leitura por foto (porta C) | R$ 11 a 185, conforme o modelo |

## 7. Ordem sugerida

1. Terminar a v1: acerto, nuvem e painel do Luan.
2. **Fase 2a, porta A:** tela de pedido do atendente, comanda impressa com código e QR, e a trava "fulano está atendendo".
3. **Fase 2b, Pix por cobrança com webhook:** coluna PIX automática.
4. **Conciliação da maquininha por arquivo** (nível 1).
5. **Fase 2c, porta B:** link do cardápio na saudação.
6. Cozinha (fase 3).
7. **NFC-e:** decidir com a dona e o contador antes de o PDV substituir o sistema atual.
8. WhatsApp API e IA lendo mensagens: só se o volume justificar.

## 8. Perguntas para o Luan e a dona

1. Por que o Saipos foi abandonado, exatamente: os clientes não usaram o link, a equipe não conseguiu digitar a tempo, ou as duas coisas? A resposta muda o tamanho da porta A.
2. Quem anota os pedidos hoje digitaria? Tem computador ou tablet no balcão? E impressora térmica?
3. Quantos Pix antecipados por noite, em média? Quantos clientes mandam áudio?
4. Qual o banco PJ da empresa? Ele oferece API Pix?
5. Qual a marca da maquininha e quais as tarifas hoje?
6. A Mel emite NFC-e hoje? Por qual sistema? É do Simples Nacional?

## Fontes

- [Abrasel: WhatsApp representa 26% do faturamento com delivery](https://mercadoeconsumo.com.br/16/03/2025/foodservice/whatsapp-representa-26-do-faturamento-com-delivery-em-bares-e-restaurantes/)
- [PYMNTS: 42% dos clientes ainda pedem por telefone](https://www.pymnts.com/restaurant-innovation/2022/despite-digital-advances-42-percent-diners-continue-call-orders/)
- [NRN: centrais telefônicas de redes de pizza](https://www.nrn.com/restaurant-segments/operators-call-centers-still-relevant-despite-online-ordering-advances)
- [Pizza Today: crescer o pedido online exige planejamento](https://pizzatoday.com/?p=132024)
- [225 Baton Rouge: clientes que continuam ligando](https://www.225batonrouge.com/food-drink/restaurants-invested-online-ordering-platforms-customers-still-calling)
- [Anota AI: Pizzaria do Maestro (fornecedor)](https://anota.ai/blog/automacao-para-pizzarias/) · [Galeria da Pizza (fornecedor)](https://anota.ai/blog/atendente-de-delivery/) · [Anota AI ou Saipos (fornecedor)](https://anota.ai/blog/anota-ai-ou-saipos/)
- [Brendi: IA para pizzaria (fornecedor)](https://brendi.com.br/blog/ia-para-pizzaria-delivery-2026/)
- [Meta: preços da WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) · [Tarifa por país a partir de 01/10/2026](https://chatmaxima.com/blog/?p=3623)
- [WhatsApp: app ou API para equipes](https://www.dragapp.com/pt-br/blog/whatsapp-para-atendimento-ao-cliente/) · [Coexistência app e API](https://chakrahq.com/pt/article/whatsapp-business-app-api-coexistence-2026) · [Limite de aparelhos do app](https://m.aisensy.com/blog/whatsapp-business-more-than-4-devices/)
- [TecnoSpeed: como saber se a cobrança Pix foi paga](https://blog.tecnospeed.com.br/?p=22460) · [Omie: Pix empresarial e conciliação](https://www.omie.com.br/blog/pix-empresarial-automatize-cobrancas-e-conciliacao/index.md)
- [Jota: tarifas de Pix PJ em 2026 (fornecedor)](https://jota.ai/blog/arquivo/cobranca-transferencia-pix/) · [Efí: custo do Pix para empresas (fornecedor)](https://sejaefi.com.br/blog/qual-custo-do-pix)
- [Pix grátis ou mais barato na maquininha](https://www.calculadoradetaxas.com.br/public/maquininha-por-perfil/menor-taxa-pix) · [Tarifas Mercado Pago](https://calculadoradetaxas.com.br/mercado-pago/)
- [Pizzaria recebe Pix falso](https://tribunadejundiai.com.br/mais/brasil/pizzaria-recebe-pix-falso-e-entrega-refrigerante-e-pizza-falsos/)
- [Mercado Pago Point: integração com PDV](https://www.mercadopago.com.br/developers/pt/docs/mp-point-legacy/overview) · [Stone: conectar seu software](https://conteudo.stone.com.br/como-conectar-seu-software-na-stone/) · [PagBank SmartPOS: requisitos](https://developer.pagbank.com.br/docs/faq-smartpos) · [Cielo: extrato eletrônico](https://developercielo.github.io/tutorial/edi-extrato-eletronico)
- [NFC-e em MT (exemplo de regra estadual)](https://saipos.com/fiscal/nf/nfce/mt) · [Focus NFe: preços](https://focusnfe.com.br/precos/) · [Reforma tributária: prazos NF-e e NFC-e](https://www.contabeis.com.br/noticias/73139/nf-e-e-nfc-e-prazos-da-reforma-tributaria/)
