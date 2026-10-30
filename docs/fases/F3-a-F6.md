# Fases 3 a 6 e integrações

**Fora do foco atual.** Primeiro vêm o atendimento e o despacho (MVP). Estas fases ficam sem data. Antes de cada uma, aplicar o filtro de PADROES, Enxuto: que trabalho manual ela tira, de quem, e quem pediu. O motoboy continua sem usar o sistema (decisão 0007).

Nível de roteiro: há pouco levantado sobre cozinha, mesas e caixa geral. Antes de cada fase, levantar as perguntas abertas, escrever a spec completa (no formato de `F1-acerto.md`) e só então construir.

## Fase 3: cozinha

**Objetivo:** a comanda chega à cozinha sozinha.
- **Ao autorizar o pedido,** o sistema cria um trabalho de impressão para a impressora da cozinha. A via do balcão continua.
- **Via da cozinha:** sem telefone e sem endereço. Mostra código, itens e observações, com o meio a meio e a borda em destaque.
- **Opcional:** tela da cozinha (`/cozinha`), com a fila de pedidos e um toque para "pronto", que avisa a expedição.
- **Perguntas:** quantas pessoas na cozinha; se há forno e montagem separados; se querem tela ou só papel.

## Fase 4: garçom

**Objetivo:** pedido de mesa pelo celular do garçom.
- **Pedido de mesa:** mesa → itens → envia para a cozinha. O pedido da mesa é identificado pelo telefone, como hoje.
- **Vários garçons na mesma mesa:** os itens só se somam, e fechar a conta usa a versão esperada (ver ARQUITETURA, Conflitos e concorrência). Só existe uma conta aberta por mesa.
- **Conta da mesa** (opções a confirmar com a gerente antes de construir):
  - parcial a qualquer momento;
  - divisão por item (cada um paga o que consumiu) ou igual por pessoa;
  - fechamento no caixa, com as mesmas formas de pagamento das entregas.
- **Sem taxa de serviço:** a Mel não cobra os 10% (Felipe, 30/10).
- **Perguntas:** quantas mesas e garçons; como a conta é fechada hoje; se dividem a conta e de que jeito.

## Fase 5: caixa geral e nota fiscal

**Objetivo:** fechar o caixa da noite sem soma manual.
- **Caixa geral:** abertura, sangria, suprimento, entradas do acerto dos motoboys (`vaiParaEmpresa`) e retiradas para pagar motoboy (`retiradoCaixaEmpresa`). Fechamento por forma de pagamento.
- **NFC-e:**
  - **Obrigação:** a nota de consumidor é obrigatória para a Mel. Ela fica em Aragarças, então vale a SEFAZ-GO; confirmar com o contador.
  - **Duas saídas:** emitir pelo PDV por uma API (por exemplo, Focus NFe: uns R$ 145 por mês para 2.000 notas, com certificado A1, credenciamento e CSC), ou continuar no sistema fiscal atual.
  - **Reforma tributária:** os campos de IBS e CBS passam a ser obrigatórios para o Simples Nacional em 2027. Use uma API pronta, não XML feito à mão.
- **Perguntas:** como é o fechamento hoje; para onde vai o dinheiro depois do acerto; qual sistema emite nota hoje; regime tributário.

### Relatórios da gerente (junto com a fase 5)
- **Por dia e por período:**
  - vendas por forma de pagamento, por cidade e por canal (conversa, link, balcão, mesa);
  - ticket médio;
  - pedidos por hora.
- **Entregas:**
  - tempo de entrega, da saída até "entregue" (já vem das saídas da fase 1);
  - entregas e taxas por motoboy;
  - pedidos que voltaram.
- **Dinheiro:** faltas, sobras e ajustes, com o motivo de cada um.
- **Exportação mensal (CSV)** para o contador.

## Fase 6: pedido pelo link (porta B)

**Objetivo:** quem quiser pede sozinho; ninguém é obrigado.
- **`apps/cliente`:** página pública no domínio da Mel, leve e sem login.
  - O cliente informa o telefone e recebe um código por WhatsApp ou SMS (a decidir), ou só informa o telefone e o atendente confere na confirmação.
  - Monta o pedido com o mesmo `preco.ts`, escolhe entrega ou retirada, manda a localização pelo navegador ou escolhe um local salvo, e escolhe o pagamento.
  - **Se for Pix:** aparece o copia e cola, e a confirmação é automática (integração I1).
- **Na mesma fila:** o pedido cai na fila do atendimento como "pelo link · confirmar". O atendente confere e manda a confirmação pelo WhatsApp com o texto pronto.
- **Divulgação:** link na mensagem de saudação do WhatsApp Business, resposta rápida, bio do Instagram e QR na caixa e na comanda.
- **Medir** a porcentagem de pedidos por canal toda semana.

## Integrações

### I1. Pix automático
- **Como funciona:** ao fechar um pedido com Pix antecipado, o sistema cria uma cobrança com o valor exato e um `txid` ligado ao pedido. O copia e cola vai no resumo do WhatsApp (ou aparece na página do link). O provedor avisa o pagamento por webhook. O pagamento vira `pix_confirmado = true` (origem `webhook`), a coluna PIX atualiza sozinha e a comanda já sai "PIX PAGO".
- **Sem pagamento:** a cobrança expira e o pedido fica "aguardando Pix".
- **Provedor:** o Itaú é o provável, porque a maquininha é a Laranjinha (ver ARQUITETURA, Integrações).
  - Mercado Pago: token, sem certificado.
  - Banco com a API Pix do Banco Central (Inter ou Efí): certificado, e `apps/integracoes`.
- **Custo:** de 0,9% a 1,2% por Pix antecipado.
- **Troco por Pix:** continua manual. Automatizar depois com Pix de saída.

### I2. Conciliação da maquininha
- **Primeiro passo, sem trocar de máquina:** importar o relatório de vendas da Laranjinha (Portal ou app Rede). Pedir ao Luan um relatório real exportado para escrever o importador.
  - `packages/dominio/src/conciliacao.ts` casa cada transação com um pagamento pela maquininha (motoboy), pelo valor e pela hora mais próxima.
  - **Resultado:** casados, "cartão sem comanda" e "comanda sem cartão". Valores iguais na mesma janela de tempo ficam para o Luan escolher.
  - Escrever testes com relatórios reais anonimizados.
- **Depois, opcional:** maquininha integrada.
  - O valor aparece sozinho na maquininha, e o resultado volta para o sistema. Exigiria o motoboy usar o sistema, o que saiu do plano (decisão 0007); só volta à mesa se as tarifas compensarem muito.
  - O Mercado Pago Point tem API aberta para isso (API de Orders, terminais Smart e Pro). Stone e PagBank exigem parceria comercial e homologação.
  - Só vale se as tarifas compensarem a troca.

### I3. NFC-e
Ver a fase 5.

### I4. WhatsApp API (opcional, mais à frente)
- **O que daria:** caixa de entrada compartilhada com atribuição de conversa, robô e IA lendo as mensagens para montar rascunhos de pedido.
- **Custo:** desde 01/10/2026 são 1.000 mensagens de atendimento grátis por mês e por número, e depois cerca de US$ 0,0068 por mensagem no Brasil. Daria uns R$ 420 por mês no volume da Mel, mais a plataforma.
- **Coexistência:** permite manter o app no celular junto com a API, no mesmo número.
- **Quando:** só se o volume ou a IA justificarem. Até lá, a trava de atendimento do sistema (MVP) resolve os dois atendentes no mesmo número.
