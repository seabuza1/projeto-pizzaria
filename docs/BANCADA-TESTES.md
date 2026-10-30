# Bancada de testes: ambiente controlado

Construir **depois do MVP**. Serve para saber se o sistema responde antes de uma noite real e antes de cada mudança grande, sem dinheiro de verdade e sem papel. Tudo roda contra um ambiente de teste, nunca contra a produção.

## Objetivo

Rodar uma noite inteira da Mel em poucos minutos, com Pix falso, impressora virtual, motoboys simulados e falhas de rede de propósito. No fim, um relatório diz o que quebrou e quanto tempo cada coisa levou.

## Ambiente

- **Dois jeitos de rodar:**
  - **Local:** `supabase start` (precisa do Docker Desktop no Windows) e o app no `vite`.
  - **Na nuvem:** um projeto Supabase separado (`mel-teste`, plano Free) e um deploy de preview no Cloudflare Pages.
- **`config.ambiente = 'teste'`:** a faixa amarela aparece em todas as telas. Em produção, os provedores falsos não carregam: o app recusa iniciar se encontrar um provedor falso com `ambiente = 'producao'`.
- **Seed de teste:** áreas, cardápio (de `dados/cardapio-mel.json`), 5 motoboys, um Luan e uma gerente, todos com senha de teste.
- **Chaves:** só as de teste, num `.env.teste` fora do repositório. Nenhuma chave de produção na bancada.

## Peças (`apps/bancada`)

### 1. Pix falso
Implementa a mesma interface `ProvedorPix` do provedor real, então o caminho do webhook testado é o de verdade.
- **Criar cobrança:** devolve `txid` e um copia e cola marcado `SIMULADO`.
- **Pagar ou expirar:** pela linha de comando (`pnpm bancada pix pagar <txid>`) ou por uma tela simples com a lista de cobranças.
- **O webhook** é enviado assinado do mesmo jeito que o do provedor real.
- **Cenários:**

  | Cenário | Esperado |
  |---|---|
  | Paga na hora | Coluna PIX e app do motoboy marcam "caiu" em até 3 s |
  | Paga 2 minutos depois | Muda sozinho, sem ninguém tocar |
  | Webhook duplicado | Confirma uma vez só |
  | Webhooks fora de ordem | Estado final correto |
  | Valor diferente do cobrado | Não confirma; avisa a expedição |
  | Nunca paga | Expira e fica "aguardando Pix" |
  | Assinatura inválida ou IP desconhecido | Recusado e registrado em `erros` |

### 2. Impressora virtual
- **Servidor TCP na porta 9100**, igual a uma impressora de rede. O agente nem sabe que é falsa.
- **Guarda o que chega:** os bytes ESC/POS crus e uma imagem do papel, gerada pelo ReceiptLine. Uma galeria web mostra cada impressão com a hora.
- **Modos:** normal, lenta (3 s por trabalho), sem papel, desligada (conexão recusada) e cai no meio do trabalho.
- **Esperado:** o agente tenta de novo, não imprime em dobro, marca erro depois de N tentativas e o painel mostra "Impressora sem resposta".

### 3. Relatório da maquininha falso
- Gera o relatório de vendas no formato do Portal Rede (a partir de um relatório real anonimizado), coerente com a noite simulada.
- Injeta diferenças de propósito: cartão sem comanda, valor trocado e transação duplicada.
- Prepara o terreno para a conciliação (integração I2).

### 4. Simulador da noite
- **Ritmo:** roda uma noite acelerada (por exemplo, 12× mais rápida: das 19h às 24h em 25 minutos).
- **A noite:** abre com 5 motoboys na ordem de chegada e lança de 70 a 100 pedidos, com pico entre 20h e 22h.
- **Mistura de pagamentos parecida com a real:** dinheiro, cartão, Pix na maquininha, Pix antecipado e misto. Inclui troco por Pix, troca de forma na porta, 5% que voltam e 2% que saem de novo.
- **Motoboys robôs:** usam as mesmas operações do app (`aplicar_operacao`), com o mesmo formato e a mesma fila.
- **Offline:** alguns robôs ficam sem internet por alguns minutos e depois sobem a fila.
- **No fim:** cada caixa recebe o "dinheiro contado", às vezes com falta ou sobra injetada. Um robô do Luan confere os papéis (deixando um faltando de propósito) e confirma os acertos.

### 5. Verificador
- **Conta de novo:** refaz os acertos com uma implementação separada, a partir das operações geradas, e compara com o que o sistema gravou.
- **Confere:**
  - nenhuma operação aplicada duas vezes;
  - somas por forma de pagamento;
  - identidade da liquidação (`pago = do caixa dele + retirado`);
  - papéis faltando;
  - um `evento` para cada mudança;
  - fuso: tudo na noite certa.
- **Acesso:** um robô motoboy tenta ler o caixa de outro e editar depois do acerto. As duas coisas têm que falhar.

### 6. Falhas de propósito
- Cortar a internet de um motoboy por 10 minutos no meio da noite.
- Desligar o agente de impressão e religar.
- Derrubar o Realtime: o painel tem que se recuperar sozinho.
- **Meia-noite:** relógio de 23h50 até 00h30. Tudo continua na mesma noite.
- **Celular com o fuso errado** (`America/Cuiaba`, como um aparelho em MT com fuso automático): datas e horas continuam no horário de Brasília.
- Duas pessoas mexendo no mesmo caixa ao mesmo tempo.
- Motoboy editando depois do acerto confirmado: recusado, com o motivo na tela.

### 7. Telas de verdade (Playwright)
- Poucos fluxos completos num navegador sem tela (headless):
  - motoboy lança e marca entregue offline, e a fila sobe ao voltar a internet;
  - o painel atualiza;
  - o Luan confirma o acerto e o recibo aparece na impressora virtual.
- Celular emulado (Android e iPhone) para o app do motoboy.

### 8. Segurança
- Testes de RLS para cada papel.
- Chamada com a anon key sem login.
- Webhook forjado.
- Texto com `<script>` nas observações: tem que aparecer como texto.
- Muitas chamadas seguidas ao webhook: limite de taxa.
- Varredura de segredos.
- Supabase Advisors sem alerta.

## Comandos

```
pnpm bancada noite --motoboys 5 --pedidos 90 --acelerar 12 --falhas padrao
pnpm bancada pix pagar <txid>        # ou: expirar, duplicar, assinatura-invalida
pnpm bancada impressora --modo lenta # normal | lenta | sem-papel | desligada | cai
pnpm bancada relatorio               # abre o último relatório
```

## Relatório de cada rodada

Em Markdown e HTML, com a galeria das impressões. Mostra:
- **invariantes:** OK ou FALHOU, com o pedido e a operação de cada falha;
- **tempos:** operação → painel (p50 e p95), pedido de impressão → impresso, Pix pago → "caiu";
- **fila offline:** tamanho máximo e tempo para esvaziar;
- **erros** registrados;
- **comparação com a rodada anterior.**

## Onde roda

- **Local:** antes de cada etapa grande.
- **GitHub Actions:** uma rodada toda noite (com o Supabase local no runner), e manual quando quiser. O relatório e a galeria ficam como artefatos.

## Metas para liberar uma versão

- Zero invariantes quebrados em 3 rodadas seguidas.
- p95 de operação → painel abaixo de 3 s. Impressão abaixo de 5 s.
- Depois de 10 minutos offline, tudo sobe em menos de 1 minuto, sem duplicar.
- 100% dos webhooks forjados recusados.

## Ordem de construção

1. Seed e `config.ambiente`, com a trava de provedores falsos em produção.
2. Impressora virtual.
3. Pix falso. Se o Itaú tiver sandbox, rodar também os testes de contrato contra ele.
4. Simulador da noite e verificador.
5. Falhas de propósito.
6. Playwright nos fluxos principais.
7. Relatório e rodada noturna no GitHub Actions.

Pare no fim de cada etapa e resuma em poucas linhas.
