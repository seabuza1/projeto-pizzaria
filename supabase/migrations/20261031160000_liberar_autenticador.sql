-- MFA (decisão 0005): admin e gerente entram com o app autenticador. O primeiro autenticador da conta só se
-- cadastra com a liberação do admin, que vale 30 minutos: quem descobrir a senha de uma gerente que ainda não
-- cadastrou não consegue cadastrar o dele primeiro. Um segundo autenticador o Supabase já só aceita com a sessão
-- confirmada pelo primeiro (aal2).

alter table public.perfis add column mfa_liberado_ate timestamptz;

-- O admin libera pelo salvar_perfil (liberar_mfa: true).
create or replace function interno.op_salvar_perfil(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'perfil_id');
  v_papeis public.papel[];
begin
  perform interno.exigir(p_papeis, 'admin');
  if d ? 'papeis' then
    select array_agg(x::public.papel) into v_papeis from jsonb_array_elements_text(d -> 'papeis') x;
    if coalesce(cardinality(v_papeis), 0) = 0 then
      perform interno.recusar('Escolha ao menos um papel.', 'dados_invalidos');
    end if;
    -- Decisão 0007: o motoboy não usa o sistema; é um cadastro em Motoboys.
    if 'motoboy' = any (v_papeis) then
      perform interno.recusar('O motoboy não entra no sistema: cadastre em Motoboys.', 'papel_sem_uso');
    end if;
  end if;
  if v_id = p_uid and (
    (d ? 'ativo' and not (d ->> 'ativo')::boolean) or (v_papeis is not null and not ('admin' = any (v_papeis)))
  ) then
    perform interno.recusar('Você não pode tirar o próprio acesso de admin.');
  end if;
  update public.perfis set
    nome = coalesce(nullif(trim(d ->> 'nome'), ''), nome),
    papeis = coalesce(v_papeis, papeis),
    ativo = coalesce((d ->> 'ativo')::boolean, ativo),
    mfa_liberado_ate = case
      when (d ->> 'liberar_mfa')::boolean then p_hora + interval '30 minutes'
      when d ? 'liberar_mfa' then null
      else mfa_liberado_ate
    end
  where id = v_id;
  if not found then
    perform interno.recusar('Pessoa não encontrada.');
  end if;
  return jsonb_build_object('perfil_id', v_id);
end
$$;

-- Hook de verificação do MFA do Supabase Auth (config.toml, [auth.hook.mfa_verification_attempt]).
-- Roda como supabase_auth_admin a cada código confirmado. Fator já confirmado: segue. Primeiro cadastro: só liberado.
create function public.hook_verificacao_mfa(evento jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_usuario uuid := (evento ->> 'user_id')::uuid;
  v_fator uuid := (evento ->> 'factor_id')::uuid;
begin
  if exists (select 1 from auth.mfa_factors f where f.id = v_fator and f.status = 'verified') then
    return jsonb_build_object('decision', 'continue');
  end if;
  if exists (select 1 from public.perfis p where p.id = v_usuario and p.mfa_liberado_ate > now()) then
    return jsonb_build_object('decision', 'continue');
  end if;
  return jsonb_build_object(
    'decision', 'reject',
    'message', 'Cadastro do autenticador não liberado. Peça ao admin para liberar.'
  );
end
$$;

revoke all on function public.hook_verificacao_mfa(jsonb) from public, anon, authenticated;
grant execute on function public.hook_verificacao_mfa(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.perfis to supabase_auth_admin;
create policy perfis_hook_mfa on public.perfis for select to supabase_auth_admin using (true);
