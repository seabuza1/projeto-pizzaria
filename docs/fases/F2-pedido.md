# Fase 2: pedido digitado, clientes, comanda impressa e despacho

Parte da fase 1 pronta e em uso. As regras estão em `docs/PROJETO.md`, a arquitetura em `docs/ARQUITETURA.md` e a pesquisa que embasa esta fase em `docs/referencia/pesquisa-pedidos-pagamentos.md`.

## Antes de construir

Responder com o Luan e a gerente (perguntas 1 a 6 de `PROJETO.md`):
- quais necessidades da Mel o Saipos não atendeu: cada uma vira requisito desta fase;
- o modelo e a conexão da impressora do balcão (já se sabe que há computador e impressora);
- como é a autorização da produção;
- como funcionam as retiradas;
- quem anota o quê;
- quais outras áreas têm taxa própria.

As respostas podem mudar telas desta spec. Atualize a spec antes do código.

## Objetivo

O pedido nasce digitado pelo atendente, durante a conversa no WhatsApp, em vez de escrito à mão. A comanda sai impressa com o código grande. O despacho passa para o sistema: o motoboy pega a entrega com um toque e abre a localização no app, o que substitui o grupo de entregas e a folha.

Hoje, anotar um pedido leva de 3 a 5 minutos (Luan). Meta: o tempo do atendente cair. Medir antes e depois, em 10 pedidos de cada jeito.

## O que se aprendeu com outros (resumo da pesquisa)

- Quem deu certo não tirou o atendimento humano. O atendente digita no sistema enquanto conversa, e o link fica como opção (fase 6).
- A tela do atendente tem que ser feita para conversa. Uma rede de pizza tentou usar a tela de pedido online para digitar pedidos de telefone e desistiu.
- O pedido de qualquer canal cai numa fila só, para a cozinha e a expedição.

## Partes

### 2a. Cardápio e clientes
- **Cardápio:** tabelas `cardapio_*`, semeadas a partir de `docs/dados/cardapio-mel.json`. A gerente edita preços e liga ou desliga itens.
  - Pizza: faixa (`tradicional`, `especial`, `premium`, `doce`, `doce_especial`) × tamanho (B, P, M, G).
  - Bordas, adicionais (R$ 10 cada), bebidas e combos com preço fixo.
  - Apelidos (como "filé" e "4 queijos") para a busca.
- **Clientes:** telefone completo (com DDD) e nome.
  - Locais: pino (latitude e longitude), link do Maps, endereço escrito, referência e área.
  - Ao digitar o telefone, aparecem o nome, o último local e os últimos 5 pedidos.
- **Importação:** clientes entram aos poucos, conforme pedem. Não há base antiga para importar.

### 2b. Tela de pedido do atendente (`/atendimento`)

**Layout:**
- **Tela larga:** pensada para computador ou tablet, ao lado do WhatsApp Web.
- **Celular:** funciona numa coluna só.
- **Lateral:** os pedidos abertos.

**Fluxo:**
1. **Telefone primeiro.** O código são os 4 últimos dígitos.
   - Se outra pessoa já está atendendo esse telefone: "Ana está atendendo 3557 há 2 min", com a opção "Assumir".
   - A trava fica em `pedidos.atendendo_por` e é liberada ao confirmar, cancelar ou depois de 10 min parado.
2. **"Repetir"** um pedido anterior com um toque, e editar.
3. **Itens.**
   - Busca de sabor com 2 ou 3 letras, que acha nome e apelido.
   - Tamanho em chips. Meio a meio é tocar no segundo sabor.
   - Borda, adicional, bebida e combo.
   - **Palavra ambígua:** "frango" ou "lombo" mostram as opções; a lista vem de `ambiguidades` no JSON.
4. **Entrega ou retirada.**
   - Área sugerida pelo local do cliente, com a taxa somada sozinha.
   - Sem local: "Pedir localização" e o pedido segue, com a localização marcada como pendente.
5. **Pagamento.**
   - Forma prevista, inclusive mista, e troco ("troco para 100").
   - Se o cliente tem crédito, aparece "Usar crédito de R$ X".
6. **Total.** Calculado pelo domínio, com a promoção da noite aplicada e mostrada.
7. **"Mandar resumo".** Abre a conversa do cliente no WhatsApp com o texto pronto e o atendente só aperta Enter. Exemplo:
   > Pedido 3557: G ½ Filé Mignon ½ Calabresa + Refrigerante 2L · entrega em Aragarças (hospital) · total R$ 113,00 · cartão na entrega. Posso mandar para a produção?
8. **"Autorizado".** O pedido vai para a produção, e a comanda é impressa.

**Rascunhos:** um pedido pode ficar parado em "aguardando cliente" e ser retomado. A gerente atende o caixa e o WhatsApp ao mesmo tempo e é interrompida o tempo todo.

**Estados do pedido:** rascunho → aguardando autorização → em produção → pronto → (entrega: saída) ou (retirada: retirado) · cancelado.

### 2c. Comanda impressa
- O agente de impressão entra nesta fase (ver ARQUITETURA, Impressão).
- **Conteúdo, em 80 mm:**
  - código grande e asterisco se tiver promoção;
  - itens;
  - entrega ou retirada, área e referência;
  - total e pagamento;
  - hora;
  - QR com o id do pedido.
- A comanda ainda vai à mão até a cozinha. A impressão automática na cozinha é a fase 3.
- **Reimprimir** com um toque, para comanda perdida.

### 2d. Despacho no sistema
- **Fila de prontos para entrega** na expedição, por ordem de balcão.
- **O motoboy pega a entrega** no app, antes de sair (substitui o 👍 no grupo e a anotação na folha).
  - Pode pegar mais de uma; em média são 2 e no máximo 5.
  - O Luan pode **separar** um pedido para quem avisou o retorno.
- **Na saída**, o app do motoboy mostra:
  - o pedido, o total e a forma;
  - o status do Pix;
  - os botões "Abrir no Maps" (pino ou link), "Ligar" e "WhatsApp do cliente".
- **Localização pendente:** fica marcada e o Luan é avisado. Quando chega, ela é salva no cliente.
- **Endereço escrito:** quem achar o pino no Maps salva no cliente, e o próximo pedido já vem com ele.
- A porta e o acerto continuam como na fase 1. A diferença é que nada mais é digitado pelo motoboy além da forma real.
- Durante a transição, o grupo de WhatsApp continua como reserva.

### 2e. Retiradas
- Lista de retiradas com o estado ("em produção", "pronto").
- **"Avisar":** abre a conversa com a mensagem pronta ("Seu pedido 3557 está pronto para retirada").
- Ao retirar, marcar como retirado e registrar o pagamento do balcão.

### 2f. Promoção da noite
- Ao abrir a noite, a gerente ou a expedição define o desconto (de R$ 3 a R$ 23), ou "sem promoção".
- O domínio aplica a promoção conforme PED4.

## Cálculo do pedido: `packages/dominio/src/preco.ts`

```
precoPizza(tamanho, sabores) = max(preço da faixa de cada sabor no tamanho)      // PED3
faixaCobrada                 = a faixa do sabor que deu o preço
descontoPromo                = promo_desconto da noite, se pedido.promocao e faixaCobrada = tradicional  // PED4, provisório
itens                        = Σ (pizza − descontoPromo + bordas + adicionais) + bebidas + combos + outros
total                        = itens + taxa da área (0 na retirada)                                       // PED2
```

**Casos de teste** (R$, cardápio real; taxas Aragarças 5, Pontal 10, Barra 12 e Parque 15):

| Teste | Pedido | Total |
|---|---|---|
| P1 | G Calabresa + Refrigerante 2L, Aragarças | 93 |
| P2 | G ½ Filé Mignon ½ Calabresa + Refrigerante 2L, Aragarças (a 3557 real) | 113 |
| P3 | Promoção 10. G Portuguesa, com promoção, Aragarças | 68 |
| P4 | Promoção 10. A 3557 com promoção: faixa cobrada premium, sem desconto | 113 |
| P5 | M Quatro Queijos + borda Cheddar, Pontal | 94 |
| P6 | Combo 01, Aragarças | 154,99 |
| P7 | G Calabresa + adicional Bacon, Barra | 95 |
| P8 | G Frango c/ Catupiry, retirada | 73 |
| P9 | 2 Refrigerantes lata + P Marguerita, Parque de Exposições | 85 |
| P10 | Promoção 10. G ½ Calabresa ½ Portuguesa (duas tradicionais), Aragarças: regra provisória, um desconto | 68 |
| P11 | "frango" sem escolha do sabor | sem preço; o domínio devolve as 4 opções |

## Banco (migrações novas)

- `clientes` e `cliente_locais`.
- `cardapio_faixas`, `cardapio_sabores`, `cardapio_bordas`, `cardapio_adicionais`, `cardapio_bebidas` e `cardapio_combos`.
- `pedido_itens`, com o preço unitário gravado.
- `pedidos`: estados novos e a trava de atendimento.
- `impressoes`, `creditos` e `cobrancas_dobro`.
- **Acesso:**
  - atendente: cria e edita pedidos e clientes;
  - motoboy: vê o cliente só das próprias saídas da noite;
  - cozinha: vê itens, sem telefone nem endereço.

## Ordem de construção

1. `preco.ts` com P1 a P11 passando.
2. Migrações do cardápio e dos clientes, e seed a partir do JSON.
3. Tela de pedido: telefone, trava, itens, entrega, pagamento, total, resumo e autorização.
4. Agente de impressão e comanda impressa (testar com impressora de rede de verdade).
5. Despacho: fila de prontos, pegar entrega, separar e app do motoboy com Maps e WhatsApp.
6. Retiradas.
7. Crédito e cobrança em dobro (PAG8, PAG9).

Pare no fim de cada etapa e resuma em poucas linhas.

## Implantação

1. **Uma quarta-feira** (noite mais fraca): um atendente digita todos os pedidos e a comanda à mão continua em paralelo. No fim, comparar.
2. **Duas ou três noites** só com a comanda impressa; a escrita à mão vira reserva.
3. **Despacho pelo sistema**, com o grupo de WhatsApp ainda ativo como reserva por uma semana.
4. Medir o tempo por pedido e quantos pedidos tiveram erro de anotação.

## Pronto quando

- P1 a P11 passam, e os testes da fase 1 continuam passando.
- Dois atendentes não pegam o mesmo telefone sem aviso.
- Um pedido autorizado imprime em até 5 s, inclusive sem internet (pelo agente na rede local).
- O motoboy pega a entrega e abre a localização sem o grupo de WhatsApp.
- O tempo de atendimento medido é menor que o do papel.
