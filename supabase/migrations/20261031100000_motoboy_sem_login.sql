-- Decisão 0007: o motoboy não usa o sistema. Ele vira um cadastro (motoboys: nome e ativo), e caixas e
-- saídas apontam para o cadastro. Caixa e saída só mudam pela expedição, gerente e admin, e as políticas
-- perdem o ramo do motoboy. O valor 'motoboy' do enum papel fica sem uso (o Postgres não remove valor de enum).

-- Cadastro ---------------------------------------------------------------------------

create table public.motoboys (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger tocar_atualizado_em before update on public.motoboys
  for each row execute function interno.tocar_atualizado_em();
create trigger registrar_evento after insert or update or delete on public.motoboys
  for each row execute function interno.registrar_evento();

alter table public.motoboys enable row level security;
revoke all on public.motoboys from anon, authenticated;
grant select on public.motoboys to authenticated;
create policy motoboys_leitura on public.motoboys for select to authenticated
  using ((select interno.eh_equipe()));

alter publication supabase_realtime add table public.motoboys;

-- Quem já tinha caixa ou saída vira cadastro com o mesmo id: caixas e saídas continuam válidas.
insert into public.motoboys (id, nome, ativo)
select p.id, p.nome, p.ativo
from public.perfis p
where 'motoboy' = any (p.papeis)
  or exists (select 1 from public.caixas c where c.motoboy_id = p.id)
  or exists (select 1 from public.saidas s where s.motoboy_id = p.id)
on conflict (id) do nothing;

alter table public.caixas drop constraint caixas_motoboy_id_fkey;
alter table public.caixas add constraint caixas_motoboy_id_fkey
  foreign key (motoboy_id) references public.motoboys (id);
alter table public.saidas drop constraint saidas_motoboy_id_fkey;
alter table public.saidas add constraint saidas_motoboy_id_fkey
  foreign key (motoboy_id) references public.motoboys (id);

-- Ninguém entra mais como motoboy: sai o papel de quem tinha outro; quem só era motoboy fica inativo.
update public.perfis set papeis = array_remove(papeis, 'motoboy')
where 'motoboy' = any (papeis) and cardinality(papeis) > 1;
update public.perfis set ativo = false where papeis = '{motoboy}'::public.papel[];

-- Leitura só pela equipe do balcão ----------------------------------------------------------------

drop policy perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis for select to authenticated
  using (
    id = (select auth.uid())
    or (select interno.tem_papel('admin', 'gerente', 'expedicao', 'atendente', 'cozinha', 'garcom'))
  );

drop policy caixas_leitura on public.caixas;
create policy caixas_leitura on public.caixas for select to authenticated using ((select interno.eh_equipe()));
drop policy saidas_leitura on public.saidas;
create policy saidas_leitura on public.saidas for select to authenticated using ((select interno.eh_equipe()));
drop policy pedidos_leitura on public.pedidos;
create policy pedidos_leitura on public.pedidos for select to authenticated using ((select interno.eh_equipe()));
drop policy pagamentos_leitura on public.pagamentos;
create policy pagamentos_leitura on public.pagamentos for select to authenticated using ((select interno.eh_equipe()));
drop policy acertos_leitura on public.acertos;
create policy acertos_leitura on public.acertos for select to authenticated using ((select interno.eh_equipe()));
drop policy sobras_leitura on public.sobras;
create policy sobras_leitura on public.sobras for select to authenticated using ((select interno.eh_equipe()));
drop policy faltas_leitura on public.faltas;
create policy faltas_leitura on public.faltas for select to authenticated using ((select interno.eh_equipe()));

-- Operações de caixa e saída só pela equipe ---------------------------------------------------

create function interno.nome_motoboy(p_motoboy uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select m.nome from public.motoboys m where m.id = p_motoboy), '?')
$$;

-- ACE9: depois do acerto confirmado, ninguém mexe no caixa nem nas saídas (reabrir é do admin).
create or replace function interno.travar_caixa(
  p_caixa uuid, p_uid uuid, p_papeis public.papel[], p_prefixo text default null
) returns public.caixas
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  a public.acertos;
begin
  if not interno.eh_equipe_de(p_papeis) then
    perform interno.recusar('Sem permissão para isso.', 'sem_permissao');
  end if;
  select * into c from public.caixas where id = p_caixa for update;
  if not found then
    perform interno.recusar(interno.motivo(p_prefixo, 'caixa não encontrado.'), 'caixa_nao_encontrado');
  end if;
  perform interno.noite_aberta(c.noite_id, p_prefixo);
  select * into a from public.acertos where caixa_id = c.id and reaberto_em is null;
  if found then
    perform interno.recusar(
      interno.motivo(p_prefixo, 'o acerto já foi confirmado por ' || interno.nome(a.confirmado_por) || '.'),
      'acerto_confirmado');
  end if;
  return c;
end
$$;

create or replace function interno.op_abrir_caixa(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'caixa_id');
  v_motoboy uuid := interno.uuid_de(d ->> 'motoboy_id');
  n public.noites;
  cfg public.config;
  v_caixa integer;
  v_diaria integer;
  v_ordem smallint;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if v_id is null or v_motoboy is null then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  n := interno.noite_aberta(interno.uuid_de(d ->> 'noite_id'));
  perform 1 from public.noites where id = n.id for update;
  if not exists (select 1 from public.motoboys m where m.id = v_motoboy and m.ativo) then
    perform interno.recusar('Escolha um motoboy ativo do cadastro.', 'motoboy_invalido');
  end if;
  if exists (select 1 from public.caixas c where c.noite_id = n.id and c.motoboy_id = v_motoboy) then
    perform interno.recusar(interno.nome_motoboy(v_motoboy) || ' já tem caixa nesta noite.', 'caixa_repetido');
  end if;
  select * into cfg from public.config limit 1;
  -- ACE1 e ACE2: R$ 80 e R$ 30 já preenchidos e editáveis.
  v_caixa := coalesce(interno.inteiro(d -> 'caixa_inicial'), cfg.caixa_inicial_padrao);
  v_diaria := coalesce(interno.inteiro(d -> 'diaria'), cfg.diaria_padrao);
  if v_caixa < 0 or v_diaria < 0 then
    perform interno.recusar('Valor inválido.', 'valor_invalido');
  end if;
  select coalesce(max(c.ordem_chegada), 0) + 1 into v_ordem from public.caixas c where c.noite_id = n.id;
  insert into public.caixas (id, noite_id, motoboy_id, caixa_inicial, diaria, ordem_chegada, atualizado_por)
  values (v_id, n.id, v_motoboy, v_caixa, v_diaria, v_ordem, p_uid);
  return jsonb_build_object('caixa_id', v_id, 'ordem_chegada', v_ordem);
end
$$;

create or replace function interno.op_lancar_saida(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_codigo text := d ->> 'codigo';
  v_total integer := interno.inteiro(d -> 'total');
  v_pedido uuid := interno.uuid_de(d ->> 'pedido_id');
  v_saida uuid := interno.uuid_de(d ->> 'saida_id');
  c public.caixas;
  a public.areas;
  p public.pedidos;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if v_codigo is null or v_codigo !~ '^[0-9]{4}$' then
    perform interno.recusar('O código tem 4 dígitos.', 'codigo_invalido');
  end if;
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis, v_codigo);
  if v_pedido is null or v_saida is null then
    perform interno.recusar(interno.motivo(v_codigo, 'dados inválidos.'), 'dados_invalidos');
  end if;
  if v_total is null or v_total <= 0 then
    perform interno.recusar(interno.motivo(v_codigo, 'total inválido.'), 'total_invalido');
  end if;
  select * into a from public.areas where id = interno.uuid_de(d ->> 'area_id') and ativa;
  if not found then
    perform interno.recusar(interno.motivo(v_codigo, 'escolha a área.'), 'area_invalida');
  end if;
  perform interno.validar_pagamentos(v_total, d -> 'pagamentos', v_codigo);

  insert into public.pedidos (id, noite_id, codigo, origem, tipo, area_id, total, criado_por, atualizado_por)
  values (v_pedido, c.noite_id, v_codigo, 'papel', 'entrega', a.id, v_total, p_uid, p_uid)
  returning * into p;
  insert into public.saidas (id, noite_id, pedido_id, caixa_id, motoboy_id, area_id, taxa, estado, saiu_em)
  values (v_saida, c.noite_id, p.id, c.id, c.motoboy_id, a.id, a.taxa, 'em_rota', p_hora);
  perform interno.inserir_pagamentos(p, v_saida, d -> 'pagamentos', false, p_hora);
  perform interno.tocar_caixa(c.id, p_uid);
  return jsonb_build_object('pedido_id', p.id, 'saida_id', v_saida, 'taxa', a.taxa);
end
$$;

create or replace function interno.op_sair_de_novo(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  ant public.saidas;
  p public.pedidos;
  c public.caixas;
  a public.areas;
  v_nova uuid := interno.uuid_de(d ->> 'saida_id');
  v_caixa uuid := interno.uuid_de(d ->> 'caixa_id');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  select * into ant from public.saidas
  where id = interno.uuid_de(d ->> 'saida_anterior_id') and cancelada_em is null for update;
  if not found or v_nova is null then
    perform interno.recusar('Saída não encontrada.', 'saida_nao_encontrada');
  end if;
  select * into p from public.pedidos where id = ant.pedido_id for update;
  if ant.estado <> 'voltou' then
    perform interno.recusar(interno.motivo(p.codigo, 'só sai de novo o que voltou.'), 'nao_voltou');
  end if;
  if interno.saida_mais_recente(p.id) <> ant.id then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu de novo.'), 'saiu_de_novo');
  end if;
  -- O Luan escolhe com qual motoboy o pedido sai de novo.
  if v_caixa is null then
    perform interno.recusar(interno.motivo(p.codigo, 'escolha o motoboy.'), 'sem_caixa');
  end if;
  c := interno.travar_caixa(v_caixa, p_uid, p_papeis, p.codigo);
  if c.noite_id <> ant.noite_id then
    perform interno.recusar(interno.motivo(p.codigo, 'o caixa é de outra noite.'), 'outra_noite');
  end if;
  select * into a from public.areas
  where id = coalesce(interno.uuid_de(d ->> 'area_id'), ant.area_id) and ativa;
  if not found then
    perform interno.recusar(interno.motivo(p.codigo, 'escolha a área.'), 'area_invalida');
  end if;
  insert into public.saidas (id, noite_id, pedido_id, caixa_id, motoboy_id, area_id, taxa, estado, saiu_em)
  values (v_nova, c.noite_id, p.id, c.id, c.motoboy_id, a.id, a.taxa, 'em_rota', p_hora);
  -- Os pagamentos da porta passam para a nova saída; o Pix antecipado continua só no pedido.
  update public.pagamentos set saida_id = v_nova where saida_id = ant.id and anulado_em is null;
  perform interno.atualizar_estado_pedido(p.id);
  perform interno.tocar_pedido(p.id, p_uid);
  perform interno.tocar_caixa(c.id, p_uid);
  return jsonb_build_object('saida_id', v_nova, 'taxa', a.taxa);
end
$$;

create or replace function interno.op_pedir_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_impressa boolean := coalesce((d ->> 'impressa')::boolean, false);
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if v_id is null or d ->> 'tipo' not in ('recibo_acerto', 'folha_noite')
    or coalesce(length(d ->> 'conteudo'), 0) not between 1 and 20000 then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  insert into public.impressoes (id, noite_id, caixa_id, tipo, impressora, conteudo, estado, pedida_por, impressa_em)
  values (
    v_id, interno.uuid_de(d ->> 'noite_id'), interno.uuid_de(d ->> 'caixa_id'), (d ->> 'tipo')::public.tipo_impressao,
    coalesce(left(d ->> 'impressora', 40), 'balcao'), d ->> 'conteudo',
    case when v_impressa then 'impresso' else 'pendente' end::public.estado_impressao,
    p_uid, case when v_impressa then p_hora end
  );
  return jsonb_build_object('impressao_id', v_id);
end
$$;

-- Cadastro de motoboys (F1): gerente e admin. Desativar em vez de apagar: caixas antigos apontam para ele.
create function interno.op_salvar_motoboy(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'motoboy_id');
  v_nome text := nullif(trim(d ->> 'nome'), '');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente');
  if v_id is null or v_nome is null or length(v_nome) > 60 or jsonb_typeof(d -> 'ativo') <> 'boolean' then
    perform interno.recusar('Preencha o nome do motoboy.', 'dados_invalidos');
  end if;
  insert into public.motoboys (id, nome, ativo) values (v_id, v_nome, (d ->> 'ativo')::boolean)
  on conflict (id) do update set nome = excluded.nome, ativo = excluded.ativo;
  return jsonb_build_object('motoboy_id', v_id);
end
$$;

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
    ativo = coalesce((d ->> 'ativo')::boolean, ativo)
  where id = v_id;
  if not found then
    perform interno.recusar('Pessoa não encontrada.');
  end if;
  return jsonb_build_object('perfil_id', v_id);
end
$$;

create or replace function public.aplicar_operacao(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := interno.uuid_de(op ->> 'id');
  v_tipo text := op ->> 'tipo';
  v_dados jsonb := coalesce(op -> 'dados', '{}'::jsonb);
  v_versao_op integer := interno.inteiro(op -> 'versao_op');
  -- A hora que vale é a do servidor; a do aparelho só ordena a fila local e fica registrada.
  v_hora timestamptz := now();
  v_papeis public.papel[];
  v_existente public.operacoes;
  v_resultado jsonb;
  v_motivo text;
  v_codigo text;
  v_restricao text;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Faça login de novo.';
  end if;
  if v_id is null or v_tipo is null or jsonb_typeof(v_dados) <> 'object' then
    raise exception using errcode = '22023', message = 'Operação inválida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v_existente from public.operacoes where id = v_id;
  if found then
    if v_existente.autor <> v_uid then
      raise exception using errcode = '42501', message = 'Operação de outra pessoa.';
    end if;
    return jsonb_build_object(
      'id', v_id, 'status', v_existente.status, 'motivo', v_existente.motivo, 'codigo', v_existente.codigo,
      'resultado', v_existente.resultado, 'repetida', true);
  end if;

  -- App antigo demais: não recusa (a operação ficaria perdida); o app guarda a fila e pede para atualizar.
  if v_versao_op is null or v_versao_op not between interno.versao_op_atual() - 1 and interno.versao_op_atual() then
    raise exception using errcode = 'MEL02', message = 'Atualize o app para continuar.';
  end if;
  if interno.precisa_mfa() then
    raise exception using errcode = 'MEL03', message = 'Confirme o código do app autenticador.';
  end if;
  v_papeis := interno.meus_papeis();
  if cardinality(v_papeis) = 0 then
    raise exception using errcode = '42501', message = 'Conta sem acesso. Fale com o admin.';
  end if;

  perform set_config('mel.operacao_id', v_id::text, true);
  perform set_config('mel.autor', v_uid::text, true);

  begin
    v_resultado := case v_tipo
      when 'abrir_noite' then interno.op_abrir_noite(v_uid, v_papeis, v_dados, v_hora)
      when 'fechar_noite' then interno.op_fechar_noite(v_uid, v_papeis, v_dados, v_hora)
      when 'reabrir_noite' then interno.op_reabrir_noite(v_uid, v_papeis, v_dados, v_hora)
      when 'abrir_caixa' then interno.op_abrir_caixa(v_uid, v_papeis, v_dados, v_hora)
      when 'editar_caixa' then interno.op_editar_caixa(v_uid, v_papeis, v_dados, v_hora)
      when 'avisar_retorno' then interno.op_avisar_retorno(v_uid, v_papeis, v_dados, v_hora)
      when 'lancar_saida' then interno.op_lancar_saida(v_uid, v_papeis, v_dados, v_hora)
      when 'cancelar_saida' then interno.op_cancelar_saida(v_uid, v_papeis, v_dados, v_hora)
      when 'mudar_estado_saida' then interno.op_mudar_estado_saida(v_uid, v_papeis, v_dados, v_hora)
      when 'trocar_pagamento' then interno.op_trocar_pagamento(v_uid, v_papeis, v_dados, v_hora)
      when 'sair_de_novo' then interno.op_sair_de_novo(v_uid, v_papeis, v_dados, v_hora)
      when 'conferir_papel' then interno.op_conferir_papel(v_uid, v_papeis, v_dados, v_hora)
      when 'informar_contado' then interno.op_informar_contado(v_uid, v_papeis, v_dados, v_hora)
      when 'confirmar_acerto' then interno.op_confirmar_acerto(v_uid, v_papeis, v_dados, v_hora)
      when 'reabrir_acerto' then interno.op_reabrir_acerto(v_uid, v_papeis, v_dados, v_hora)
      when 'marcar_pix' then interno.op_marcar_pix(v_uid, v_papeis, v_dados, v_hora)
      when 'pedir_impressao' then interno.op_pedir_impressao(v_uid, v_papeis, v_dados, v_hora)
      when 'atualizar_impressao' then interno.op_atualizar_impressao(v_uid, v_papeis, v_dados, v_hora)
      when 'registrar_impressao_local' then interno.op_registrar_impressao_local(v_uid, v_papeis, v_dados, v_hora)
      when 'salvar_area' then interno.op_salvar_area(v_uid, v_papeis, v_dados, v_hora)
      when 'salvar_config' then interno.op_salvar_config(v_uid, v_papeis, v_dados, v_hora)
      when 'salvar_perfil' then interno.op_salvar_perfil(v_uid, v_papeis, v_dados, v_hora)
      when 'salvar_motoboy' then interno.op_salvar_motoboy(v_uid, v_papeis, v_dados, v_hora)
    end;
    if v_resultado is null then
      perform interno.recusar('Operação desconhecida.', 'operacao_desconhecida');
    end if;
  exception
    when sqlstate 'MEL01' then
      get stacked diagnostics v_motivo = message_text, v_codigo = pg_exception_detail;
    when integrity_constraint_violation then
      get stacked diagnostics v_restricao = constraint_name;
      v_motivo := 'Dados inválidos ou repetidos (' || coalesce(v_restricao, '?') || ').';
      v_codigo := 'dados_invalidos';
    when data_exception or invalid_text_representation then
      v_motivo := 'Dados inválidos.';
      v_codigo := 'dados_invalidos';
  end;

  insert into public.operacoes (id, tipo, dados, autor, aparelho, criada_em, versao_op, status, motivo, codigo, resultado)
  values (
    v_id, left(v_tipo, 40), v_dados, v_uid, left(op ->> 'aparelho', 80), interno.hora_ou_nulo(op ->> 'criada_em'),
    v_versao_op, case when v_motivo is null then 'aplicada' else 'recusada' end, v_motivo, v_codigo, v_resultado
  );
  return jsonb_build_object(
    'id', v_id,
    'status', case when v_motivo is null then 'aplicada' else 'recusada' end,
    'motivo', v_motivo,
    'codigo', v_codigo,
    'resultado', v_resultado
  );
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa() to authenticated;
revoke all on function public.aplicar_operacao(jsonb) from public, anon;
grant execute on function public.aplicar_operacao(jsonb) to authenticated;
