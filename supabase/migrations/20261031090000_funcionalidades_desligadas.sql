-- Interruptor sem deploy (PADROES, Módulos removíveis; OPE1): config guarda as funcionalidades desligadas.
-- O app esconde a rota e o menu delas. Serve para desligar algo com problema no meio da noite.

alter table public.config
  add column funcionalidades_desligadas text[] not null default '{}'
    check (cardinality(funcionalidades_desligadas) <= 30);

create or replace function interno.op_salvar_config(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  cfg public.config;
  v_desligadas text[];
begin
  perform interno.exigir(p_papeis, 'admin');
  select * into cfg from public.config limit 1 for update;
  if d ? 'fuso' and not exists (select 1 from pg_catalog.pg_timezone_names where name = d ->> 'fuso') then
    perform interno.recusar('Fuso inválido.', 'dados_invalidos');
  end if;
  if d ? 'ambiente' and d ->> 'ambiente' not in ('producao', 'teste') then
    perform interno.recusar('Ambiente inválido.', 'dados_invalidos');
  end if;
  if (d ? 'caixa_inicial_padrao' and coalesce(interno.inteiro(d -> 'caixa_inicial_padrao'), -1) < 0)
    or (d ? 'diaria_padrao' and coalesce(interno.inteiro(d -> 'diaria_padrao'), -1) < 0) then
    perform interno.recusar('Valor inválido.', 'valor_invalido');
  end if;
  if d ? 'funcionalidades_desligadas' then
    if jsonb_typeof(d -> 'funcionalidades_desligadas') <> 'array' then
      perform interno.recusar('Dados inválidos.', 'dados_invalidos');
    end if;
    select coalesce(array_agg(distinct x), '{}') into v_desligadas
    from jsonb_array_elements_text(d -> 'funcionalidades_desligadas') x;
    if exists (select 1 from unnest(v_desligadas) x where x !~ '^[a-z_]{1,40}$') then
      perform interno.recusar('Nome de funcionalidade inválido.', 'dados_invalidos');
    end if;
  end if;
  update public.config set
    fuso = coalesce(d ->> 'fuso', fuso),
    ambiente = coalesce((d ->> 'ambiente')::public.ambiente, ambiente),
    caixa_inicial_padrao = coalesce(interno.inteiro(d -> 'caixa_inicial_padrao'), caixa_inicial_padrao),
    diaria_padrao = coalesce(interno.inteiro(d -> 'diaria_padrao'), diaria_padrao),
    funcionalidades_desligadas = coalesce(v_desligadas, funcionalidades_desligadas)
  where id = cfg.id;
  return jsonb_build_object('config_id', cfg.id);
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa() to authenticated;
