# MVP sólido

O primeiro produto que roda numa noite de verdade. Ele é a fase 1 inteira (`fases/F1-acerto.md`), mais a base técnica que fica para sempre e a impressão sem fio. Tudo o que estiver fora desta lista fica para depois. Regras em `PROJETO.md`, decisões técnicas em `ARQUITETURA.md`.

## Por que este recorte

- **O que mais dói hoje é o acerto,** e foi o que o Luan pediu para a primeira semana. A fase 1 resolve isso sem mudar o atendimento, que é onde o Saipos falhou.
- **A base técnica é a parte cara de refazer:** acesso por papel, fila offline, registro de mudanças e fuso. Por isso entra já no MVP, mesmo sem tela nova.
- **A impressão sem fio entra cedo,** imprimindo o recibo do acerto. Assim o caminho da impressora fica provado antes da fase 2, quando a comanda inteira passa a depender dele.

## O que entra

**1. Fase 1 completa** (`fases/F1-acerto.md`):
- noite e caixas;
- lançamento pelo motoboy e marcação na porta;
- painel do Luan no formato da folha;
- acerto com liquidação, papel conferido e confirmação;
- coluna PIX com "caiu" marcado à mão;
- entregas por cidade e histórico.

**2. Base técnica:**
- monorepo, TypeScript strict, Biome, Vitest e GitHub Actions (tipos, lint, testes e migrações);
- `packages/dominio` com as contas puras e os testes T1 a T19;
- Supabase com RLS em todas as tabelas, `aplicar_operacao` idempotente, `operacoes` e `eventos`;
- testes de acesso com uma conta de cada papel usado no MVP (`admin`, `gerente`, `expedicao`, `motoboy`, `agente`);
- fila offline no aparelho, com o indicador "Salvo" ou "N alterações esperando internet";
- fuso fixo da pizzaria em `config` (OPE e glossário);
- **ambiente** em `config` (`producao` ou `teste`). Em teste, uma faixa amarela fixa diz "AMBIENTE DE TESTE" em todas as telas. É o que a bancada de testes vai usar (`BANCADA-TESTES.md`);
- **interfaces das integrações já desenhadas,** mesmo sem uso: `ProvedorPix` e `Impressora`. A bancada troca as implementações reais por falsas sem mexer nas telas;
- atualização do PWA: quando há versão nova, o app avisa "Atualizar" e nunca atualiza no meio de um lançamento;
- registro de erros do front e das funções (tabela `erros` ou um serviço como o Sentry), sem dados de cliente.

**3. Impressão sem fio:**
- **Agente** (`apps/agente`) no computador do balcão, com a conta de papel `agente`.
- **Impressora térmica de 80 mm no Wi-Fi da loja,** com IP fixo. Ver ARQUITETURA, Impressão: Wi-Fi de fábrica, ou rede com ponte Wi-Fi.
- **Layout com ReceiptLine**, em `packages/dominio/src/impressao/`.
- **O que imprime no MVP:**
  - **recibo do acerto** de cada motoboy, na confirmação, com espaço para as duas assinaturas;
  - **folha da noite** no fechamento: as colunas por motoboy e os totais.
- Reimprimir pelo painel.
- **Sem internet:** o painel manda direto ao agente pela rede local (ARQUITETURA, Impressão).

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

Fica para depois:
- pedido digitado pelo atendente, cardápio, clientes e comanda impressa (fase 2);
- cozinha, garçom e caixa geral;
- Pix automático, conciliação da maquininha, NFC-e e WhatsApp API;
- crédito e cobrança em dobro;
- leitura por foto.

## Segurança (checklist do MVP)

- **Acesso:** RLS em todas as tabelas, e nenhuma tabela legível pelo papel `anon`. O Supabase Advisors (Security) não pode ter alerta.
- **Chaves:** no front, só a anon key. A service role nunca sai do servidor.
- **Repositório:**
  - `.env`, certificados (`*.p12`, `*.pem`) e backups `.json` ficam no `.gitignore`;
  - varredura de segredos no CI (por exemplo, gitleaks);
  - dependências com atualização automática (Dependabot) e `pnpm audit` no CI.
- **Validação no servidor:** `aplicar_operacao` valida papel, estado e valores (inteiros em centavos, soma dos pagamentos = total). Não confia no aparelho.
- **Contas:** autenticação por e-mail e senha, com senha forte. Contas de motoboy criadas pelo admin, sem cadastro aberto.
- **Texto livre** (observações) exibido sempre como texto, nunca como HTML.
- **Backups:** Supabase Pro com backup diário, mais um `pg_dump` semanal guardado fora do Supabase.
- **Teste de restauração:** restaurar o backup num projeto de teste uma vez antes da primeira noite real.

## Ordem de construção

Pare no fim de cada etapa e resuma em poucas linhas.

1. **Esqueleto:** monorepo, CI, Biome, a configuração do Claude Code (`CLAUDE-CODE.md`) e `packages/dominio/src/acerto.ts`, com T1 a T19 passando.
2. **Banco local** (`supabase start`):
   - migrações da fase 1, `config` com fuso e ambiente;
   - RLS por papel, `aplicar_operacao`, `operacoes` e `eventos`;
   - testes de acesso com uma conta de cada papel.
3. **App do motoboy:** login, `repo.ts` com IndexedDB e fila, Noite (lançar e porta), Acerto e Histórico.
4. **Painel do Luan:** folha em tempo real, caixa do motoboy, confirmar acerto, resumo da noite e coluna PIX.
5. **Impressão sem fio:** layout com ReceiptLine (com testes de snapshot do texto gerado), agente, impressora no Wi-Fi, recibo do acerto, folha da noite e reimpressão.
6. **Endurecimento:**
   - checklist de segurança;
   - registro de erros;
   - aviso de versão nova do PWA;
   - faixa de ambiente de teste;
   - teste de restauração do backup.
7. **Deploy:** Supabase Pro em São Paulo, Cloudflare Pages, agente instalado no computador do balcão e PWA instalado nos celulares.

## Implantação

1. **Noites 1 a 3:** só o caixa do Felipe, junto com o papel. No fim, comparar com o acerto do Luan.
2. **Noites 4 a 6:** todos os motoboys lançam. O Luan ainda faz no papel e compara com o painel.
3. **Depois:** o Luan faz o acerto pelo painel e imprime o recibo. A folha de papel sai quando três noites seguidas baterem.

## Pronto quando

- Valem todos os itens de "Pronto quando" de `fases/F1-acerto.md`.
- O checklist de segurança está cumprido, e o Advisors não mostra alerta de segurança.
- O recibo do acerto sai na impressora sem fio em até 5 s depois da confirmação, inclusive com a internet desligada (pelo agente na rede local).
- O backup foi restaurado com sucesso num projeto de teste.
- Uma noite real inteira rodou sem papel de soma, e o dinheiro bateu.

## Depois do MVP

1. **Bancada de testes** (`BANCADA-TESTES.md`): Pix falso, impressora virtual, noite simulada e falhas de rede, para saber se o sistema responde antes de cada mudança grande.
2. **Fase 2** (`fases/F2-pedido.md`).
