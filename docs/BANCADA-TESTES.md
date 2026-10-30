# Bancada de testes: ambiente controlado

Construir **depois do MVP**. Serve para saber se o sistema aguenta uma noite antes da primeira noite real e antes de cada mudança grande, sem dinheiro de verdade e sem papel. Roda contra um ambiente de teste, nunca contra a produção.

**Enxuta:** testa só o que existe. Pix falso e relatório da maquininha falso entram junto com as integrações, se elas entrarem. Não é um app separado: são scripts em `scripts/bancada/` e testes que usam o mesmo `aplicar_operacao` do app.

## Ambiente

- **Local:** `supabase start` (precisa do Docker Desktop no Windows) e o app no `vite`.
- **Na nuvem (opcional):** um projeto Supabase separado (`mel-teste`, plano Free) e um deploy de preview no Cloudflare Pages.
- **`config.ambiente = 'teste'`:** a faixa "AMBIENTE DE TESTE" aparece em todas as telas.
- **Seed de teste:** áreas, cardápio (de `dados/cardapio-mel.json`), 5 motoboys no cadastro, um atendente, um Luan e uma gerente, com senha de teste.
- **Chaves:** só as de teste, num `.env.teste` fora do repositório.

## Peças

### 1. Impressora virtual
- **Servidor TCP na porta 9100**, igual a uma impressora de rede. O agente não sabe que é falsa.
- **Guarda o que chega:** os bytes ESC/POS e uma imagem do papel, gerada pelo ReceiptLine, numa pasta com a hora.
- **Modos:** normal, lenta (3 s por trabalho), desligada (conexão recusada) e cai no meio do trabalho.
- **Esperado:** o agente tenta de novo, não imprime em dobro, marca erro depois de N tentativas e o painel mostra "Impressora sem resposta".

### 2. Noite simulada
- **Ritmo:** uma noite acelerada (por exemplo, 12× mais rápida: das 19h às 24h em 25 minutos).
- **A noite:** abre com 5 motoboys na ordem de chegada e cria de 70 a 100 pedidos pelo fluxo do atendente, com pico entre 20h e 22h.
- **Mistura parecida com a real:** dinheiro, cartão, Pix na maquininha, Pix antecipado e misto, troco por Pix, troca de forma na porta, 5% que voltam e 2% que saem de novo.
- **Robôs** do atendente e do Luan usam as mesmas operações do app, com o mesmo formato e a mesma fila.
- **No fim:** cada caixa recebe o dinheiro contado, às vezes com falta, sobra ou uma troca de forma não registrada de propósito. O robô do Luan confere os papéis (deixando um faltando) e confirma os acertos.

### 3. Verificador
- **Conta de novo:** refaz os acertos a partir das operações geradas e compara com o que o sistema gravou.
- **Confere:** nenhuma operação aplicada duas vezes; somas por forma de pagamento; `pago = do caixa dele + retirado`; papéis faltando; um `evento` para cada mudança; tudo na noite certa; a dica de diferença apontou a troca não registrada.

### 4. Falhas de propósito
- Cortar a internet do balcão por 10 minutos no meio da noite.
- Desligar o agente de impressão e religar.
- Derrubar o Realtime: o painel tem que se recuperar sozinho.
- **Meia-noite:** relógio de 23h50 até 00h30. Tudo continua na mesma noite.
- **Aparelho com o fuso errado** (`America/Cuiaba`): datas e horas continuam no horário de Brasília.
- Duas pessoas mexendo no mesmo caixa ao mesmo tempo.
- Desligar uma funcionalidade pelo interruptor no meio da noite: o resto continua.

## Comandos

```
pnpm bancada noite --motoboys 5 --pedidos 90 --acelerar 12 --falhas padrao
pnpm bancada impressora --modo lenta   # normal | lenta | desligada | cai
```

## Relatório de cada rodada

Em Markdown, com as imagens das impressões:
- **invariantes:** OK ou FALHOU, com o pedido e a operação de cada falha;
- **tempos:** operação → painel (p50 e p95) e pedido de impressão → impresso;
- **fila offline:** tamanho máximo e tempo para esvaziar;
- **erros** registrados.

## Metas para liberar uma versão

- Zero invariantes quebrados em 3 rodadas seguidas.
- p95 de operação → painel abaixo de 3 s. Impressão abaixo de 5 s.
- Depois de 10 minutos offline, tudo sobe em menos de 1 minuto, sem duplicar.

## Ordem de construção

1. Seed de teste e `config.ambiente`.
2. Impressora virtual.
3. Noite simulada e verificador.
4. Falhas de propósito.
5. Rodada manual antes de cada mudança grande; rodada noturna no GitHub Actions só se o tempo de CI couber no plano grátis.

Pare no fim de cada etapa e resuma em poucas linhas.
