-- aplicar_operacao: a única porta de escrita das telas (ARQUITETURA, Funcionar sem internet).
-- Idempotente pelo id da operação; valida papel, estado, travas e valores; recusa com motivo.

-- Apoio -----------------------------------------------------------------------

create function interno.recusar(p_motivo text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'MEL01', message = p_motivo;
end
$$;

-- "3557: o acerto já foi..." ou "O acerto já foi..."
create function interno.motivo(p_prefixo text, p_texto text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_prefixo is null or p_prefixo = '' then upper(left(p_texto, 1)) || substr(p_texto, 2)
    else p_prefixo || ': ' || p_texto
  end
$$;

-- Centavos: número inteiro em JSON, ou null.
create function interno.inteiro(p_valor jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_valor) = 'number'
      and p_valor::numeric = trunc(p_valor::numeric)
      and abs(p_valor::numeric) <= 2000000000
    then p_valor::numeric::integer
  end
$$;

create function interno.uuid_de(p_valor text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p_valor::uuid;
exception when others then
  return null;
end
$$;

-- 4500 → "R$ 45,00", sem depender do locale do banco.
create function interno.reais(p_centavos bigint) returns text
language sql immutable set search_path = '' as $$
  select 'R$ ' || translate(to_char(p_centavos / 100.0, 'FM999,999,990.00'), ',.', '.,')
$$;

-- Hora do aparelho (a operação pode chegar depois, quando a internet voltar).
-- Fora de uma janela razoável, vale a hora do servidor.
create function interno.hora_do_aparelho(p_texto text) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  v timestamptz;
begin
  begin
    v := p_texto::timestamptz;
  exception when others then
    return now();
  end;
  if v is null or v > now() + interval '5 minutes' or v < now() - interval '36 hours' then
    return now();
  end if;
  return v;
end
$$;

-- Das 00h às 06h vale o dia anterior, no fuso da pizzaria (nunca o do aparelho).
create function interno.data_da_noite(p_hora timestamptz) returns date
language sql stable set search_path = '' as $$
  select ((p_hora at time zone (select c.fuso from public.config c limit 1)) - interval '6 hours')::date
$$;

create function interno.eh_equipe_de(p_papeis public.papel[]) returns boolean
language sql immutable set search_path = '' as $$
  select p_papeis && '{admin,gerente,expedicao}'::public.papel[]
$$;

create function interno.exigir(p_papeis public.papel[], variadic p_aceitos public.papel[]) returns void
language plpgsql set search_path = '' as $$
begin
  if not (p_papeis && p_aceitos) then
    perform interno.recusar('Sem permissão para isso.');
  end if;
end
$$;

create function interno.nome(p_perfil uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select p.nome from public.perfis p where p.id = p_perfil), '?')
$$;

create function interno.noite_aberta(p_noite uuid, p_prefixo text default null) returns public.noites
language plpgsql set search_path = '' as $$
declare
  n public.noites;
begin
  select * into n from public.noites where id = p_noite;
  if not found then
    perform interno.recusar(interno.motivo(p_prefixo, 'noite não encontrada.'));
  end if;
  if n.fechada_em is not null then
    perform interno.recusar(interno.motivo(p_prefixo, 'a noite já foi fechada.'));
  end if;
  return n;
end
$$;

-- ACE9: depois do acerto confirmado, ninguém mexe no caixa nem nas saídas (reabrir é do admin).
create function interno.travar_caixa(
  p_caixa uuid, p_uid uuid, p_papeis public.papel[], p_prefixo text default null
) returns public.caixas
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  a public.acertos;
begin
  select * into c from public.caixas where id = p_caixa for update;
  if not found then
    perform interno.recusar(interno.motivo(p_prefixo, 'caixa não encontrado.'));
  end if;
  if c.motoboy_id <> p_uid and not interno.eh_equipe_de(p_papeis) then
    perform interno.recusar(interno.motivo(p_prefixo, 'esse caixa é de outro motoboy.'));
  end if;
  perform interno.noite_aberta(c.noite_id, p_prefixo);
  select * into a from public.acertos where caixa_id = c.id and reaberto_em is null;
  if found then
    perform interno.recusar(
      interno.motivo(p_prefixo, 'o acerto já foi confirmado por ' || interno.nome(a.confirmado_por) || '.'));
  end if;
  return c;
end
$$;

-- PAG2 e PAG4, com as mesmas mensagens de packages/dominio/src/pagamento.ts.
create function interno.validar_pagamentos(p_total integer, p_pagamentos jsonb, p_prefixo text default null)
returns void
language plpgsql set search_path = '' as $$
declare
  x jsonb;
  v_soma bigint := 0;
  v_valor integer;
  v_troco integer;
  v_forma text;
begin
  if jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
    perform interno.recusar(interno.motivo(p_prefixo, 'escolha a forma de pagamento.'));
  end if;
  if jsonb_array_length(p_pagamentos) > 6 then
    perform interno.recusar(interno.motivo(p_prefixo, 'pagamentos demais.'));
  end if;
  for x in select * from jsonb_array_elements(p_pagamentos) loop
    v_forma := x ->> 'forma';
    if v_forma is null or v_forma not in ('dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado') then
      perform interno.recusar(interno.motivo(p_prefixo, 'forma de pagamento inválida.'));
    end if;
    if interno.uuid_de(x ->> 'id') is null then
      perform interno.recusar(interno.motivo(p_prefixo, 'pagamento sem id.'));
    end if;
    v_valor := interno.inteiro(x -> 'valor');
    if v_valor is null or v_valor <= 0 then
      perform interno.recusar(interno.motivo(p_prefixo, 'valor inválido no pagamento.'));
    end if;
    v_troco := coalesce(interno.inteiro(x -> 'troco_pix'), case when x ? 'troco_pix' then -1 else 0 end);
    if v_troco < 0 then
      perform interno.recusar(interno.motivo(p_prefixo, 'troco por Pix inválido.'));
    end if;
    if v_troco > 0 and v_forma <> 'dinheiro' then
      perform interno.recusar(interno.motivo(p_prefixo, 'troco por Pix só com parte em dinheiro.'));
    end if;
    v_soma := v_soma + v_valor;
  end loop;
  if v_soma <> p_total then
    perform interno.recusar(interno.motivo(p_prefixo,
      'os pagamentos somam ' || interno.reais(v_soma) || ' e o total é ' || interno.reais(p_total) || '.'));
  end if;
end
$$;

create function interno.saida_mais_recente(p_pedido uuid) returns uuid
language sql stable set search_path = '' as $$
  select s.id from public.saidas s where s.pedido_id = p_pedido order by s.criado_em desc, s.id desc limit 1
$$;

create function interno.atualizar_estado_pedido(p_pedido uuid) returns void
language sql set search_path = '' as $$
  update public.pedidos p
  set estado = case
    when exists (select 1 from public.saidas s where s.pedido_id = p.id and s.estado = 'entregue') then 'entregue'
    else 'aberto'
  end::public.estado_pedido
  where p.id = p_pedido
$$;

create function interno.inserir_pagamentos(
  p_pedido public.pedidos, p_saida uuid, p_pagamentos jsonb, p_real boolean, p_hora timestamptz
) returns void
language sql set search_path = '' as $$
  insert into public.pagamentos (
    id, noite_id, pedido_id, saida_id, forma, valor, troco_pix, real, registrado_em,
    pix_confirmado, pix_confirmado_por, pix_confirmado_em
  )
  select
    (x ->> 'id')::uuid,
    p_pedido.noite_id,
    p_pedido.id,
    case when x ->> 'forma' = 'pix_antecipado' then null else p_saida end,
    (x ->> 'forma')::public.forma_pagamento,
    interno.inteiro(x -> 'valor'),
    coalesce(interno.inteiro(x -> 'troco_pix'), 0),
    p_real,
    p_hora,
    -- Na troca de forma, um Pix antecipado que já "caiu" continua confirmado.
    conf.id is not null,
    conf.pix_confirmado_por,
    conf.pix_confirmado_em
  from jsonb_array_elements(p_pagamentos) x
  left join lateral (
    select o.id, o.pix_confirmado_por, o.pix_confirmado_em
    from public.pagamentos o
    where o.pedido_id = p_pedido.id and o.forma = 'pix_antecipado' and o.pix_confirmado
      and o.valor = interno.inteiro(x -> 'valor')
    order by o.pix_confirmado_em
    limit 1
  ) conf on x ->> 'forma' = 'pix_antecipado'
$$;

-- Noite e caixas --------------------------------------------------------------

create function interno.op_abrir_noite(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'noite_id');
  v_data date := interno.data_da_noite(p_hora);
  n public.noites;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if v_id is null then
    perform interno.recusar('Dados inválidos.');
  end if;
  select * into n from public.noites where data = v_data;
  if found then
    perform interno.recusar('A noite de ' || to_char(v_data, 'DD/MM') || ' já está aberta.');
  end if;
  insert into public.noites (id, data, aberta_em, aberta_por) values (v_id, v_data, p_hora, p_uid);
  return jsonb_build_object('noite_id', v_id, 'data', v_data);
end
$$;

create function interno.op_fechar_noite(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n public.noites;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  n := interno.noite_aberta(interno.uuid_de(d ->> 'noite_id'));
  update public.noites set fechada_em = now(), fechada_por = p_uid where id = n.id;
  return jsonb_build_object('noite_id', n.id);
end
$$;

create function interno.op_reabrir_noite(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'noite_id');
begin
  perform interno.exigir(p_papeis, 'admin');
  update public.noites set fechada_em = null, fechada_por = null where id = v_id and fechada_em is not null;
  if not found then
    perform interno.recusar('Essa noite não está fechada.');
  end if;
  return jsonb_build_object('noite_id', v_id);
end
$$;

create function interno.op_abrir_caixa(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
    perform interno.recusar('Dados inválidos.');
  end if;
  n := interno.noite_aberta(interno.uuid_de(d ->> 'noite_id'));
  perform 1 from public.noites where id = n.id for update;
  if not exists (
    select 1 from public.perfis p where p.id = v_motoboy and p.ativo and 'motoboy' = any (p.papeis)
  ) then
    perform interno.recusar('Escolha um motoboy ativo.');
  end if;
  if exists (select 1 from public.caixas c where c.noite_id = n.id and c.motoboy_id = v_motoboy) then
    perform interno.recusar(interno.nome(v_motoboy) || ' já tem caixa nesta noite.');
  end if;
  select * into cfg from public.config limit 1;
  -- ACE1 e ACE2: R$ 80 e R$ 30 já preenchidos e editáveis.
  v_caixa := coalesce(interno.inteiro(d -> 'caixa_inicial'), cfg.caixa_inicial_padrao);
  v_diaria := coalesce(interno.inteiro(d -> 'diaria'), cfg.diaria_padrao);
  if v_caixa < 0 or v_diaria < 0 then
    perform interno.recusar('Valor inválido.');
  end if;
  select coalesce(max(c.ordem_chegada), 0) + 1 into v_ordem from public.caixas c where c.noite_id = n.id;
  insert into public.caixas (id, noite_id, motoboy_id, caixa_inicial, diaria, ordem_chegada)
  values (v_id, n.id, v_motoboy, v_caixa, v_diaria, v_ordem);
  return jsonb_build_object('caixa_id', v_id, 'ordem_chegada', v_ordem);
end
$$;

create function interno.op_editar_caixa(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  v_caixa integer := interno.inteiro(d -> 'caixa_inicial');
  v_diaria integer := interno.inteiro(d -> 'diaria');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis);
  if (d ? 'caixa_inicial' and (v_caixa is null or v_caixa < 0)) or (d ? 'diaria' and (v_diaria is null or v_diaria < 0))
  then
    perform interno.recusar('Valor inválido.');
  end if;
  update public.caixas
  set caixa_inicial = coalesce(v_caixa, caixa_inicial), diaria = coalesce(v_diaria, diaria)
  where id = c.id;
  return jsonb_build_object('caixa_id', c.id);
end
$$;

create function interno.op_avisar_retorno(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  v_minutos integer := interno.inteiro(d -> 'minutos');
begin
  select * into c from public.caixas where id = interno.uuid_de(d ->> 'caixa_id');
  if not found or (c.motoboy_id <> p_uid and not interno.eh_equipe_de(p_papeis)) then
    perform interno.recusar('Caixa não encontrado.');
  end if;
  perform interno.noite_aberta(c.noite_id);
  if v_minutos is not null and (v_minutos < 1 or v_minutos > 60) then
    perform interno.recusar('Valor inválido.');
  end if;
  update public.caixas
  set retorno_em = case when v_minutos is null then null else p_hora + make_interval(mins => v_minutos) end
  where id = c.id;
  return jsonb_build_object('caixa_id', c.id);
end
$$;

-- Saídas e pagamentos ---------------------------------------------------------

create function interno.op_lancar_saida(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'motoboy');
  if v_codigo is null or v_codigo !~ '^[0-9]{4}$' then
    perform interno.recusar('O código tem 4 dígitos.');
  end if;
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis, v_codigo);
  if v_pedido is null or v_saida is null then
    perform interno.recusar(interno.motivo(v_codigo, 'dados inválidos.'));
  end if;
  if v_total is null or v_total <= 0 then
    perform interno.recusar(interno.motivo(v_codigo, 'total inválido.'));
  end if;
  select * into a from public.areas where id = interno.uuid_de(d ->> 'area_id') and ativa;
  if not found then
    perform interno.recusar(interno.motivo(v_codigo, 'escolha a área.'));
  end if;
  perform interno.validar_pagamentos(v_total, d -> 'pagamentos', v_codigo);

  insert into public.pedidos (id, noite_id, codigo, origem, tipo, area_id, total, criado_por)
  values (v_pedido, c.noite_id, v_codigo, 'papel', 'entrega', a.id, v_total, p_uid)
  returning * into p;
  insert into public.saidas (id, noite_id, pedido_id, caixa_id, motoboy_id, area_id, taxa, estado, saiu_em)
  values (v_saida, c.noite_id, p.id, c.id, c.motoboy_id, a.id, a.taxa, 'em_rota', p_hora);
  perform interno.inserir_pagamentos(p, v_saida, d -> 'pagamentos', false, p_hora);
  return jsonb_build_object('pedido_id', p.id, 'saida_id', v_saida, 'taxa', a.taxa);
end
$$;

-- Desfazer: o lançamento inteiro (saída única) ou um "saiu de novo".
create function interno.op_cancelar_saida(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  p public.pedidos;
  v_anterior uuid;
begin
  select * into s from public.saidas where id = interno.uuid_de(d ->> 'saida_id') for update;
  if not found then
    perform interno.recusar('Saída não encontrada.');
  end if;
  select * into p from public.pedidos where id = s.pedido_id for update;
  perform interno.travar_caixa(s.caixa_id, p_uid, p_papeis, p.codigo);
  if interno.saida_mais_recente(p.id) <> s.id then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu de novo.'));
  end if;
  select x.id into v_anterior from public.saidas x
  where x.pedido_id = p.id and x.id <> s.id order by x.criado_em desc, x.id desc limit 1;

  if v_anterior is null then
    delete from public.pagamentos where pedido_id = p.id;
    delete from public.saidas where id = s.id;
    delete from public.pedidos where id = p.id;
  else
    update public.pagamentos set saida_id = v_anterior where saida_id = s.id;
    delete from public.saidas where id = s.id;
    perform interno.atualizar_estado_pedido(p.id);
  end if;
  return jsonb_build_object('saida_id', s.id, 'pedido_apagado', v_anterior is null);
end
$$;

create function interno.op_mudar_estado_saida(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  v_codigo text;
  v_estado text := d ->> 'estado';
begin
  if v_estado is null or v_estado not in ('em_rota', 'entregue', 'voltou') then
    perform interno.recusar('Estado inválido.');
  end if;
  select * into s from public.saidas where id = interno.uuid_de(d ->> 'saida_id') for update;
  if not found then
    perform interno.recusar('Saída não encontrada.');
  end if;
  select codigo into v_codigo from public.pedidos where id = s.pedido_id;
  perform interno.travar_caixa(s.caixa_id, p_uid, p_papeis, v_codigo);
  if interno.saida_mais_recente(s.pedido_id) <> s.id then
    perform interno.recusar(interno.motivo(v_codigo, 'o pedido já saiu de novo.'));
  end if;
  update public.saidas
  set estado = v_estado::public.estado_saida,
      entregue_em = case when v_estado = 'entregue' then p_hora end,
      voltou_em = case when v_estado = 'voltou' then p_hora end
  where id = s.id;
  perform interno.atualizar_estado_pedido(s.pedido_id);
  return jsonb_build_object('saida_id', s.id, 'estado', v_estado);
end
$$;

-- PAG3: a forma real substitui a prevista. Lista vazia volta para a prevista (desfazer).
create function interno.op_trocar_pagamento(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  p public.pedidos;
  v_novos jsonb := coalesce(d -> 'pagamentos', '[]'::jsonb);
  v_ids uuid[];
begin
  select * into s from public.saidas where id = interno.uuid_de(d ->> 'saida_id') for update;
  if not found then
    perform interno.recusar('Saída não encontrada.');
  end if;
  select * into p from public.pedidos where id = s.pedido_id for update;
  perform interno.travar_caixa(s.caixa_id, p_uid, p_papeis, p.codigo);
  if s.estado = 'voltou' then
    perform interno.recusar(interno.motivo(p.codigo, 'essa saída voltou.'));
  end if;
  if interno.saida_mais_recente(p.id) <> s.id then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu de novo.'));
  end if;
  if jsonb_typeof(v_novos) <> 'array' then
    perform interno.recusar(interno.motivo(p.codigo, 'dados inválidos.'));
  end if;
  if jsonb_array_length(v_novos) > 0 then
    perform interno.validar_pagamentos(p.total, v_novos, p.codigo);
  end if;
  select coalesce(array_agg((x ->> 'id')::uuid), '{}') into v_ids from jsonb_array_elements(v_novos) x;
  perform interno.inserir_pagamentos(p, s.id, v_novos, true, p_hora);
  delete from public.pagamentos where pedido_id = p.id and real and not (id = any (v_ids));
  return jsonb_build_object('saida_id', s.id);
end
$$;

-- ENT4: o pedido que voltou sai de novo, com outra saída e outra taxa.
create function interno.op_sair_de_novo(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'motoboy');
  select * into ant from public.saidas where id = interno.uuid_de(d ->> 'saida_anterior_id') for update;
  if not found or v_nova is null then
    perform interno.recusar('Saída não encontrada.');
  end if;
  select * into p from public.pedidos where id = ant.pedido_id for update;
  if ant.estado <> 'voltou' then
    perform interno.recusar(interno.motivo(p.codigo, 'só sai de novo o que voltou.'));
  end if;
  if interno.saida_mais_recente(p.id) <> ant.id then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu de novo.'));
  end if;
  if v_caixa is null then
    select x.id into v_caixa from public.caixas x where x.noite_id = ant.noite_id and x.motoboy_id = p_uid;
    if v_caixa is null then
      perform interno.recusar(interno.motivo(p.codigo, 'você não tem caixa nesta noite.'));
    end if;
  end if;
  c := interno.travar_caixa(v_caixa, p_uid, p_papeis, p.codigo);
  if c.noite_id <> ant.noite_id then
    perform interno.recusar(interno.motivo(p.codigo, 'o caixa é de outra noite.'));
  end if;
  select * into a from public.areas
  where id = coalesce(interno.uuid_de(d ->> 'area_id'), ant.area_id) and ativa;
  if not found then
    perform interno.recusar(interno.motivo(p.codigo, 'escolha a área.'));
  end if;
  insert into public.saidas (id, noite_id, pedido_id, caixa_id, motoboy_id, area_id, taxa, estado, saiu_em)
  values (v_nova, c.noite_id, p.id, c.id, c.motoboy_id, a.id, a.taxa, 'em_rota', p_hora);
  -- Os pagamentos da porta passam para a nova saída; o Pix antecipado continua só no pedido.
  update public.pagamentos set saida_id = v_nova where saida_id = ant.id;
  perform interno.atualizar_estado_pedido(p.id);
  return jsonb_build_object('saida_id', v_nova, 'taxa', a.taxa);
end
$$;

-- Acerto ----------------------------------------------------------------------

create function interno.op_conferir_papel(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'saida_id');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if jsonb_typeof(d -> 'conferido') <> 'boolean' then
    perform interno.recusar('Dados inválidos.');
  end if;
  update public.saidas set papel_conferido = (d ->> 'conferido')::boolean where id = v_id;
  if not found then
    perform interno.recusar('Saída não encontrada.');
  end if;
  return jsonb_build_object('saida_id', v_id);
end
$$;

create function interno.op_informar_contado(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  v_contado integer := interno.inteiro(d -> 'dinheiro_contado');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis);
  if jsonb_typeof(d -> 'dinheiro_contado') <> 'null' and (v_contado is null or v_contado < 0) then
    perform interno.recusar('Valor inválido.');
  end if;
  update public.caixas set dinheiro_contado = v_contado where id = c.id;
  return jsonb_build_object('caixa_id', c.id);
end
$$;

create function interno.op_confirmar_acerto(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  v jsonb;
  l jsonb;
  e jsonb := d -> 'esperado';
  v_id uuid := interno.uuid_de(d ->> 'acerto_id');
  k text;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis);
  if v_id is null or jsonb_typeof(e) <> 'object' then
    perform interno.recusar('Dados inválidos.');
  end if;
  if c.dinheiro_contado is null then
    perform interno.recusar('Informe o dinheiro contado.');
  end if;
  if length(coalesce(d -> 'conta', '{}'::jsonb)::text) > 60000 then
    perform interno.recusar('Dados inválidos.');
  end if;
  v := interno.conta_caixa(c.id, c.dinheiro_contado);
  l := v -> 'liquidacao';
  -- O Luan confirma o que viu na tela. Se a conta mudou no caminho, ele confere de novo.
  foreach k in array array['devolver', 'maquininha', 'receber'] loop
    if (e -> k) is distinct from (v -> k) then
      perform interno.recusar('A conta mudou desde que você abriu. Confira de novo.');
    end if;
  end loop;
  foreach k in array array['dinheiroContado', 'pagar', 'doCaixaDele', 'retiradoCaixaEmpresa', 'vaiParaEmpresa'] loop
    if (e -> k) is distinct from (l -> k) then
      perform interno.recusar('A conta mudou desde que você abriu. Confira de novo.');
    end if;
  end loop;

  insert into public.acertos (
    id, noite_id, caixa_id, dinheiro_contado, devolver, maquininha, receber, falta, sobra, pagar, completa,
    do_caixa_dele, retirado_caixa_empresa, vai_para_empresa, conta, confirmado_por, confirmado_em
  ) values (
    v_id, c.noite_id, c.id, c.dinheiro_contado,
    (v ->> 'devolver')::integer, (v ->> 'maquininha')::integer, (v ->> 'receber')::integer,
    (l ->> 'falta')::integer, (l ->> 'sobra')::integer, (l ->> 'pagar')::integer, (l ->> 'completa')::integer,
    (l ->> 'doCaixaDele')::integer, (l ->> 'retiradoCaixaEmpresa')::integer, (l ->> 'vaiParaEmpresa')::integer,
    coalesce(d -> 'conta', '{}'::jsonb) || jsonb_build_object('servidor', v),
    p_uid, now()
  );
  if (l ->> 'sobra')::integer > 0 then
    insert into public.sobras (caixa_id, acerto_id, valor) values (c.id, v_id, (l ->> 'sobra')::integer);
  end if;
  if (l ->> 'falta')::integer > 0 then
    insert into public.faltas (caixa_id, acerto_id, valor) values (c.id, v_id, (l ->> 'falta')::integer);
  end if;
  update public.caixas set fechado_em = now() where id = c.id;
  return jsonb_build_object('acerto_id', v_id, 'conta', v);
end
$$;

create function interno.op_reabrir_acerto(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  a public.acertos;
begin
  perform interno.exigir(p_papeis, 'admin');
  select * into a from public.acertos
  where caixa_id = interno.uuid_de(d ->> 'caixa_id') and reaberto_em is null for update;
  if not found then
    perform interno.recusar('Esse caixa não tem acerto confirmado.');
  end if;
  perform interno.noite_aberta(a.noite_id);
  update public.acertos set reaberto_em = now(), reaberto_por = p_uid where id = a.id;
  delete from public.sobras where acerto_id = a.id;
  delete from public.faltas where acerto_id = a.id;
  update public.caixas set fechado_em = null where id = a.caixa_id;
  return jsonb_build_object('caixa_id', a.caixa_id);
end
$$;

-- PAG5: o Luan marca "caiu" à mão na fase 1.
create function interno.op_marcar_pix(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'pagamento_id');
  v_ok boolean;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  if jsonb_typeof(d -> 'confirmado') <> 'boolean' then
    perform interno.recusar('Dados inválidos.');
  end if;
  v_ok := (d ->> 'confirmado')::boolean;
  update public.pagamentos
  set pix_confirmado = v_ok,
      pix_confirmado_por = case when v_ok then p_uid end,
      pix_confirmado_em = case when v_ok then now() end
  where id = v_id and forma = 'pix_antecipado';
  if not found then
    perform interno.recusar('Pix não encontrado.');
  end if;
  return jsonb_build_object('pagamento_id', v_id);
end
$$;

-- Impressão -------------------------------------------------------------------

create function interno.op_pedir_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_caixa uuid := interno.uuid_de(d ->> 'caixa_id');
  v_impressa boolean := coalesce((d ->> 'impressa')::boolean, false);
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'motoboy');
  if v_id is null or d ->> 'tipo' not in ('recibo_acerto', 'folha_noite')
    or coalesce(length(d ->> 'conteudo'), 0) not between 1 and 20000 then
    perform interno.recusar('Dados inválidos.');
  end if;
  -- O motoboy só pede a impressão do próprio caixa.
  if not interno.eh_equipe_de(p_papeis) and not exists (
    select 1 from public.caixas c where c.id = v_caixa and c.motoboy_id = p_uid
  ) then
    perform interno.recusar('Sem permissão para isso.');
  end if;
  insert into public.impressoes (id, noite_id, caixa_id, tipo, impressora, conteudo, estado, pedida_por, impressa_em)
  values (
    v_id, interno.uuid_de(d ->> 'noite_id'), v_caixa, (d ->> 'tipo')::public.tipo_impressao,
    coalesce(left(d ->> 'impressora', 40), 'balcao'), d ->> 'conteudo',
    case when v_impressa then 'impresso' else 'pendente' end::public.estado_impressao,
    p_uid, case when v_impressa then p_hora end
  );
  return jsonb_build_object('impressao_id', v_id);
end
$$;

create function interno.op_atualizar_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_estado text := d ->> 'estado';
begin
  perform interno.exigir(p_papeis, 'agente', 'admin');
  if v_estado is null or v_estado not in ('pendente', 'imprimindo', 'impresso', 'erro') then
    perform interno.recusar('Estado inválido.');
  end if;
  update public.impressoes
  set estado = v_estado::public.estado_impressao,
      tentativas = tentativas + case when v_estado = 'imprimindo' then 1 else 0 end,
      erro = case when v_estado = 'erro' then left(d ->> 'erro', 500) end,
      impressa_em = case when v_estado = 'impresso' then p_hora else impressa_em end
  where id = v_id;
  if not found then
    perform interno.recusar('Impressão não encontrada.');
  end if;
  return jsonb_build_object('impressao_id', v_id);
end
$$;

-- O agente imprimiu pela rede local sem internet e registra depois.
create function interno.op_registrar_impressao_local(
  p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
begin
  perform interno.exigir(p_papeis, 'agente');
  if v_id is null or d ->> 'tipo' not in ('recibo_acerto', 'folha_noite')
    or coalesce(length(d ->> 'conteudo'), 0) not between 1 and 20000 then
    perform interno.recusar('Dados inválidos.');
  end if;
  insert into public.impressoes (id, noite_id, caixa_id, tipo, conteudo, estado, pedida_por, impressa_em)
  values (
    v_id,
    (select n.id from public.noites n where n.id = interno.uuid_de(d ->> 'noite_id')),
    (select c.id from public.caixas c where c.id = interno.uuid_de(d ->> 'caixa_id')),
    (d ->> 'tipo')::public.tipo_impressao, d ->> 'conteudo', 'impresso', p_uid, p_hora
  )
  on conflict (id) do update set estado = 'impresso', impressa_em = excluded.impressa_em;
  return jsonb_build_object('impressao_id', v_id);
end
$$;

-- Cadastros -------------------------------------------------------------------

-- ENT1: a tabela de áreas é editável.
create function interno.op_salvar_area(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'area_id');
  v_taxa integer := interno.inteiro(d -> 'taxa');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente');
  if v_id is null or v_taxa is null or v_taxa < 0 or coalesce(trim(d ->> 'nome'), '') = ''
    or coalesce(trim(d ->> 'cidade'), '') = '' then
    perform interno.recusar('Preencha nome, cidade e taxa.');
  end if;
  insert into public.areas (id, nome, cidade, taxa, ativa, ordem)
  values (
    v_id, trim(d ->> 'nome'), trim(d ->> 'cidade'), v_taxa, coalesce((d ->> 'ativa')::boolean, true),
    coalesce(interno.inteiro(d -> 'ordem'), 0)
  )
  on conflict (id) do update set
    nome = excluded.nome, cidade = excluded.cidade, taxa = excluded.taxa, ativa = excluded.ativa,
    ordem = excluded.ordem;
  return jsonb_build_object('area_id', v_id);
end
$$;

create function interno.op_salvar_config(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  cfg public.config;
begin
  perform interno.exigir(p_papeis, 'admin');
  select * into cfg from public.config limit 1 for update;
  if d ? 'fuso' and not exists (select 1 from pg_catalog.pg_timezone_names where name = d ->> 'fuso') then
    perform interno.recusar('Fuso inválido.');
  end if;
  if d ? 'ambiente' and d ->> 'ambiente' not in ('producao', 'teste') then
    perform interno.recusar('Ambiente inválido.');
  end if;
  if (d ? 'caixa_inicial_padrao' and coalesce(interno.inteiro(d -> 'caixa_inicial_padrao'), -1) < 0)
    or (d ? 'diaria_padrao' and coalesce(interno.inteiro(d -> 'diaria_padrao'), -1) < 0) then
    perform interno.recusar('Valor inválido.');
  end if;
  update public.config set
    fuso = coalesce(d ->> 'fuso', fuso),
    ambiente = coalesce((d ->> 'ambiente')::public.ambiente, ambiente),
    caixa_inicial_padrao = coalesce(interno.inteiro(d -> 'caixa_inicial_padrao'), caixa_inicial_padrao),
    diaria_padrao = coalesce(interno.inteiro(d -> 'diaria_padrao'), diaria_padrao)
  where id = cfg.id;
  return jsonb_build_object('config_id', cfg.id);
end
$$;

create function interno.op_salvar_perfil(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
      perform interno.recusar('Escolha ao menos um papel.');
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

-- A porta -----------------------------------------------------------------------

create function public.aplicar_operacao(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := interno.uuid_de(op ->> 'id');
  v_tipo text := op ->> 'tipo';
  v_dados jsonb := coalesce(op -> 'dados', '{}'::jsonb);
  v_hora timestamptz := interno.hora_do_aparelho(op ->> 'criada_em');
  v_papeis public.papel[];
  v_existente public.operacoes;
  v_resultado jsonb;
  v_motivo text;
  v_restricao text;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Faça login de novo.';
  end if;
  if v_id is null or v_tipo is null or jsonb_typeof(v_dados) <> 'object' then
    raise exception using errcode = '22023', message = 'Operação inválida.';
  end if;

  -- Duas chamadas com o mesmo id (reenvio da fila) não se cruzam.
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v_existente from public.operacoes where id = v_id;
  if found then
    if v_existente.autor <> v_uid then
      raise exception using errcode = '42501', message = 'Operação de outra pessoa.';
    end if;
    return jsonb_build_object(
      'id', v_id, 'status', v_existente.status, 'motivo', v_existente.motivo,
      'resultado', v_existente.resultado, 'repetida', true);
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
    end;
    if v_resultado is null then
      perform interno.recusar('Operação desconhecida.');
    end if;
  exception
    when sqlstate 'MEL01' then
      get stacked diagnostics v_motivo = message_text;
    when integrity_constraint_violation then
      get stacked diagnostics v_restricao = constraint_name;
      v_motivo := 'Dados inválidos ou repetidos (' || coalesce(v_restricao, '?') || ').';
    when data_exception or invalid_text_representation then
      v_motivo := 'Dados inválidos.';
  end;

  insert into public.operacoes (id, tipo, dados, autor, aparelho, criada_em, status, motivo, resultado)
  values (
    v_id, left(v_tipo, 40), v_dados, v_uid, left(op ->> 'aparelho', 80), v_hora,
    case when v_motivo is null then 'aplicada' else 'recusada' end, v_motivo, v_resultado
  );
  return jsonb_build_object(
    'id', v_id,
    'status', case when v_motivo is null then 'aplicada' else 'recusada' end,
    'motivo', v_motivo,
    'resultado', v_resultado
  );
end
$$;

-- Área do último pedido com o mesmo código (sugestão no lançamento).
create function public.area_sugerida(p_codigo text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.area_id
  from public.pedidos p
  where interno.eh_ativo() and p.codigo = p_codigo and p.area_id is not null
  order by p.criado_em desc
  limit 1
$$;

-- Erros do front e do agente, sem dados de cliente (números longos são mascarados).
create function public.registrar_erro(p_erro jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or jsonb_typeof(p_erro) <> 'object' then
    return;
  end if;
  if (select count(*) from public.erros e where e.autor = v_uid and e.criado_em > now() - interval '10 minutes') >= 30
  then
    return;
  end if;
  insert into public.erros (origem, mensagem, pilha, contexto, versao, autor)
  values (
    case when p_erro ->> 'origem' in ('web', 'agente') then p_erro ->> 'origem' else 'web' end,
    regexp_replace(left(coalesce(p_erro ->> 'mensagem', '?'), 1000), '[0-9]{8,}', '[número]', 'g'),
    regexp_replace(left(p_erro ->> 'pilha', 8000), '[0-9]{8,}', '[número]', 'g'),
    case
      when jsonb_typeof(p_erro -> 'contexto') = 'object' and length((p_erro -> 'contexto')::text) <= 4000
      then p_erro -> 'contexto'
    end,
    left(p_erro ->> 'versao', 40),
    v_uid
  );
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo() to authenticated;

revoke all on function public.aplicar_operacao(jsonb) from public, anon;
revoke all on function public.area_sugerida(text) from public, anon;
revoke all on function public.registrar_erro(jsonb) from public, anon;
grant execute on function public.aplicar_operacao(jsonb) to authenticated;
grant execute on function public.area_sugerida(text) to authenticated;
grant execute on function public.registrar_erro(jsonb) to authenticated;
