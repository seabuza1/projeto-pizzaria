# 0004 Anular em vez de apagar (OPE3)

- **Contexto:** OPE3 proíbe apagar ou sobrescrever pagamentos, acertos, sobras e faltas.
- **Decisão:** desfazer um lançamento marca a saída como cancelada e os pagamentos como anulados, com motivo, quem e quando. Trocar a forma anula a troca anterior. Reabrir o acerto pede motivo e anula a sobra e a falta. As contas (TS e SQL) ignoram o que está anulado ou cancelado.
- **Consequência:** o gatilho `interno.proteger_dinheiro` barra DELETE e mudança de valor nessas tabelas, até para quem acessa o banco direto. Limpeza de testes usa TRUNCATE.
