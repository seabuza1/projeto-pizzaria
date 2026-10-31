# 0010 Agente de impressão em TypeScript, sem build

- **Contexto:** o agente (`apps/agente`) roda no computador do balcão. Um passo de build a mais é uma coisa a mais para dar errado na hora de atualizar.
- **Decisão:** o agente roda direto com `node src/principal.ts` (Node 22 executa TypeScript que só tem tipos). O código usa só sintaxe apagável (`erasableSyntaxOnly`), imports com `.ts` e, de `@mel/dominio`, só tipos. Dependências: as que o projeto já usa (`@supabase/supabase-js` e `receiptline`), sem biblioteca nova.
- **Consequência:** atualizar é copiar a pasta e reiniciar. O layout continua no domínio; o agente só transforma a marcação em ESC/POS e manda pela rede. A configuração vem do ambiente (`.env` ao lado, fora do repositório; nomes em `.env.example`).
