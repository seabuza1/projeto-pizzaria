# 0011 Primeiro autenticador só com liberação do admin

- **Contexto:** admin e gerente entram com o app autenticador (decisão 0005). Na primeira entrada, a conta cadastra o autenticador com a sessão só de senha: quem descobrisse a senha de uma gerente que ainda não cadastrou poderia cadastrar o dele primeiro.
- **Decisão:** o hook de verificação do MFA do Supabase Auth (`public.hook_verificacao_mfa`) recusa a confirmação do primeiro autenticador, a menos que o admin tenha liberado a conta (`salvar_perfil` com `liberar_mfa`), o que vale 30 minutos. Fator já confirmado segue normal; um segundo fator o Supabase já só aceita com a sessão confirmada (aal2).
- **Consequência:** o primeiro acesso de uma gerente é com o Felipe junto, que libera na hora. Em produção, o hook precisa ser ligado no painel do Supabase (Authentication, Hooks). O primeiro admin é liberado direto no banco, na implantação.
