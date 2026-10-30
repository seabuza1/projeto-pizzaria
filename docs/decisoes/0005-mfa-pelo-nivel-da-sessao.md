# 0005 MFA de admin e gerente conferido no banco

- **Contexto:** MFA é obrigatório para `admin` e `gerente` (ARQUITETURA, Segurança).
- **Decisão:** TOTP do Supabase Auth. `interno.meus_papeis()` devolve lista vazia para admin e gerente sem `aal2`; `aplicar_operacao` responde MEL03, e o app guarda a fila e pede o código.
- **Consequência:** sem o código, eles só veem o próprio perfil. No primeiro acesso, o app mostra o QR code para cadastrar o autenticador. O seed local tem um segredo TOTP de teste.
