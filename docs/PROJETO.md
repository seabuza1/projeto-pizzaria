# PDV da Mel Pizzaria: visão, regras e fases

Atualizado em 30/10/2026. Reúne tudo o que foi levantado com o Felipe (motoboy da casa e desenvolvedor) e com o Luan. O levantamento original, com as falas de cada um, está em `referencia/levantamento.md`. Este arquivo é a fonte das regras: quando uma spec de fase citar uma regra, é daqui.

## 1. A pizzaria

- **Onde:** Mel Pizzaria, Av. Min. João Alberto, 2286, St. Bela Vista, Aragarças (GO). O endereço vem de uma listagem pública e combina com o @mel_pizzaria_go; falta o Felipe confirmar. Atende Aragarças (GO), Pontal do Araguaia (MT) e Barra do Garças (MT), além de algumas áreas com taxa própria.
- **Tamanho:** cerca de R$ 100 mil por mês e de 70 a 100 entregas por noite.
- **Quando:** de quarta a domingo. O atendimento começa às 19h; o turno dos motoboys vai das 18h à meia-noite.
- **Como pede hoje:** o cliente pede pelo WhatsApp, conversando com uma pessoa. O pedido é anotado à mão numa comanda de papel.
- **Tentativa anterior:** o Saipos foi implantado de uma vez e não pegou, por dois motivos:
  - os clientes, acostumados a pedir conversando, não se adaptaram ao pedido automático;
  - segundo o Felipe (30/10), o Saipos não atendeu às necessidades próprias da empresa. Falta saber quais (pergunta 1).
- **Maior gargalo hoje:** a expedição das entregas e o acerto dos motoboys.

## 2. Princípios (valem para todas as fases)

1. **Aos poucos.** Cada fase substitui um papel só e roda algumas noites junto com o papel antes de o papel sair.
2. **Papel como plano B.** Se o sistema ou a internet caírem, a noite continua no papel e é lançada depois.
3. **O cliente escolhe como pedir.** Conversa no WhatsApp continua para sempre; o link é opção, nunca obrigação.
4. **Não aumentar o trabalho de quem está sobrecarregado.** O Luan e a dona acumulam funções. Se uma tela deixa o trabalho deles mais lento no meio do movimento, ela não pega.
5. **Mostrar de onde vem cada valor.** Falta no caixa é descontada do motoboy, então toda conta tem que ser conferível.
6. **Funcionar sem internet** no balcão, sincronizando quando a conexão voltar. A impressão segue pela rede local.
7. **Fuso fixo da pizzaria.** As três cidades usam o horário de Brasília (Felipe, 30/10). O sistema usa sempre esse fuso (`America/Sao_Paulo`), nunca o do aparelho: um celular em MT com fuso automático pode marcar o horário de Cuiabá, uma hora a menos.
8. **Enxuto** (Felipe, 30/10). Quanto mais funções, mais coisa para quebrar, mais complexo e mais caro. Só entra o que tira trabalho manual de alguém. Erro que mexe em dinheiro, em dado de cliente ou trava a noite é do sistema; erro bobo se resolve no boca a boca (`ERROS-PREVISTOS.md`).
9. **O motoboy não usa o sistema** (Felipe, 30/10). Ele recebe a comanda impressa e o recibo do acerto. Quem registra o despacho, o que voltou e a forma que mudou na porta é o Luan (decisão 0007).

## 3. Pessoas e papéis no sistema

| Pessoa | O que faz hoje | Papel no sistema |
|---|---|---|
| Felipe | Motoboy e desenvolvedor | `admin` (e cadastrado como motoboy) |
| Dona | Caixa; atende o WhatsApp no segundo celular; resolve cobrança em dobro; cuida do dinheiro depois do acerto | `gerente` |
| Luan | Celular dedicado ao WhatsApp; manda as localizações; confere o Pix antecipado; despacho e folha de expedição; separa retiradas; faz o acerto | `expedicao` (também atende) |
| Atendentes | Anotam pedidos no WhatsApp | `atendente` (o computador do balcão fica com esta conta) |
| Motoboys | 4 de quarta a sexta e 5 no sábado e domingo; cada um com celular e uma maquininha | Nenhum: não usam o sistema. Ficam no cadastro de motoboys (nome) para caixa, diária e taxas |
| Cozinha | Recebe a comanda levada à mão (equipe ainda não levantada) | Nenhum até a fase 3 |
| Garçons | Ainda não levantado | Nenhum até a fase 4 |
| Computador do balcão | Imprime | `agente` (conta técnica do agente de impressão) |

Há computador e impressora no balcão (Felipe, 30/10). Falta saber o modelo e a conexão da impressora. O Luan disse que o celular serve, mas que uma tela maior no balcão ajudaria a anotar vários pedidos ao mesmo tempo.

**Maquininha:** a "Laranjinha" do Itaú, operada pela Rede (Felipe, 30/10). O Pix feito nela é exclusivo para quem tem conta no Itaú, e as tarifas são negociadas.

## 4. Como funciona hoje (resumo)

- **Atendimento:** duas pessoas, dois celulares, no mesmo número. Uma começa um atendimento e a outra não sabe. Anotar um pedido leva de 3 a 5 minutos, boa parte esperando o cliente dizer a forma de pagamento, mandar a localização e autorizar a produção.
- **Comanda:** traz o código (4 últimos dígitos do telefone), o tamanho, os sabores, a bebida, o bairro e a referência, o total (já com a taxa) e a forma de pagamento. O asterisco marca a promoção da noite. A comanda vai à cozinha levada à mão, sai com o motoboy e volta com ele, com o comprovante da maquininha grampeado.
- **Folha de expedição:** uma coluna por motoboy com os códigos que ele levou e uma coluna PIX com os Pix antecipados. Um ponto ao lado do código indica localização não enviada; uma seta com valor indica troco devolvido por Pix. No rodapé, a data e o caixa de R$ 80.
- **Grupo de entregas no WhatsApp:** para cada entrega, a pizzaria manda a localização e depois o telefone do cliente. O motoboy pega a entrega respondendo à mensagem do telefone. Quem estiver voltando avisa ("volto em 5").
- **Despacho:** por ordem de balcão. São em média 2 pedidos por viagem, no máximo 5. Em noite cheia, o Luan separa pedidos para quem está voltando.
- **Pagamento:** dinheiro, cartão na maquininha, Pix na maquininha ou Pix antecipado. Pode ser misto. O cliente às vezes troca a forma na porta e isso não fica registrado. O Pix antecipado é conferido à mão; quando o aviso não chega, o motoboy cobra de novo e o cliente paga duas vezes.
- **Acerto:** o Luan soma tudo à mão, de 5 a 15 minutos por motoboy, mais com chuva, comanda perdida ou forma de pagamento que não bate. Perder comanda é frequente.

## 5. Glossário

- **noite:** um dia de operação. Uma noite aberta entre 00h e 06h pertence ao dia anterior.
- **pedido:** o que o cliente pediu. Identificado na noite pelo código.
- **código:** os 4 últimos dígitos do telefone do cliente.
- **saída:** uma ida do motoboy para entregar um pedido. Um pedido que volta e sai de novo tem duas saídas.
- **comanda:** o papel do pedido. Com o sistema, é impressa ao autorizar o pedido; à mão, só quando o sistema cair.
- **caixa do motoboy:** o caixa de um motoboy numa noite, incluindo o troco inicial de R$ 80 que ele leva.
- **acerto:** o fechamento do caixa do motoboy com o Luan no fim da noite.
- **liquidação:** como o Luan paga o motoboy. Primeiro sai do caixa inicial dele; o que passar sai do caixa da empresa e fica registrado.
- **diária:** R$ 30 por noite trabalhada.
- **taxa:** o valor da entrega por área. O motoboy recebe a mesma taxa que o cliente paga.
- **Pix antecipado:** pago antes da entrega. Não passa pela mão do motoboy.
- **troco por Pix:** o cliente paga em dinheiro a mais e a pizzaria devolve a diferença por Pix.
- **papel conferido:** a comanda de papel foi entregue ao Luan no acerto.
- **promoção da noite:** o desconto do dia, marcado na comanda com asterisco.

## 6. Regras de negócio

### Pedido (PED)
- **PED1 Código.** O pedido é identificado pela noite e pelo código. O código pode se repetir na noite (cliente que pede duas vezes, ou dois clientes com o mesmo final). O sistema avisa e pede um segundo toque.
- **PED2 Total.** Total = itens − promoção + taxa da entrega. O total registrado sempre inclui a taxa.
- **PED3 Meio a meio.** É cobrado pelo preço do sabor mais caro.
- **PED4 Promoção da noite.** Desconto em reais, de R$ 3 a R$ 23, que muda toda noite, nas pizzas cuja faixa cobrada é `tradicional`. Precisa ser definido a cada noite, e o pedido com promoção fica marcado (o asterisco). Exemplo: no meio a meio Filé Mignon / Calabresa a pizza é cobrada como premium, então não tem desconto.
  - **Provisório:** o desconto vale uma vez por pizza tradicional.
  - **Pendente:** confirmar se vale por pizza e se vale no meio a meio de duas tradicionais.
- **PED5 Origem e tipo.** Origem: papel, WhatsApp, balcão, mesa ou link. Tipo: entrega, retirada ou mesa. Retirada e mesa também são identificadas pelo telefone.
- **PED6 Autorização.** O pedido só vai para a cozinha depois que o cliente autoriza a produção. Pendente: como isso acontece hoje.
- **PED7 Canal livre.** O cliente escolhe se pede conversando ou pelo link. Nenhum canal é obrigatório.
- **PED8 Cardápio.** O preço da pizza depende da faixa do sabor e do tamanho. Bordas, adicionais, bebidas e combos têm preço fixo. Fonte inicial: `dados/cardapio-mel.json`; depois a gerente edita no sistema.

### Entrega e taxa (ENT)
- **ENT1 Taxa por área.** Cada cidade tem a taxa padrão: Aragarças R$ 5, Pontal do Araguaia R$ 10, Barra do Garças R$ 12. Algumas áreas têm taxa própria: perto do Parque de Exposições de Barra do Garças, R$ 15; outras zonas rurais e distritos ainda serão levantados. A tabela é editável.
- **ENT2 Taxa gravada.** A taxa fica gravada na saída. Mudar a tabela não altera saídas antigas.
- **ENT3 Taxa do motoboy.** O motoboy recebe a mesma taxa que o cliente paga.
- **ENT4 Taxa por saída.** Pedido que volta e sai de novo gera outra taxa. Cada saída tem o seu motoboy.
- **ENT5 Estados da saída.** A saída nasce quando o Luan despacha e conta como entregue, a não ser que ele marque "Voltou" (decisão 0007).
  - Saída que voltou: a taxa conta e os valores do pedido não.
  - Pedido cuja saída voltou termina reentregue (nova saída), retirado ou cancelado.
- **ENT6 Despacho.** Por ordem de balcão. O Luan registra no sistema quem levou cada pedido. Separar um pedido para quem está voltando e o aviso de retorno ("volto em 5") continuam fora do sistema, no balcão e no grupo de entregas.
- **ENT7 Localização.** Chega como pino do WhatsApp ou link do Google Maps, ou às vezes como endereço escrito. Fica guardada no cliente para o próximo pedido e sai na comanda como QR do Maps. Localização faltando é exceção: a comanda sai com "SEM LOCALIZAÇÃO", e a localização vai ao motoboy pelo grupo, como hoje.
- **ENT8 Privacidade.** O motoboy não acessa o sistema. Telefone e endereço do cliente vão para ele só na comanda das entregas dele.

### Pagamento (PAG)
- **PAG1 Formas.** Dinheiro, cartão, Pix na maquininha, Pix antecipado e crédito do cliente.
- **PAG2 Misto.** Um pedido pode ter vários pagamentos, em qualquer combinação. A soma é igual ao total.
- **PAG3 Previsto e real.** A forma anotada é a prevista e sai na comanda. Se o cliente paga de outro jeito, o motoboy anota a forma real na comanda, e o Luan registra "Trocou a forma" no acerto (ou antes, se o motoboy avisar). Sem a troca registrada, vale a prevista, e a diferença aparece no dinheiro contado.
- **PAG4 Troco por Pix.** Só existe em pagamento com parte em dinheiro. O valor fica com o motoboy e entra no dinheiro a devolver.
- **PAG5 Pix antecipado.** Só vale como pago depois de confirmado: à mão pelo Luan ("caiu"), automaticamente só se a integração Pix entrar. A comanda sai "PIX PAGO" se já caiu na hora da impressão; senão, "PIX: CONFERIR", e o Luan confere e avisa o motoboy ao entregar a comanda (Felipe, 30/10).
- **PAG6 Pix na hora.** É sempre feito na maquininha.
- **PAG7 Maquininha.** Cada motoboy tem a sua. Cada transação precisa casar com um pagamento de uma saída dele.
- **PAG8 Cobrança em dobro.** Quem resolve é a gerente. O cliente escolhe receber de volta por Pix ou como crédito. **Fora do sistema por enquanto** (Felipe, 30/10): a gerente resolve à mão, como hoje.
- **PAG9 Crédito.** Não tem validade. Fica ligado ao telefone completo e é usado como forma de pagamento. Como o Pix antecipado, não passa pela mão do motoboy. **Fora do sistema por enquanto** (Felipe, 30/10).

### Acerto (ACE)
- **ACE1 Caixa inicial.** R$ 80 por padrão, editável na noite. É devolvido no acerto.
- **ACE2 Diária.** R$ 30, igual para todos e cheia, independente da hora em que o motoboy chegou.
- **ACE3 Devolve tudo.** O motoboy devolve todo o dinheiro (caixa e vendas) e recebe diária e taxas à parte, em dinheiro, na mesma noite.
- **ACE4 Liquidação.** O Luan paga o motoboy primeiro com o caixa inicial dele. O que passar sai do caixa da empresa e fica registrado como retirada. Se o valor a receber for menor que o caixa, o resto do caixa vai para a empresa junto com as vendas.
- **ACE5 Falta.** É descontada do que o motoboy recebe na noite. Se passar desse valor, ele completa do bolso na hora. Se o erro aparecer depois, o valor é devolvido a ele.
- **ACE6 Sobra.** Fica retida, sem ir para o motoboy nem para o caixa, sem prazo, até a origem ser descoberta.
- **ACE7 Ordem.** O acerto segue a ordem de chegada dos motoboys no início da noite.
- **ACE8 Comanda perdida.** Não pode travar o acerto. Tudo o que o acerto precisa está no sistema, e "papel conferido" mostra quais comandas faltam.
- **ACE9 Confirmação.** Só a expedição, a gerente ou o admin confirmam o acerto. A confirmação grava os valores do momento, trava o caixa e as saídas e imprime o recibo, que o motoboy confere e assina. Reabrir é do admin, com motivo.
- **ACE10 Conta à mostra.** Toda tela de acerto mostra de onde vem cada número.

### Operação (OPE)
- **OPE1 Interruptor.** Cada funcionalidade pode ser desligada em `config`, sem deploy, para a noite seguir no papel naquela parte. Rodar junto com o papel nas primeiras noites é combinado na implantação, sem trava por pessoa.
- **OPE2 Registro de mudanças.** Toda mudança em pagamento, saída e acerto guarda quem fez e quando.
- **OPE3 Dinheiro só se acrescenta.** Nenhum valor de pagamento, acerto, sobra ou falta é apagado ou sobrescrito. Uma correção é um lançamento de ajuste, com motivo, quem e quando.
- **OPE4 Implantação fora do turno.** Nada vai para produção entre 17h e 01h de quarta a domingo. De preferência, segunda e terça.

## 7. Fases

| Fase | O que entra | Papel que substitui | Spec |
|---|---|---|---|
| 1 (MVP) | Despacho e acerto no painel do Luan | Folha de colunas e soma manual | `fases/F1-acerto.md` |
| 2 (MVP) | Pedido digitado pelo atendente, clientes, cardápio e comanda impressa | Comanda escrita à mão | `fases/F2-pedido.md` |
| 3 | Impressão automática na cozinha (e tela da cozinha, opcional) | Comanda levada à mão até a cozinha | `fases/F3-a-F6.md` |
| 4 | Garçom pelo celular | Comanda de mesa | `fases/F3-a-F6.md` |
| 5 | Caixa geral: abertura, sangria, fechamento e nota fiscal | Fechamento manual | `fases/F3-a-F6.md` |
| 6 | Pedido pelo link (opcional para o cliente) | Nada: é um canal a mais | `fases/F3-a-F6.md` |
| Fora do plano | Estoque e custo por pizza (CMV) | Nada | A Mel já controla o estoque fora do sistema. Integrar isso é complexo demais por enquanto (Felipe, 30/10) |
| Integrações | Pix automático, conciliação da maquininha, NFC-e | Conferência manual | `fases/F3-a-F6.md` |

**Foco atual (Felipe, 30/10): atendimento e despacho de entregas.** As fases 3 a 6 ficam sem data e só começam quando o Felipe pedir.

**MVP** (`MVP.md`): as fases 1 e 2 enxutas, juntas, mais a base técnica e a impressão sem fio. O pedido nasce digitado, a comanda sai impressa, e o Luan despacha e faz o acerto no painel. O motoboy não usa o sistema. Depois do MVP vem a bancada de testes enxuta (`BANCADA-TESTES.md`).

**Como a noite funciona depois do sistema:** guia para a equipe, gerado a partir destas regras ("Como a Mel funciona com o sistema"). Mudou uma regra aqui, atualize o guia.

## 8. Perguntas em aberto

**Bloqueiam o MVP:**
1. Quais necessidades da Mel o Saipos não atendeu? Liste exemplos concretos: cada uma vira requisito ou teste. (Já se sabe que não atendeu às necessidades da empresa e que os clientes não se adaptaram ao pedido automático.)
2. Qual é o modelo da impressora do balcão e como ela se liga: USB ou rede? Ela imprime na cozinha também? (Já se sabe que há computador e impressora.)
3. O que é "autorizar a produção" e como acontece hoje?
4. Na retirada, o aviso ao cliente sai quando a pizza fica pronta? O texto é sempre o mesmo? Quantas retiradas há por noite?
5. Que ajustes o Luan quer na divisão de quem anota o quê?
6. Há outras áreas com taxa própria além do Parque de Exposições?

**Bloqueiam as integrações:**
7. A conta PJ da Mel é no Itaú? (A maquininha é a Laranjinha, do Itaú.)
8. Quais são as tarifas negociadas da Laranjinha (débito, crédito e Pix)? Há um relatório de vendas exportado do Portal Rede para usar de exemplo?
9. A Mel emite NFC-e hoje? Por qual sistema? É do Simples Nacional?
10. Quantos Pix antecipados por noite, em média?

**Para a gerente:**
11. Depois do acerto, para onde vai o dinheiro que o motoboy devolve? Como é o fechamento do caixa geral?
12. Pedido pago por Pix antecipado que volta e é cancelado: o valor é devolvido ou vira crédito?
13. Há desconto, cupom ou fidelidade? Quem decide a promoção da noite?
14. Quantas mesas, garçons e pessoas na cozinha? Como a conta da mesa é fechada?
15. Promoção: o desconto vale por pizza? Vale no meio a meio de duas tradicionais?
20. Meio a meio com preço empatado entre faixas (ex.: G ½ Calabresa, tradicional, ½ Brigadeiro, doce, as duas a R$ 73): a pizza conta como tradicional para a promoção? Por ora, o sistema usa a faixa do primeiro sabor (`preco.ts`).
16. ~~Como a comanda diferencia Pix já pago de Pix na hora?~~ Resolvida (30/10): a comanda impressa diz "PIX PAGO" ou "PIX: CONFERIR".

**Mais à frente:**
17. Quem mantém o sistema depois de pronto?

**Erros previstos:**
18. Área errada descoberta depois da entrega (o cliente pagou a taxa de Aragarças, mas era Barra): o motoboy recebe a taxa cobrada ou a da área certa? E o cliente?
19. Os motoboys concordam em anotar na comanda a forma real quando o cliente paga diferente?
