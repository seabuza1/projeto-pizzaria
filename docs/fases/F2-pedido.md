# Fase 2: pedido digitado e comanda impressa

Parte do MVP. As regras estão em `docs/PROJETO.md`, a arquitetura em `docs/ARQUITETURA.md`, os erros previstos em `docs/ERROS-PREVISTOS.md` e a pesquisa que embasa esta fase em `docs/referencia/pesquisa-pedidos-pagamentos.md`.

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

O pedido nasce digitado pelo atendente, durante a conversa no WhatsApp, em vez de escrito à mão. A comanda sai impressa com tudo o que a cozinha e o motoboy precisam. O despacho e o acerto ficam no painel do Luan (F1).

Hoje, anotar um pedido leva de 3 a 5 minutos (Luan). Meta: o tempo do atendente cair. Medir antes e depois, em 10 pedidos de cada jeito.

## O que se aprendeu com outros (resumo da pesquisa)

- Quem deu certo não tirou o atendimento humano. O atendente digita no sistema enquanto conversa, e o link fica como opção (fase 6).
- A tela do atendente tem que ser feita para conversa. Uma rede de pizza tentou usar a tela de pedido online para digitar pedidos de telefone e desistiu.
- O pedido de qualquer canal cai numa fila só.

## Partes

### 2a. Cardápio e clientes
- **Cardápio:** tabelas `cardapio_*`, semeadas a partir de `docs/dados/cardapio-mel.json`.
  - Pizza: faixa (`tradicional`, `especial`, `premium`, `doce`, `doce_especial`) × tamanho (B, P, M, G).
  - Bordas, adicionais (R$ 10 cada), bebidas e combos com preço fixo.
  - Apelidos (como "filé" e "4 queijos") para a busca.
- **Edição pela gerente** (`/gerente/cardapio`, gerente e admin): preços e itens. Toda mudança de preço grava em `eventos` (quem, quando, de quanto para quanto). Pedido antigo não muda (fotografia em `pedido_itens`).
- **"Acabou hoje":** gerente, expedição ou atendente desligam um item só nesta noite. Na noite seguinte ele volta sozinho.
- **Clientes:** telefone completo (com DDD), nome e o **último local** (pino ou link do Maps, endereço escrito, referência e área). Um local só por cliente: o pedido guarda o endereço usado, e "Repetir" um pedido antigo traz o endereço dele.
  - Ao digitar o telefone, aparecem o nome, o último local e os últimos 5 pedidos.
- **Importação:** clientes entram aos poucos, conforme pedem. Não há base antiga para importar.
- **Cardápio validado:** o JSON é conferido por um schema Zod (`CardapioSchema`, em `packages/db`) num teste do domínio. O hook de testes roda esse teste quando `docs/dados/` muda, e o seed não roda com um cardápio inválido.

### 2b. Tela de pedido do atendente (`/atendimento`)

**Quem usa:** o computador do balcão fica com a conta do atendimento (papel `atendente`). O Luan e a gerente usam a própria conta. Sem troca de usuário por PIN (Felipe, 30/10).

**Layout:**
- **Tela larga:** pensada para computador ou tablet, ao lado do WhatsApp Web.
- **Celular:** funciona numa coluna só.
- **Lateral:** os pedidos abertos, com o tempo parado ("aguardando cliente há 8 min").

**Fluxo:**
1. **Telefone primeiro.** O código são os 4 últimos dígitos.
   - Se outro aparelho já está atendendo esse telefone: "Atendendo 3557 em outro aparelho há 2 min", com a opção "Assumir".
   - A trava fica em `pedidos.atendendo_por` e `atendendo_aparelho`, e é liberada ao autorizar, cancelar ou depois de 10 min parado.
   - Código repetido na noite: aviso e segundo toque (PED1).
2. **"Repetir"** um pedido anterior com um toque, e editar.
3. **Itens.**
   - Busca de sabor com 2 ou 3 letras, que acha nome e apelido. Item com "acabou hoje" aparece riscado e não entra.
   - Tamanho em chips. Meio a meio é tocar no segundo sabor.
   - Borda, adicional, bebida e combo.
   - **Palavra ambígua:** "frango" ou "lombo" mostram as opções; a lista vem de `ambiguidades` no JSON.
4. **Entrega ou retirada.**
   - Área sugerida pelo local do cliente, com a taxa somada sozinha.
   - Sem local: "Pedir localização", e o pedido segue com a localização marcada como pendente.
5. **Pagamento.**
   - Forma prevista, inclusive mista, e troco ("troco para 100").
   - Pix antecipado: o pedido fica "PIX: CONFERIR" até o Luan marcar "caiu" (PAG5).
6. **Total.** Calculado pelo domínio, com a promoção da noite aplicada e mostrada.
7. **"Mandar resumo".** Abre a conversa do cliente no WhatsApp com o texto pronto, e o atendente só aperta Enter. Exemplo:
   > Pedido 3557: G ½ Filé Mignon ½ Calabresa + Refrigerante 2L · entrega em Aragarças (hospital) · total R$ 113,00 · cartão na entrega. Posso mandar para a produção?
8. **"Autorizado".** O pedido vai para a produção, e a comanda é impressa.

**Rascunhos:** um pedido pode ficar parado em "aguardando cliente" e ser retomado. A gerente atende o caixa e o WhatsApp ao mesmo tempo e é interrompida o tempo todo.

**Alterar depois de autorizado:** enquanto o pedido não saiu, o atendente pode trocar itens, área ou pagamento. O total é recalculado, e a comanda é reimpressa com "ALTERADO" no topo; a cozinha é avisada à mão. Depois que saiu, só pelo Luan ("Trocou a forma") ou por cancelamento.

**Cancelar:** com motivo, a qualquer momento antes do acerto. Pedido com Pix antecipado cancelado fica marcado para a gerente resolver (pergunta 12).

**Estados do pedido:** rascunho → aguardando cliente → em produção → saiu (uma ou mais saídas) ou retirado · cancelado. Não há estado "pronto": a cozinha não marca nada nesta fase, e o Luan despacha quando a pizza sai.

### 2c. Comanda impressa
- O agente de impressão entra nesta fase (ver ARQUITETURA, Impressão).
- **Conteúdo, em 80 mm:**
  - código grande e asterisco se tiver promoção;
  - "ALTERADO" quando for reimpressão de pedido alterado;
  - itens;
  - entrega ou retirada, área, endereço e referência;
  - **QR do Maps** quando houver pino ou link; sem local, "SEM LOCALIZAÇÃO" em destaque;
  - total, forma prevista e troco ("TROCO PARA 100");
  - **Pix antecipado:** "PIX PAGO" se já caiu na hora da impressão; senão "PIX: CONFERIR" (Felipe, 30/10);
  - hora.
- A mesma comanda vai à cozinha levada à mão, sai com o motoboy e volta com ele. A impressão automática na cozinha é a fase 3.
- **Reimprimir** com um toque, para comanda perdida.

### 2d. Localização
- **Pendente:** a comanda sai com "SEM LOCALIZAÇÃO" e o pedido fica marcado na lista. Quando o cliente manda, o atendente cola o link no pedido (salva no cliente) e manda ao motoboy pelo grupo de entregas, como hoje.
- **Endereço escrito:** quem achar o pino no Maps salva no cliente, e o próximo pedido já vem com ele.

### 2e. Retiradas
- Pedido do tipo retirada, sem taxa.
- **"Avisar":** abre a conversa com a mensagem pronta ("Seu pedido 3557 está pronto para retirada").
- Ao retirar, marcar como retirado e registrar o pagamento do balcão.
- Detalhes dependem da pergunta 4.

### 2g. Promoção da noite
- Ao abrir a noite, a gerente ou a expedição define o desconto (de R$ 3 a R$ 23), ou "sem promoção".
- Sem promoção definida, a tela de pedido mostra o aviso "Promoção da noite não definida".
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

- `clientes` (telefone, nome e o último local).
- `cardapio_faixas`, `cardapio_sabores`, `cardapio_bordas`, `cardapio_adicionais`, `cardapio_bebidas`, `cardapio_combos` e `cardapio_acabou` (item e noite).
- `pedido_itens`, com uma fotografia do momento da venda: nome, faixa cobrada, preço unitário e desconto. Mudar o cardápio não altera pedidos nem relatórios antigos (o mesmo princípio da taxa, ENT2).
- `pedidos`: estados novos, endereço usado, local pendente e a trava de atendimento.
- **Acesso:**
  - atendente: cria e edita pedidos e clientes, e marca "acabou hoje";
  - expedição: tudo do atendente, mais despacho e acerto;
  - gerente e admin: tudo, mais preços do cardápio.

## Ordem de construção

Ver MVP, etapas 6 a 8.

## Pronto quando

- P1 a P11 passam, e os testes da fase 1 continuam passando.
- Dois aparelhos não pegam o mesmo telefone sem aviso.
- Um pedido autorizado imprime em até 5 s, inclusive sem internet (pelo agente na rede local).
- Um pedido alterado reimprime com "ALTERADO", e o total novo vale para o acerto.
- O tempo de atendimento medido é menor que o do papel.
