-- Só para o Supabase local e a bancada. Nunca em produção.
-- Contas de teste, uma por papel em uso. Senha de todas: Mel12345teste
-- O cardápio vem de seeds/cardapio.sql, gerado do JSON (pnpm db:cardapio).
-- O motoboy não entra no sistema (decisão 0007): João, Pedro e Felipe são só cadastro de motoboy.
-- Admin e gerente entram com MFA: o app autenticador de teste usa o segredo TOTP abaixo.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'felipe@mel.test', 'Felipe', '{admin}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'luan@mel.test', 'Luan', '{expedicao}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'dona@mel.test', 'Dona', '{gerente}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000006'::uuid, 'agente@mel.test', 'Balcão', '{agente}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000008'::uuid, 'atendimento@mel.test', 'Atendimento', '{atendente}'::public.papel[])
    ) as t (id, email, nome, papeis)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Mel12345teste', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email',
      now(), now(), now()
    );
    insert into public.perfis (id, nome, papeis) values (u.id, u.nome, u.papeis);
  end loop;
end
$$;

-- MFA (TOTP) já verificado para admin e gerente. Segredo de teste: JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
select gen_random_uuid(), p.id, 'Autenticador de teste', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
from public.perfis p
where p.papeis && '{admin,gerente}'::public.papel[];

insert into public.motoboys (id, nome) values
  ('a0000000-0000-4000-8000-000000000004', 'João'),
  ('a0000000-0000-4000-8000-000000000005', 'Pedro'),
  ('a0000000-0000-4000-8000-000000000007', 'Felipe');

update public.config set ambiente = 'teste';
