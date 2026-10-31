-- Etapa 8 (impressão sem fio): comanda na fila, batimento do agente e pedido de impressão idempotente.

alter table public.impressoes add column pedido_id uuid references public.pedidos (id);
create index impressoes_pedido on public.impressoes (pedido_id);

-- Robustez: o agente grava "vivo" a cada 30 s; sem sinal há 2 minutos, a tela mostra "Impressora sem resposta".
create table public.agentes (
  id uuid primary key references public.perfis (id) on delete cascade,
  impressora text check (length(impressora) <= 60),
  impressora_ok boolean not null default false,
  erro text check (length(erro) <= 300),
  versao text check (length(versao) <= 40),
  visto_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger tocar_atualizado_em before update on public.agentes
  for each row execute function interno.tocar_atualizado_em();
alter table public.agentes enable row level security;
revoke all on public.agentes from anon, authenticated;
grant select on public.agentes to authenticated;
create policy agentes_leitura on public.agentes for select to authenticated
  using (id = (select auth.uid()) or (select interno.eh_balcao()));
alter publication supabase_realtime add table public.agentes;

-- Fora de aplicar_operacao: um batimento a cada 30 s não é mudança de negócio e não vai para operacoes.
create function public.batimento_agente(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not ('agente' = any (interno.meus_papeis())) then
    raise exception using errcode = '42501', message = 'Só o agente de impressão.';
  end if;
  insert into public.agentes (id, impressora, impressora_ok, erro, versao, visto_em)
  values (
    v_uid, left(p ->> 'impressora', 60), coalesce((p ->> 'impressora_ok')::boolean, false),
    left(p ->> 'erro', 300), left(p ->> 'versao', 40), now()
  )
  on conflict (id) do update set
    impressora = excluded.impressora, impressora_ok = excluded.impressora_ok, erro = excluded.erro,
    versao = excluded.versao, visto_em = now();
end
$$;
revoke all on function public.batimento_agente(jsonb) from public, anon;
grant execute on function public.batimento_agente(jsonb) to authenticated;

-- A equipe do balcão pede a impressão (comanda ao autorizar, recibo ao confirmar o acerto, folha por botão).
-- Sem internet, o balcão manda direto ao agente pela rede local; o agente registra depois e o pedido chega
-- pela fila com o mesmo id: o segundo não é recusa, só completa o registro.
create or replace function interno.op_pedir_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_impressa boolean := coalesce((d ->> 'impressa')::boolean, false);
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  if v_id is null or d ->> 'tipo' not in ('recibo_acerto', 'folha_noite', 'comanda')
    or coalesce(length(d ->> 'conteudo'), 0) not between 1 and 20000 then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  insert into public.impressoes (
    id, noite_id, caixa_id, pedido_id, tipo, impressora, conteudo, estado, pedida_por, impressa_em
  ) values (
    v_id,
    (select n.id from public.noites n where n.id = interno.uuid_de(d ->> 'noite_id')),
    (select c.id from public.caixas c where c.id = interno.uuid_de(d ->> 'caixa_id')),
    (select p.id from public.pedidos p where p.id = interno.uuid_de(d ->> 'pedido_id')),
    (d ->> 'tipo')::public.tipo_impressao, coalesce(left(d ->> 'impressora', 40), 'balcao'), d ->> 'conteudo',
    case when v_impressa then 'impresso' else 'pendente' end::public.estado_impressao,
    p_uid, case when v_impressa then p_hora end
  )
  on conflict (id) do update set
    pedida_por = coalesce(public.impressoes.pedida_por, excluded.pedida_por),
    noite_id = coalesce(public.impressoes.noite_id, excluded.noite_id),
    caixa_id = coalesce(public.impressoes.caixa_id, excluded.caixa_id),
    pedido_id = coalesce(public.impressoes.pedido_id, excluded.pedido_id);
  return jsonb_build_object('impressao_id', v_id);
end
$$;

-- O agente imprimiu pela rede local (sem internet) e registra depois.
create or replace function interno.op_registrar_impressao_local(
  p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
begin
  perform interno.exigir(p_papeis, 'agente');
  if v_id is null or d ->> 'tipo' not in ('recibo_acerto', 'folha_noite', 'comanda')
    or coalesce(length(d ->> 'conteudo'), 0) not between 1 and 20000 then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  insert into public.impressoes (id, noite_id, caixa_id, pedido_id, tipo, conteudo, estado, pedida_por, impressa_em)
  values (
    v_id,
    (select n.id from public.noites n where n.id = interno.uuid_de(d ->> 'noite_id')),
    (select c.id from public.caixas c where c.id = interno.uuid_de(d ->> 'caixa_id')),
    (select p.id from public.pedidos p where p.id = interno.uuid_de(d ->> 'pedido_id')),
    (d ->> 'tipo')::public.tipo_impressao, d ->> 'conteudo', 'impresso', p_uid, p_hora
  )
  on conflict (id) do update set estado = 'impresso', impressa_em = coalesce(public.impressoes.impressa_em, excluded.impressa_em);
  return jsonb_build_object('impressao_id', v_id);
end
$$;

create or replace function interno.op_atualizar_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_estado text := d ->> 'estado';
begin
  perform interno.exigir(p_papeis, 'agente', 'admin');
  if v_estado is null or v_estado not in ('pendente', 'imprimindo', 'impresso', 'erro') then
    perform interno.recusar('Estado inválido.', 'dados_invalidos');
  end if;
  update public.impressoes
  set estado = v_estado::public.estado_impressao,
      tentativas = tentativas + case when v_estado = 'imprimindo' then 1 else 0 end,
      erro = case when v_estado = 'erro' then left(d ->> 'erro', 500) end,
      impressa_em = case when v_estado = 'impresso' then p_hora else impressa_em end
  where id = v_id;
  if not found then
    perform interno.recusar('Impressão não encontrada.', 'impressao_nao_encontrada');
  end if;
  return jsonb_build_object('impressao_id', v_id);
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa(), interno.eh_balcao() to authenticated;

-- O atendimento vê a fila de impressão (comanda impressa ou não, reimprimir).
drop policy impressoes_leitura on public.impressoes;
create policy impressoes_leitura on public.impressoes for select to authenticated
  using (
    (select interno.tem_papel('admin', 'gerente', 'expedicao', 'atendente', 'agente')) or pedida_por = (select auth.uid())
  );
