# Fase 1: despacho e acerto no painel do Luan

Parte do MVP. O motoboy não usa o sistema (decisão 0007): tudo acontece no painel do Luan. As regras citadas estão em `docs/PROJETO.md`; a arquitetura, em `docs/ARQUITETURA.md`; os erros previstos, em `docs/ERROS-PREVISTOS.md`.

## Objetivo

O Luan registra com um ou dois toques quem levou cada pedido e faz o acerto com a conta pronta, no formato da folha de expedição. Meta: o acerto cair de 5 a 15 minutos por motoboy para poucos minutos, e comanda perdida deixar de travar o acerto.

## Escopo

**Dentro:**
- abrir a noite, escolher os motoboys e abrir os caixas;
- despachar: pedido → motoboy;
- "Voltou", "Trocou a forma" e "Saiu de novo";
- "Lançar comanda de papel", para a noite que rodou no papel;
- conta do acerto em tempo real, com a dica de diferença;
- conferência de papéis e da forma de pagamento de cada comanda;
- liquidação e confirmação do acerto;
- coluna PIX com "caiu" marcado pelo Luan;
- entregas por cidade, resumo da noite e noite antiga só para leitura, com CSV;
- cadastro de motoboys.

**Fora:** app do motoboy, "Entregue", aviso de retorno no sistema ("Volto em 5"), separar pedido para um motoboy, rota com várias paradas, histórico por semana e mês, crédito e cobrança em dobro.

## Regras usadas

PED1, PED2, ENT1 a ENT8, PAG1 a PAG7, ACE1 a ACE10, OPE1 a OPE3.

O pedido nasce na tela do atendente (F2). Na contingência, nasce do "Lançar comanda de papel", com origem `papel`.

## Fluxo da noite

1. **Abrir a noite** (expedição, gerente ou admin): a data sai do relógio do servidor no fuso da pizzaria; das 00h às 06h vale o dia anterior. Se ninguém abriu, o primeiro pedido do atendente abre a noite com os padrões.
2. **Motoboys da noite:** escolher do cadastro, na ordem de chegada. Cada um ganha um caixa com R$ 80 e R$ 30 já preenchidos e editáveis.
3. **Despachar** (Luan, quando o motoboy pega a pizza):
   - a lista mostra os pedidos de entrega autorizados e ainda não despachados, por ordem de autorização, com a área e a situação do Pix;
   - tocar num ou mais códigos e depois no nome do motoboy cria uma saída para cada pedido, com a taxa da área gravada;
   - "Desfazer" por 5 s; depois disso, "Cancelar saída" com motivo;
   - pedido com "PIX: CONFERIR" mostra o aviso para o Luan conferir antes de entregar a comanda ao motoboy.
4. **Durante a noite** (menu do código na coluna do motoboy):
   - **"Voltou":** a taxa conta e os valores do pedido não (ENT5);
   - **"Saiu de novo":** nova saída do mesmo pedido, com outra taxa (ENT4);
   - **"Trocou a forma":** formas e divisão, quando o motoboy avisa ou no acerto (PAG3).
5. **Lançar comanda de papel** (contingência, quando o sistema ou o aparelho caiu e a noite seguiu no papel): código, total, área, forma e motoboy. Tocar na forma já lança. Área sugerida pelo último pedido com o mesmo código.
6. **Acerto** (Luan, pela ordem de chegada):
   - **papel conferido:** para cada comanda que o motoboy devolve, marcar o papel e conferir a forma. Se ele anotou outra forma na comanda ou não há comprovante da maquininha para um cartão, "Trocou a forma";
   - **dinheiro contado;**
   - a tela mostra a liquidação e, se houver diferença, a dica de diferença;
   - "Confirmar acerto" com dois toques; o recibo imprime.
7. **Fechar a noite:** o sistema lista o que ficou pendente (pedido autorizado sem saída, rascunho aberto, caixa sem acerto, Pix sem "caiu") e o Luan resolve ou confirma que pode fechar.

## Cálculo: `packages/dominio/src/acerto.ts`

Funções puras, em centavos. Para um caixa (um motoboy numa noite):

```
saidasDoCaixa = saídas do motoboy na noite (sem as canceladas)
entregues     = saidasDoCaixa com estado ≠ voltou
pagamentosNaPorta = pagamentos ligados às entregues (forma real; a prevista se não foi trocada)

dinheiro      = Σ pagamentos em dinheiro
troco         = Σ troco_pix desses pagamentos em dinheiro
cartao        = Σ pagamentos em cartão
pixMaquina    = Σ pagamentos em Pix na maquininha
pixAntecipado = Σ pagamentos em Pix antecipado dos pedidos das entregues (não passam pela mão dele)
taxas         = Σ taxa de todas as saidasDoCaixa, inclusive as que voltaram

devolver   = caixaInicial + dinheiro + troco
maquininha = cartao + pixMaquina
receber    = diaria + taxas

com dinheiroContado:
  dif      = dinheiroContado − devolver
  falta    = max(0, −dif)
  sobra    = max(0, dif)
  pagar    = max(0, receber − falta)
  completa = max(0, falta − receber)

liquidação:
  doCaixaDele          = min(caixaInicial, pagar, dinheiroContado)
  retiradoCaixaEmpresa = pagar − doCaixaDele
  vaiParaEmpresa       = dinheiroContado − doCaixaDele + completa

porArea[área]   = { entregues, voltaram, taxas }
papelFaltando   = saídas com papel_conferido = false
listaMaquininha = pagamentos em cartão e Pix na maquininha, com código, forma e valor, na ordem da hora

dicaDiferenca(dif, pagamentosNaPorta):
  se dif > 0: pagamentos em cartão ou Pix na maquininha com valor = dif   → "pagou em dinheiro?"
  se dif < 0: pagamentos em dinheiro com valor = −dif                    → "pagou no cartão ou Pix na máquina?"
  devolve a lista (pode ser vazia); nunca troca nada sozinha
```

Conferência: sem falta, `vaiParaEmpresa − retiradoCaixaEmpresa = devolver − receber + sobra`.

Os pagamentos na porta ficam ligados a uma saída. Quando uma saída volta e o pedido sai de novo, esses pagamentos passam para a nova saída; os Pix antecipados continuam só no pedido.

**Troca de forma, em resumo:** trocar entre cartão e Pix na maquininha não muda o dinheiro do motoboy, só a lista da maquininha. Trocar de ou para dinheiro muda o "devolver". Se ninguém registrar a troca, o dinheiro contado não bate e a dica de diferença aponta a comanda provável.

## Casos de teste (R$; caixa 80 e diária 30, salvo indicação)

Noite base: uma saída por pedido.

| Código | Total | Área | Pagamento | Extra |
|---|---|---|---|---|
| 3557 | 113 | Barra | dinheiro | |
| 0017 | 60 | Aragarças | Pix antecipado | |
| 2672 | 90 | Pontal | cartão | |
| 0910 | 72 | Barra | Pix na maquininha | |
| 3595 | 47 | Aragarças | dinheiro | troco por Pix de 3 |
| 8094 | 65 | Barra | dinheiro | voltou |

- **T1** Base: devolver 243, maquininha 162, receber 86, pixAntecipado 60.
- **T2** Base + contado 240: falta 3, pagar 83.
- **T3** Base + contado 243: bate, pagar 86.
- **T4** Base + contado 250: sobra 7, pagar 86.
- **T5** Base + contado 140: falta 103, pagar 0, completa 17.
- **T6** Base + pedido 1234, total 50, Pontal, 20 em Pix antecipado + 30 em dinheiro: devolver 273, maquininha 162, receber 96, pixAntecipado 80.
- **T7** Base + o 8094 sai de novo com ele (segunda saída do mesmo pedido, dinheiro): devolver 308, receber 98.
- **T8** Base, depois a taxa de Barra muda para 13: receber continua 86 (ENT2).
- **T9** Pagamento misto cuja soma difere do total: lançamento bloqueado, com mensagem.
- **T10** Caixa 75. Treze saídas, todas no cartão: 10 em Barra de 50, 2 em Aragarças de 40 e 1 em Pontal de 30. Contado 75 → devolver 75, maquininha 610, receber 170, pagar 170, doCaixaDele 75, retiradoCaixaEmpresa 95, vaiParaEmpresa 0.
- **T11** Base + contado 243: pagar 86, doCaixaDele 80, retiradoCaixaEmpresa 6, vaiParaEmpresa 163.
- **T12** Base + contado 240: falta 3, pagar 83, doCaixaDele 80, retiradoCaixaEmpresa 3, vaiParaEmpresa 160.
- **T13** Base + contado 140: falta 103, pagar 0, completa 17, doCaixaDele 0, retiradoCaixaEmpresa 0, vaiParaEmpresa 157.
- **T14** Base + contado 250: sobra 7, pagar 86, doCaixaDele 80, retiradoCaixaEmpresa 6, vaiParaEmpresa 170.
- **T15** Uma saída em Aragarças de 40 em dinheiro, contado 120: receber 35, pagar 35, doCaixaDele 35, retiradoCaixaEmpresa 0, vaiParaEmpresa 85.
- **T16** Base → porArea: Barra 2 entregues, 1 voltou, taxas 36; Aragarças 2, taxas 10; Pontal 1, taxas 10.
- **T17** Base com papel conferido em todas menos a 2672 → papelFaltando = [2672].
- **T18** Saída sem "Voltou" no fechamento conta como entregue, sem aviso.
- **T19** Pagamento com troco por Pix sem parte em dinheiro: recusado (PAG4).
- **T20** Dica de diferença. Base, mas o cliente da 2672 pagou os 90 em dinheiro e ninguém trocou a forma; contado 333 → sobra 90, e a dica aponta a 2672 (cartão, 90). Depois de "Trocou a forma" para dinheiro: devolver 333, maquininha 72, sobra 0.

## Painel do Luan (`/expedicao`, papéis expedicao, gerente e admin)

**Folha da noite**, no formato do papel:
```
 1 Felipe          2 João            PIX
 ─────────────     ─────────────     ──────────────
 3557  din         8498  pix+din     0017  caiu ✓
 0017  pix         1693  cartão      8498  conferir
 2672  cartão
 3595  din →3,00
 8094  voltou      (riscado)
 ─────────────     ─────────────
 16/10 · 80,00     16/10 · 80,00
 6 entregas        2 entregas
 Devolve 243,00    Devolve 117,00
 Recebe   86,00    Recebe   57,00
 Pendente          Pendente
```
- **Colunas:** uma por motoboy, na ordem de chegada. No celular rolam para o lado; em tela maior ficam lado a lado.
- **Cada código** mostra a forma e o estado (riscado se voltou). Tem "→ valor" para troco por Pix e "•" para papel não conferido depois de aberto o acerto.
- **Coluna PIX:** todos os Pix antecipados da noite. Tocar marca "caiu"; desfazer pede motivo.
- **Rodapé de cada coluna:** data e caixa inicial, entregas, devolver, receber e estado do acerto.
- **Tempo real:** um despacho feito em outro aparelho aparece em poucos segundos.

**Despacho** (no topo do painel): os pedidos prontos para sair, conforme o fluxo acima.

**Caixa do motoboy** (tocar na coluna):
- conta completa, com a origem de cada número (ACE10), entregas por cidade e lista da maquininha;
- conferência de papéis: marcar cada comanda recebida, com as que faltam no topo e os dados para refazer (código, total, área, formas, troco e hora);
- dinheiro contado e dica de diferença;
- **liquidação:** "Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa";
- "Confirmar acerto", com dois toques, grava em `acertos`, trava o caixa e as saídas e imprime o recibo. Reabrir é do admin, com motivo.

**Resumo da noite:**
- recebido por forma de pagamento;
- pago aos motoboys;
- retirado do caixa da empresa;
- o que foi para a empresa;
- faltas, sobras e entregas por cidade.

**Noites antigas:** só leitura, com exportação em CSV.

**Cadastro de motoboys** (gerente e admin): nome e ativo.

## Ordem de construção

Ver MVP, etapas 4 e 5.

## Pronto quando

- T1 a T20 passam.
- Despachar um pedido leva no máximo dois toques, e o despacho aparece nos outros aparelhos em poucos segundos.
- Sem internet, o Luan despacha e marca "Voltou"; quando a internet volta, tudo sobe sozinho e nada duplica.
- Depois do acerto confirmado, ninguém edita o caixa nem as saídas; só o admin reabre, com motivo.
- O fechamento da noite lista os pendentes de `ERROS-PREVISTOS.md`.
- Uma noite real confirmada pelo Luan bate com o dinheiro na mão.
