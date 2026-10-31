# Contingência

## Para colar no balcão (imprimir e deixar ao lado do computador)

1. **Caiu a internet:** continue usando. O app mostra "N alterações esperando internet" e manda tudo quando ela voltar. A comanda imprime pelo computador do balcão. Ligue a internet reserva (chip 4G ou celular roteando).
2. **Caiu a energia:** o nobreak segura o roteador, o computador e a impressora. Se ele acabar, comanda à mão e folha de papel, como antes. Quando o sistema voltar, o Luan usa "Lançar comanda de papel".
3. **O sistema não abre:** papel na hora (comanda à mão e folha da expedição). O acerto da noite pode ser no papel e confirmado no sistema depois.
4. **Impressora sem resposta:** confira se está ligada, com papel e no Wi-Fi. Enquanto isso, "Imprimir pelo navegador" no aviso do topo. Se nem isso, comanda à mão.
5. **Algo estranho:** toque em "Relatar problema" no pé da tela e avise o Felipe (telefone: ______________).

## Backup e restauração (para o Felipe)

- **Diário:** o Supabase Pro guarda o backup do banco todo dia.
- **Semanal, fora do Supabase:** `supabase db dump` do projeto de produção para um arquivo guardado fora do Supabase e fora do repositório (backups ficam no `.gitignore`).
- **Antes da primeira noite real:** restaurar o backup num projeto de teste e conferir as contagens e as políticas. Isso só se faz com o seu acesso à produção.
- **Ensaio local:** `pnpm ensaio:restauracao` faz o mesmo no Supabase local (pg_dump, restaura num banco novo e confere tabela por tabela).
