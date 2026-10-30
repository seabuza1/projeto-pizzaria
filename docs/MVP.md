# MVP sólido

O primeiro produto que roda numa noite de verdade: **o pedido nasce digitado, a comanda sai impressa, o Luan despacha e faz o acerto no painel.** O motoboy não usa o sistema (decisão 0007). Regras em `PROJETO.md`, decisões técnicas em `ARQUITETURA.md`, padrões em `PADROES.md`.

## Por que este recorte

- **O pedido digitado tira o trabalho de todo mundo de uma vez:** o atendente não escreve, o Luan não anota na folha nem soma, e o motoboy só leva a comanda impressa. Antes, o plano começava pelo acerto com a comanda escrita à mão, e por isso o motoboy precisava lançar cada comanda num app. Isso saiu.
- **Enxuto:** só entra o que tira trabalho manual de alguém hoje. Cada tela a mais é mais coisa para quebrar e manter (PROJETO, princípio 8).
- **A base técnica é a parte cara de refazer:** acesso por papel, fila offline no balcão, registro de mudanças e fuso. Já está feita (etapas 1 a 3).
- **Custo da mudança:** a primeira noite real demora mais do que no plano antigo, porque o MVP agora inclui o pedido digitado. Em troca, ninguém aprende uma tela que depois some.

## O que entra

**1. Atendimento** (`fases/F2-pedido.md`):
- cardápio e preço (P1 a P11), com a gerente editando preços e marcando "acabou hoje";
- clientes pelo telefone, com o último local;
- tela de pedido com a trava de atendimento, rascunho, resumo para o WhatsApp e "Autorizado";
- promoção da noite;
- retirada no balcão.

**2. Despacho e acerto no painel do Luan** (`fases/F1-acerto.md`):
- noite, motoboys da noite e caixas;
- despacho: o Luan toca nos códigos e no nome do motoboy;
- "Voltou", "Trocou a forma" e "Saiu de novo";
- acerto com liquidação, papel conferido e confirmação;
- coluna PIX com "caiu" marcado à mão;
- resumo da noite e noite antiga só para leitura, com CSV;
- "Lançar comanda de papel", para quando a noite rodou no papel.

**3. Impressão sem fio:**
- **Agente** (`apps/agente`) no computador do balcão, com a conta de papel `agente`.
- **Impressora térmica de 80 mm no Wi-Fi da loja,** com IP fixo. Ver ARQUITETURA, Impressão.
- **Layout com ReceiptLine**, em `packages/dominio/src/impressao/`.
- **O que imprime:**
  - **comanda** ao autorizar o pedido (F2, Comanda impressa);
  - **recibo do acerto** na confirmação, com espaço para as duas assinaturas;
  - **folha da noite** só por botão, como reserva.
- Reimprimir pelo painel.
- **Sem internet:** o balcão manda direto ao agente pela rede local (ARQUITETURA, Impressão).

**4. Base técnica** (feita nas etapas 1 a 3, manter):
- monorepo, TypeScript strict, Biome, Vitest e GitHub Actions;
- `packages/dominio` com as contas puras e os testes;
- Supabase com RLS em todas as tabelas, `aplicar_operacao` idempotente, `operacoes` e `eventos`;
- testes de acesso com uma conta de cada papel usado no MVP (`admin`, `gerente`, `expedicao`, `atendente`, `agente`);
- fila offline no balcão, com o indicador "Salvo" ou "N alterações esperando internet";
- fuso fixo da pizzaria e `ambiente` em `config`, com a faixa "AMBIENTE DE TESTE";
- horário do servidor, `versao_op` e versão mínima do app;
- dinheiro só se acrescenta (OPE3);
- MFA para `admin` e `gerente`;
- registro de erros e o botão "Relatar problema";
- aviso de versão nova do PWA, que nunca atualiza no meio de um lançamento;
- **funcionalidades como módulos removíveis** (PADROES, Módulos removíveis).

Recibo do acerto (80 mm, 48 colunas):
```
                 MEL PIZZARIA
              ACERTO DO MOTOBOY
------------------------------------------------
Noite: 16/10/2026        Motoboy: Felipe (1)
Confirmado por: Luan     23:48
------------------------------------------------
Entregas: 5 (Barra 2, Aragarças 2, Pontal 1)
Voltaram: 1 (8094)
Pix antecipado: 60,00 (0017, caiu)
------------------------------------------------
Caixa inicial                          80,00
Dinheiro das vendas                   160,00
Troco por Pix                           3,00
= Devolver                            243,00
Contado                               243,00
Diferença                               0,00
------------------------------------------------
Diária                                 30,00
Taxas                                  56,00
= Receber                              86,00
------------------------------------------------
Pago do caixa dele                     80,00
Retirado do caixa da empresa            6,00
Vai para a empresa                    163,00
------------------------------------------------
Maquininha esperada                   162,00
  2672  cartão                         90,00
  0910  Pix na maquininha              72,00
Papéis faltando: nenhum
------------------------------------------------

Motoboy: ______________   Luan: ______________
```

## O que fica fora

- App, login ou tela para o motoboy (decisão 0007).
- Troca rápida de usuário por PIN no balcão: o computador fica com a conta do atendimento, e o Luan e a gerente usam a própria conta (Felipe, 30/10).
- Crédito do cliente e cobrança em dobro: a gerente resolve à mão, como hoje (Felipe, 30/10).
- Cozinha, garçom e caixa geral (fases 3 a 5).
- Pix automático, conciliação da maquininha, NFC-e e WhatsApp API, inclusive as interfaces "para o futuro".
- Rota com várias paradas, aviso de retorno no sistema e marcação de "Entregue".

## Segurança (checklist do MVP)

- **Acesso:** RLS em todas as tabelas, e nenhuma tabela legível pelo papel `anon`. O Supabase Advisors (Security) não pode ter alerta.
- **Chaves:** no front, só a anon key. A service role nunca sai do servidor.
- **Repositório:**
  - **privado** no GitHub antes de entrar dado real;
  - `.env`, certificados (`*.p12`, `*.pem`) e backups `.json` ficam no `.gitignore`;
  - varredura de segredos no CI (por exemplo, gitleaks);
  - dependências com atualização automática (Dependabot) e `pnpm audit` no CI.
- **Validação no servidor:** `aplicar_operacao` valida papel, estado e valores (inteiros em centavos, soma dos pagamentos = total). Não confia no aparelho.
- **Contas:** autenticação por e-mail e senha, com senha forte, criadas pelo admin, sem cadastro aberto.
- **Texto livre** (observações) exibido sempre como texto, nunca como HTML.
- **Dados de cliente:** telefone e endereço só no balcão e na comanda impressa. Logs sem dados de cliente.
- **Backups:** Supabase Pro com backup diário, mais um `pg_dump` semanal guardado fora do Supabase.
- **Teste de restauração:** restaurar o backup num projeto de teste uma vez antes da primeira noite real.

## Ordem de construção

Pare no fim de cada etapa e resuma em poucas linhas.

1. **Esqueleto** (feito): monorepo, CI, Biome, configuração do Claude Code e `acerto.ts` com T1 a T19.
2. **Banco local** (feito): migrações, RLS, `aplicar_operacao`, `operacoes`, `eventos` e testes de acesso.
3. **Fila offline e telas base** (feito): `repo.ts`, IndexedDB, fila, login com MFA. O app do motoboy também foi feito nesta etapa e sai na etapa 4.
4. **Sem app do motoboy e módulos removíveis** (decisões 0007 e 0008). Um commit por passo, `pnpm check` verde em cada um:
   1. registro de módulos e o teste que barra import entre funcionalidades (PADROES, Módulos removíveis);
   2. mover para o painel do Luan o que serve: menu da saída ("Voltou", "Trocou a forma", "Saiu de novo", "Desfazer"), editor de pagamentos, conta detalhada e o lançamento rápido, que vira "Lançar comanda de papel";
   3. remover com `/remover-funcionalidade motoboy`: rota `/motoboy`, troca de papel, "Volto em 5/10", "Entregue", histórico do motoboy e o teste de ponta a ponta do motoboy;
   4. banco, em migração nova: tabela `motoboys` (nome, ativo), `caixas` e `saidas` apontando para ela; operações de caixa e saída só para `expedicao`, `gerente` e `admin`; políticas sem o ramo do motoboy;
   5. domínio: T18 muda (saída sem "Voltou" conta como entregue, sem aviso) e entra T20 (dica de diferença, F1).
5. **Painel do Luan** (F1): abrir a noite e escolher os motoboys, folha em tempo real, despacho, caixa do motoboy, acerto, coluna PIX, resumo da noite, cadastro de motoboys e noite antiga com CSV.
6. **Cardápio, preço e clientes** (F2, partes 2a e 2g): `CardapioSchema`, `preco.ts` com P1 a P11, migrações, seed, tela de preços da gerente e "acabou hoje".
7. **Tela de pedido** (F2, partes 2b e 2e): telefone, trava, itens, entrega, pagamento, total, resumo, autorização e retirada.
8. **Impressão sem fio:** agente, impressora no Wi-Fi, comanda, recibo do acerto, folha e reimpressão, com testes de snapshot do texto gerado.
9. **Endurecimento:** checklist de segurança, batimento do agente, plano de contingência colado no balcão e teste de restauração do backup.
10. **Deploy:** Supabase Pro em São Paulo, Cloudflare Pages, agente no computador do balcão e o app instalado no computador e no celular do Luan.

## Implantação

1. **Uma quarta-feira** (a noite mais fraca): um atendente digita todos os pedidos e a comanda sai impressa. A comanda à mão continua em paralelo. O Luan despacha no sistema e faz o acerto no papel; no fim, comparar.
2. **Noites 2 a 4:** só a comanda impressa. O Luan faz o acerto no papel e no sistema e compara.
3. **Depois:** acerto só pelo sistema, com o recibo impresso. A folha de papel sai quando três noites seguidas baterem.
4. O grupo de entregas no WhatsApp continua para localização pendente e aviso de retorno.
5. Antes da primeira noite, o Luan e os atendentes leem o guia "Como a Mel funciona com o sistema".

## Pronto quando

- T1 a T20 e P1 a P11 passam.
- Dois atendentes não pegam o mesmo telefone sem aviso.
- Um pedido autorizado imprime em até 5 s, inclusive sem internet (pelo agente na rede local).
- Despachar um pedido leva no máximo dois toques.
- O recibo do acerto sai em até 5 s depois da confirmação, inclusive sem internet.
- O teste de módulos passa e não sobra referência ao app do motoboy.
- O checklist de segurança está cumprido, e o Advisors não mostra alerta.
- O backup foi restaurado com sucesso num projeto de teste.
- O tempo de atendimento medido em 10 pedidos é menor que o do papel.
- Uma noite real inteira rodou sem papel de soma, e o dinheiro bateu.

## Depois do MVP

1. **Bancada de testes** enxuta (`BANCADA-TESTES.md`): noite simulada, impressora virtual e falhas de rede.
2. **Fases 3 a 6 e integrações:** sem data, só quando o Felipe pedir (`fases/F3-a-F6.md`).
