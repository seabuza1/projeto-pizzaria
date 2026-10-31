-- Etapa 5 (F1): despacho no painel do Luan, ordem de chegada editável, motivo ao desmarcar o Pix
-- e saída cancelada que devolve o pedido para a lista de despacho.

-- Pagamento previsto ------------------------------------------------------------------

-- O pagamento previsto na comanda do balcão fica sem saída até o despacho (PAG3); o Pix antecipado
-- continua sem saída sempre (PAG5).
alter table public.pagamentos drop constraint pagamentos_check1;
alter table public.pagamentos add constraint pagamentos_pix_sem_saida
  check (forma <> 'pix_antecipado' or saida_id is null);

-- Estado do pedido ------------------------------------------------------------------

-- A comanda de papel nasce com a saída: sem saída, o lançamento foi desfeito. O pedido do balcão
-- sem saída volta para a lista de despacho. Cancelado não volta.
create or replace function interno.atualizar_estado_pedido(p_pedido uuid) returns void
language sql set search_path = '' as $$
  update public.pedidos p
  set estado = case
    when p.estado = 'cancelado' then 'cancelado'
    when not exists (select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null) then
      case when p.origem = 'papel' then 'cancelado' else 'aberto' end
    when exists (
      select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null and s.estado = 'entregue'
    ) then 'entregue'
    else 'aberto'
  end::public.estado_pedido
  where p.id = p_pedido
$$;

-- Despacho (F1, ENT6) -------------------------------------------------------------------

-- O Luan toca nos códigos e no nome do motoboy: cada pedido ganha uma saída com a taxa da área (ENT2).
-- Tudo ou nada: se um dos pedidos já saiu, nenhum sai.
create function interno.op_despachar(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  p public.pedidos;
  a public.areas;
  x jsonb;
  v_saida uuid;
  v_com text;
  v_saidas jsonb := '[]'::jsonb;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if jsonb_typeof(d -> 'saidas') is distinct from 'array' or jsonb_array_length(d -> 'saidas') not between 1 and 10 then
    perform interno.recusar('Escolha os pedidos.', 'dados_invalidos');
  end if;
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis);
  for x in select * from jsonb_array_elements(d -> 'saidas') loop
    v_saida := interno.uuid_de(x ->> 'saida_id');
    select * into p from public.pedidos where id = interno.uuid_de(x ->> 'pedido_id') for update;
    if not found or v_saida is null then
      perform interno.recusar('Pedido não encontrado.', 'pedido_nao_encontrado');
    end if;
    if p.noite_id <> c.noite_id then
      perform interno.recusar(interno.motivo(p.codigo, 'o pedido é de outra noite.'), 'outra_noite');
    end if;
    select m.nome into v_com from public.saidas s join public.motoboys m on m.id = s.motoboy_id
    where s.pedido_id = p.id and s.cancelada_em is null
    order by s.criado_em desc limit 1;
    if v_com is not null then
      perform interno.recusar(interno.motivo(p.codigo, 'já saiu com ' || v_com || '.'), 'ja_saiu');
    end if;
    if p.tipo <> 'entrega' or p.estado <> 'aberto' then
      perform interno.recusar(interno.motivo(p.codigo, 'o pedido não está para entrega.'), 'nao_e_entrega');
    end if;
    select * into a from public.areas where id = p.area_id;
    if not found then
      perform interno.recusar(interno.motivo(p.codigo, 'o pedido está sem área.'), 'area_invalida');
    end if;
    insert into public.saidas (id, noite_id, pedido_id, caixa_id, motoboy_id, area_id, taxa, estado, saiu_em)
    values (v_saida, c.noite_id, p.id, c.id, c.motoboy_id, a.id, a.taxa, 'em_rota', p_hora);
    -- Os pagamentos previstos na comanda passam a ser desta saída; o Pix antecipado continua só no pedido.
    update public.pagamentos set saida_id = v_saida
    where pedido_id = p.id and saida_id is null and forma <> 'pix_antecipado' and anulado_em is null;
    perform interno.atualizar_estado_pedido(p.id);
    perform interno.tocar_pedido(p.id, p_uid);
    v_saidas := v_saidas || jsonb_build_object('pedido_id', p.id, 'saida_id', v_saida, 'taxa', a.taxa);
  end loop;
  perform interno.tocar_caixa(c.id, p_uid);
  return jsonb_build_object('saidas', v_saidas);
end
$$;

-- Desfazer ou cancelar a saída (OPE3). Com saída anterior, os pagamentos voltam para ela. Sem saída anterior:
-- a comanda de papel é desfeita inteira; o pedido do balcão volta para a lista de despacho, com os pagamentos
-- (ERROS-PREVISTOS: despachou para o motoboy errado).
create or replace function interno.op_cancelar_saida(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  p public.pedidos;
  v_anterior uuid;
  v_motivo text := coalesce(nullif(trim(d ->> 'motivo'), ''), 'Desfeito no app');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  select * into s from public.saidas where id = interno.uuid_de(d ->> 'saida_id') and cancelada_em is null for update;
  if not found then
    perform interno.recusar('Saída não encontrada.', 'saida_nao_encontrada');
  end if;
  select * into p from public.pedidos where id = s.pedido_id for update;
  perform interno.travar_caixa(s.caixa_id, p_uid, p_papeis, p.codigo);
  perform interno.conferir_versao(p.versao, interno.inteiro(d -> 'versao_esperada'), p.atualizado_por, p_uid,
    'este pedido', p.codigo);
  if interno.saida_mais_recente(p.id) <> s.id then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu de novo.'), 'saiu_de_novo');
  end if;
  select x.id into v_anterior from public.saidas x
  where x.pedido_id = p.id and x.id <> s.id and x.cancelada_em is null
  order by x.criado_em desc, x.id desc limit 1;

  update public.saidas
  set cancelada_em = now(), cancelada_por = p_uid, motivo_cancelamento = left(v_motivo, 300)
  where id = s.id;
  if v_anterior is not null then
    update public.pagamentos set saida_id = v_anterior where saida_id = s.id and anulado_em is null;
  elsif p.origem = 'papel' then
    update public.pagamentos
    set anulado_em = now(), anulado_por = p_uid, motivo_anulacao = left(v_motivo, 300)
    where pedido_id = p.id and anulado_em is null;
  else
    update public.pagamentos set saida_id = null where saida_id = s.id and anulado_em is null;
  end if;
  perform interno.atualizar_estado_pedido(p.id);
  perform interno.tocar_pedido(p.id, p_uid);
  perform interno.tocar_caixa(s.caixa_id, p_uid);
  return jsonb_build_object('saida_id', s.id, 'pedido_cancelado', v_anterior is null and p.origem = 'papel');
end
$$;

-- Ordem de chegada (ACE7) ---------------------------------------------------------------

-- ERROS-PREVISTOS: ordem de chegada errada. Muda até o primeiro acerto confirmado da noite.
create function interno.op_mudar_ordem_caixa(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  v_ordem integer := interno.inteiro(d -> 'ordem');
  v_total integer;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  select * into c from public.caixas where id = interno.uuid_de(d ->> 'caixa_id');
  if not found then
    perform interno.recusar('Caixa não encontrado.', 'caixa_nao_encontrado');
  end if;
  perform interno.noite_aberta(c.noite_id);
  perform 1 from public.caixas x where x.noite_id = c.noite_id order by x.id for update;
  if exists (
    select 1 from public.acertos a join public.caixas x on x.id = a.caixa_id
    where x.noite_id = c.noite_id and a.reaberto_em is null
  ) then
    perform interno.recusar('A ordem de chegada só muda antes do primeiro acerto.', 'ja_tem_acerto');
  end if;
  select count(*) into v_total from public.caixas where noite_id = c.noite_id;
  if v_ordem is null or v_ordem not between 1 and v_total then
    perform interno.recusar('Ordem inválida.', 'dados_invalidos');
  end if;
  -- unique (noite_id, ordem_chegada) não é adiável: passa por valores altos antes de renumerar.
  update public.caixas set ordem_chegada = ordem_chegada + 1000 where noite_id = c.noite_id;
  with chaves as (
    select x.id, row_number() over (order by x.ordem_chegada) * 2 as chave
    from public.caixas x where x.noite_id = c.noite_id and x.id <> c.id
    union all
    select c.id, v_ordem * 2 - 1
  ), nova as (
    select k.id, row_number() over (order by k.chave) as ordem from chaves k
  )
  update public.caixas x
  set ordem_chegada = nova.ordem, versao = x.versao + 1, atualizado_por = p_uid
  from nova where x.id = nova.id;
  return jsonb_build_object('caixa_id', c.id, 'ordem_chegada', v_ordem);
end
$$;

-- Pix antecipado (PAG5) --------------------------------------------------------------------

-- Desmarcar o "caiu" pede o motivo (ERROS-PREVISTOS: marcou o Pix errado). O motivo fica na operação,
-- ligada aos eventos da mudança (OPE2). Noite fechada só se lê.
create or replace function interno.op_marcar_pix(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  pg public.pagamentos;
  v_codigo text;
  v_ok boolean;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if jsonb_typeof(d -> 'confirmado') is distinct from 'boolean' then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  v_ok := (d ->> 'confirmado')::boolean;
  select * into pg from public.pagamentos
  where id = interno.uuid_de(d ->> 'pagamento_id') and forma = 'pix_antecipado' and anulado_em is null for update;
  if not found then
    perform interno.recusar('Pix não encontrado.', 'pix_nao_encontrado');
  end if;
  select codigo into v_codigo from public.pedidos where id = pg.pedido_id;
  perform interno.noite_aberta(pg.noite_id, v_codigo);
  if not v_ok and pg.pix_confirmado and coalesce(trim(d ->> 'motivo'), '') = '' then
    perform interno.recusar(interno.motivo(v_codigo, 'diga o motivo para desmarcar o Pix.'), 'sem_motivo');
  end if;
  update public.pagamentos
  set pix_confirmado = v_ok,
      pix_confirmado_por = case when v_ok then p_uid end,
      pix_confirmado_em = case when v_ok then now() end
  where id = pg.id;
  return jsonb_build_object('pagamento_id', pg.id);
end
$$;

-- aplicar_operacao: chama interno.op_<tipo>, sem lista para manter a cada operação nova ---------------------

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
    -- Cada operação é uma função interno.op_<tipo>; o tipo só tem letras e "_" (PADROES, Módulos removíveis).
    if v_tipo !~ '^[a-z_]{1,40}$'
      or to_regprocedure('interno.op_' || v_tipo || '(uuid, public.papel[], jsonb, timestamptz)') is null then
      perform interno.recusar('Operação desconhecida.', 'operacao_desconhecida');
    end if;
    execute format('select interno.%I($1, $2, $3, $4)', 'op_' || v_tipo)
      into v_resultado using v_uid, v_papeis, v_dados, v_hora;
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
