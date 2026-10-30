-- Só para o Supabase local e a bancada. Nunca em produção.
-- Contas de teste, uma por papel do MVP. Senha de todas: Mel12345teste

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'felipe@mel.test', 'Felipe', '{admin,motoboy}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'luan@mel.test', 'Luan', '{expedicao}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'dona@mel.test', 'Dona', '{gerente}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'joao@mel.test', 'João', '{motoboy}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000005'::uuid, 'pedro@mel.test', 'Pedro', '{motoboy}'::public.papel[]),
      ('a0000000-0000-4000-8000-000000000006'::uuid, 'agente@mel.test', 'Balcão', '{agente}'::public.papel[])
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

update public.config set ambiente = 'teste';
