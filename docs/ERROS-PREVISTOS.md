# Erros previstos

O que pode dar errado numa noite e quem resolve. **Sistema** quer dizer que o sistema impede, avisa ou corrige, e cada linha assim vira teste. **Equipe** quer dizer que se resolve na conversa, no boca a boca, sem tela nova (PROJETO, princípio 8). A regra para escolher: se o erro mexe em dinheiro, em dado de cliente ou trava a noite, é do sistema; se não, é da equipe.

## Erros do cliente

| Situação | Quem | Como |
|---|---|---|
| Escolheu cartão e pagou em dinheiro (ou o contrário) | Sistema + equipe | O motoboy anota a forma real na comanda. No acerto, o Luan confere a forma de cada comanda e toca "Trocou a forma". Se ninguém registrar, o dinheiro não bate e a dica de diferença aponta a comanda (F1, T20) |
| Trocou cartão por Pix na maquininha (ou débito por crédito) | Equipe | Não muda o dinheiro do motoboy: os dois entram na "maquininha esperada". Corrigir só se o Luan quiser o relatório exato |
| Pagou parte em dinheiro e parte no cartão | Sistema | "Trocou a forma" com divisão; a soma tem que dar o total (PAG2, T9) |
| Precisa de troco | Equipe | O troco ("TROCO PARA 100") sai na comanda, e o motoboy leva do caixa de R$ 80 |
| Diz que pagou o Pix antecipado, mas não caiu | Sistema + equipe | A comanda sai "PIX: CONFERIR"; o Luan confere antes de entregar a comanda. Se não caiu, o motoboy cobra na porta e o Luan troca a forma (PAG5) |
| Pix antecipado de valor menor que o total | Sistema | "Trocou a forma": Pix pelo valor que caiu + o resto na porta |
| Pagou duas vezes (Pix e na porta) | Equipe | A gerente devolve, como hoje (crédito e cobrança em dobro fora do sistema por enquanto). A coluna PIX diminui o caso |
| Não atende, endereço errado ou não quer mais | Sistema | "Voltou": a taxa conta e os valores não (ENT5). Depois, "Saiu de novo" ou cancelar com motivo |
| Cancela depois de autorizar | Sistema + equipe | Cancelar com motivo; a cozinha é avisada à mão. Com Pix antecipado, fica marcado para a gerente (pergunta 12) |
| Muda o pedido depois de autorizar | Sistema + equipe | Alterar antes de sair: total recalculado e comanda reimpressa com "ALTERADO"; a cozinha é avisada à mão (F2) |
| Pede duas vezes na mesma noite, ou dois clientes com o mesmo final | Sistema | Código repetido pede um segundo toque (PED1); o telefone completo separa os clientes |
| Não manda a localização | Sistema + equipe | Comanda com "SEM LOCALIZAÇÃO" e pedido marcado na lista. Quando chega, o atendente cola no pedido e manda ao motoboy pelo grupo |
| Some no meio da conversa | Sistema | O pedido fica em rascunho e não imprime. No fechamento, a lista de pendentes mostra os rascunhos |
| Reclama do preço | Equipe | O resumo enviado pelo WhatsApp e aceito pelo cliente é a referência |

## Erros da equipe

| Situação | Quem | Como |
|---|---|---|
| Atendente digita sabor ou tamanho errado | Equipe + sistema | O cliente confere o resumo antes de autorizar. Depois, alterar antes de sair |
| Atendente escolhe a área errada | Sistema | Área sugerida pelo local do cliente. Antes de sair, alterar o pedido. Depois da entrega: pergunta 18 |
| Atendente esquece de autorizar | Sistema | A lateral mostra "aguardando cliente há 8 min" |
| Dois atendentes no mesmo cliente | Sistema | Trava de atendimento com "Assumir" (F2) |
| Ninguém abriu a noite | Sistema | O primeiro pedido abre a noite com os padrões (F1) |
| Promoção da noite não definida | Sistema | Aviso na tela de pedido (F2) |
| Item acabou e foi vendido | Equipe + sistema | "Acabou hoje" impede os próximos; o atendente fala com o cliente |
| Gerente digita preço errado | Sistema | A mudança fica em `eventos`; pedido antigo não muda; corrigir o preço vale para os próximos |
| Luan despacha para o motoboy errado | Sistema | "Desfazer" por 5 s; depois, cancelar a saída com motivo e despachar de novo |
| Luan esquece de despachar no sistema | Sistema | O fechamento lista "pedido autorizado sem saída"; a comanda devolvida sem saída também aparece no acerto |
| Luan marca "caiu" no Pix errado | Sistema | Desfazer com motivo (OPE3) |
| Luan digita o dinheiro contado errado | Sistema | A falta ou a sobra aparece antes de confirmar, com dois toques. Depois de confirmado, só o admin reabre, com motivo |
| Motoboy perde a comanda | Sistema | "Papel conferido" mostra a que falta, com os dados; o acerto não trava (ACE8) |
| Motoboy volta com dinheiro a mais ou a menos | Sistema | Sobra fica retida e falta é descontada (ACE5, ACE6), com a dica de diferença |
| Comanda ilegível, rasgada ou perdida antes de sair | Sistema | Reimprimir com um toque |
| Ordem de chegada dos motoboys errada | Sistema | Editável até o primeiro acerto |
| Noite de ontem ficou aberta | Sistema | Ao abrir a noite nova, aviso com os pendentes da anterior |

## Erros críticos (integridade)

| Situação | Quem | Como |
|---|---|---|
| Internet cai | Sistema | A fila guarda tudo no aparelho e mostra "N alterações esperando internet"; a impressão segue pelo agente na rede local |
| Supabase fora do ar | Sistema + equipe | Igual à internet caída. Confirmar acerto exige o servidor: se não voltar, o acerto da noite é no papel e confirmado depois |
| Energia cai | Equipe + sistema | Nobreak no roteador, no computador e na impressora. Se durar, papel; depois, "Lançar comanda de papel" para o acerto |
| Impressora sem papel, desligada ou travada | Sistema | Batimento do agente: "Impressora sem resposta"; reimprimir quando voltar ou imprimir pelo navegador |
| Computador do balcão quebra | Equipe + sistema | O app abre em qualquer navegador ou celular; comanda à mão até reinstalar o agente |
| Relógio ou fuso do aparelho errado | Sistema | Vale a hora do servidor e o fuso da pizzaria |
| Botão apertado duas vezes ou internet instável | Sistema | Cada operação tem um id e é aplicada uma vez só (idempotência) |
| Duas pessoas mexendo no mesmo caixa ou pedido | Sistema | Versão esperada: "Fulano mudou; confira e tente de novo" |
| Operação recusada várias vezes | Sistema | Nunca some: fica em "presas", com os dados, aviso ao admin e botão para reenviar |
| App antigo num aparelho | Sistema | Versão mínima: envia a fila e pede para atualizar |
| Uma funcionalidade com bug no meio da noite | Sistema + equipe | Interruptor em `config` desliga sem deploy (PADROES, Módulos removíveis); a noite segue no papel naquela parte |
| Deploy quebrado | Sistema | Deploy só fora do turno (OPE4); o Cloudflare volta à versão anterior com um clique |
| Alguém tenta apagar ou mudar valor de dinheiro | Sistema | Bloqueado no banco; correção só por ajuste com motivo, quem e quando (OPE3) |
| Acerto confirmado com erro | Sistema | Admin reabre com motivo; falta descoberta depois é devolvida ao motoboy (ACE5) |
| Perda de dados | Sistema | Backup diário do Supabase Pro e `pg_dump` semanal fora dele, com restauração testada |
| Senha vazada ou acesso indevido | Sistema | MFA para admin e gerente, RLS em tudo, contas só pelo admin e desativação na hora |
| Vazamento de dado de cliente | Sistema | Logs sem telefone nem endereço, repositório privado, acesso por papel |

## Como usar

- Cada linha com **Sistema** vira pelo menos um teste (domínio, banco ou ponta a ponta) antes de a etapa fechar.
- Erro novo visto numa noite real entra aqui primeiro, com "Quem" decidido pelo Felipe, e só depois vira código.
