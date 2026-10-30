# Fase 1: caixa do motoboy, painel do Luan e acerto

Junta o MVP (que já rodou no celular do Felipe e cumpriu o papel) e a versão 1 (nuvem, painel do Luan, liquidação). As regras citadas estão em `docs/PROJETO.md`; a arquitetura, em `docs/ARQUITETURA.md`.

## Objetivo

O motoboy lança cada comanda de papel ao pegar a entrega e marca na porta como foi pago. O Luan acompanha a noite numa tela no formato da folha de expedição e faz o acerto com a conta pronta. Meta: o acerto cair de 5 a 15 minutos por motoboy para poucos minutos, e comanda perdida deixar de travar o acerto.

## Escopo

**Dentro:**
- abrir a noite e os caixas;
- lançar a saída: código, total, área e forma prevista;
- marcar na porta: entregue, trocou a forma, voltou e saiu de novo;
- conta do acerto em tempo real;
- conferência de papéis (comanda perdida);
- liquidação: do caixa dele e retirada do caixa da empresa;
- confirmação do acerto;
- entregas por cidade;
- histórico por noite e por período;
- coluna PIX com "caiu" marcado pelo Luan;
- nuvem com login e funcionamento offline.

**Fora:** pedido digitado pelo atendente (fase 2), cozinha, crédito, cobrança em dobro, retiradas e Pix automático.

## Regras usadas

PED1, PED2, ENT1 a ENT5, ENT8, PAG1 a PAG7, ACE1 a ACE10, OPE1 e OPE2.

Nesta fase, o pedido nasce da comanda de papel. Ao lançar, o app cria de uma vez o `pedido` (origem `papel`), a `saida` (em rota) e os `pagamentos` previstos.

## Fluxo da noite

1. **Abrir a noite** (expedição ou admin): a data sai do relógio no fuso da pizzaria; das 00h às 06h vale o dia anterior. Escolher os motoboys da noite na ordem de chegada.
2. **Caixa do motoboy:** abre com R$ 80 e R$ 30 já preenchidos e editáveis.
3. **Lançar** (motoboy, com a comanda na mão, ao pegar a entrega):
   - código com 4 dígitos, que pula sozinho para o total;
   - total ("113" vale R$ 113,00);
   - área em chips com a taxa;
   - forma prevista.
   - **Tocar na forma já lança**, se o resto estiver certo, e mostra "3557 lançada · Desfazer" por 5 s.
   - O botão Lançar fica para o pagamento dividido ("Pagou de mais de um jeito": linhas de forma e valor, e a linha vazia fica com o resto).
   - Troco por Pix e pagamento dividido ficam em "Mais opções".
   - **Área sugerida:** a do último pedido com o mesmo código, se houver.
4. **Na porta:**
   - "Entregue" com um toque mantém a forma prevista;
   - no menu da comanda: "Trocou a forma" (formas e divisão) e "Voltou".
   - Na saída que voltou: "Saiu de novo" cria outra saída do mesmo pedido, com outra taxa.
   - Desfazer no lugar de confirmar.
5. **Retorno opcional:** "Volto em 5" e "Volto em 10" aparecem para o Luan.
6. **Acerto** (Luan, no painel, pela ordem de chegada):
   - papel conferido em cada comanda recebida;
   - dinheiro contado;
   - a tela mostra a liquidação, e o Luan confirma.

## Cálculo: `packages/dominio/src/acerto.ts`

Funções puras, em centavos. Para um caixa (um motoboy numa noite):

```
saidasDoCaixa = saídas do motoboy na noite
entregues     = saidasDoCaixa com estado ≠ voltou      (em_rota conta como entregue, com aviso ao fechar)
pagamentosNaPorta = pagamentos ligados às entregues (forma real; a prevista se não foi confirmada)

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
```

Conferência: sem falta, `vaiParaEmpresa − retiradoCaixaEmpresa = devolver − receber + sobra`.

Os pagamentos na porta ficam ligados a uma saída. Quando uma saída volta e o pedido sai de novo, esses pagamentos passam para a nova saída; os Pix antecipados continuam só no pedido.

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
- **T7** Base + o 8094 sai de novo com ele (segunda saída do mesmo pedido, dinheiro, entregue): devolver 308, receber 98.
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
- **T18** Saída em rota no fechamento conta como entregue, e a função devolve um aviso.
- **T19** Pagamento com troco por Pix sem parte em dinheiro: recusado (PAG4).

## Telas do motoboy (`/motoboy`)

- **Barra inferior** com 3 abas: Noite, Acerto e Histórico. Ajustes e Sair ficam num ícone do Histórico.
- **Topo fino e fixo** com Devolver, Maquininha e Receber.
- **Lista sem cartões:** código grande à esquerda, área e forma em cinza, valor à direita, estado por cor e ícone. Tem busca por código.
- **Pix antecipado:** mostra "Pix não confirmado · cobrar R$ X" até o Luan marcar "caiu". Depois mostra "Pix confirmado".
- **Acerto:**
  - conta detalhada, com a origem de cada número ("80 de caixa + 160 em dinheiro + 3 de troco por Pix");
  - entregas por cidade;
  - lista da maquininha;
  - papéis faltando;
  - liquidação ("do seu caixa", "o Luan tira do caixa da empresa", "vai para a empresa");
  - estado: "Aguardando o Luan" ou "Confirmado por Luan às 23:48".
- **Histórico:**
  - por noite e por período (semana e mês): noites, entregas por cidade, diárias, taxas e total recebido;
  - noite antiga em modo leitura;
  - exportar em CSV.

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
- **Cada código** mostra a forma e o estado (em rota, entregue, riscado se voltou). Tem "→ valor" para troco por Pix e "•" para papel não conferido depois de aberto o acerto.
- **Volta em N min:** aparece no topo da coluna de quem avisou o retorno.
- **Coluna PIX:** todos os Pix antecipados da noite. Tocar marca "caiu".
- **Rodapé de cada coluna:** data e caixa inicial, entregas, devolver, receber e estado do acerto.
- **Tempo real:** uma comanda nova aparece em poucos segundos.

**Caixa do motoboy** (tocar na coluna):
- conta completa, entregas por cidade e lista da maquininha;
- conferência de papéis: marcar cada comanda recebida, com as que faltam no topo e os dados para refazer (código, total, área, formas, troco e hora);
- dinheiro contado;
- **liquidação:** "Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa";
- "Confirmar acerto", com dois toques, grava em `acertos` e trava o caixa.

**Resumo da noite:**
- recebido por forma de pagamento;
- pago aos motoboys;
- retirado do caixa da empresa;
- o que foi para a empresa;
- faltas, sobras e entregas por cidade.

## Ordem de construção

1. Monorepo (pnpm, TypeScript strict, Biome, Vitest, GitHub Actions) e `packages/dominio/src/acerto.ts`, com T1 a T19 passando.
2. Supabase local: migrações das tabelas da fase 1 (ver ARQUITETURA, modelo de dados), RLS por papel, `aplicar_operacao` idempotente e `eventos`. Testes de acesso com uma conta de cada papel.
3. `apps/web`: login, `repo.ts` com IndexedDB e fila, e as telas do motoboy (Noite com lançamento e porta).
4. Acerto do motoboy e histórico.
5. Painel do Luan: folha em tempo real, caixa do motoboy, confirmar acerto e resumo da noite.
6. Coluna PIX com "caiu" e aviso no app do motoboy.
7. Deploy: Supabase Pro em São Paulo e Cloudflare Pages. Instalar no celular.

Pare no fim de cada etapa e resuma em poucas linhas.

## Implantação

1. **Noites 1 a 3:** só o caixa do Felipe, junto com o papel. No fim de cada noite, comparar com o acerto do Luan.
2. **Depois:** todos os motoboys lançam; o Luan continua no papel e compara.
3. **Depois:** o Luan faz o acerto pelo painel. A folha de papel sai quando três noites seguidas baterem.

## Pronto quando

- T1 a T19 passam.
- Em modo avião, o motoboy lança e marca entregas; quando a internet volta, tudo sobe sozinho e nada duplica.
- O painel mostra uma comanda nova em poucos segundos.
- Um motoboy não vê o caixa de outro (teste com duas contas).
- Depois do acerto confirmado, o motoboy não edita o caixa nem as saídas.
- Uma noite real confirmada pelo Luan bate com o dinheiro na mão.
