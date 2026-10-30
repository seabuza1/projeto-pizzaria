-- Ajustes de docs/PADROES.md e ARQUITETURA (Conflitos e concorrência, Robustez):
-- versão por linha, horário do servidor, versao_op, dinheiro só se acrescenta (OPE3), MFA e código das recusas.

-- Colunas ------------------------------------------------------------------------

alter table public.pedidos
  add column versao integer not null default 1,
  add column atualizado_por uuid references public.perfis (id);
alter table public.caixas
  add column versao integer not null default 1,
  add column atualizado_por uuid references public.perfis (id);

-- OPE3: nada de dinheiro se apaga; desfazer e corrigir deixam registro com motivo, quem e quando.
alter table public.saidas
  add column cancelada_em timestamptz,
  add column cancelada_por uuid references public.perfis (id),
  add column motivo_cancelamento text check (length(motivo_cancelamento) <= 300);
alter table public.pagamentos
  add column anulado_em timestamptz,
  add column anulado_por uuid references public.perfis (id),
  add column motivo_anulacao text check (length(motivo_anulacao) <= 300);
alter table public.sobras
  add column anulada_em timestamptz,
  add column anulada_por uuid references public.perfis (id),
  add column motivo_anulacao text check (length(motivo_anulacao) <= 300);
alter table public.faltas
  add column anulada_em timestamptz,
  add column anulada_por uuid references public.perfis (id),
  add column motivo_anulacao text check (length(motivo_anulacao) <= 300);
alter table public.acertos
  add column motivo_reabertura text check (length(motivo_reabertura) <= 300);

-- Abaixo desta versão, o app envia a fila e pede para atualizar.
alter table public.config add column versao_minima_app integer not null default 1 check (versao_minima_app >= 1);

alter table public.operacoes
  add column versao_op integer,
  add column codigo text check (length(codigo) <= 40);

create index pedidos_atualizado_por on public.pedidos (atualizado_por);
create index caixas_atualizado_por on public.caixas (atualizado_por);
create index saidas_cancelada_por on public.saidas (cancelada_por);
create index pagamentos_anulado_por on public.pagamentos (anulado_por);
create index sobras_anulada_por on public.sobras (anulada_por);
create index faltas_anulada_por on public.faltas (anulada_por);

-- OPE3 no banco: além das regras das operações, um gatilho barra apagar e reescrever valores.
-- Argumentos: colunas que nunca mudam; com "!" na frente, colunas que, uma vez preenchidas, não voltam a vazio.
create function interno.proteger_dinheiro() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_coluna text;
  v_antes jsonb;
  v_depois jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'OPE3: % não se apaga; registre um ajuste com motivo.', tg_table_name using errcode = '42501';
  end if;
  v_antes := to_jsonb(old);
  v_depois := to_jsonb(new);
  foreach v_coluna in array tg_argv loop
    if left(v_coluna, 1) = '!' then
      if (v_antes -> substr(v_coluna, 2)) <> 'null'::jsonb
        and (v_antes -> substr(v_coluna, 2)) is distinct from (v_depois -> substr(v_coluna, 2)) then
        raise exception 'OPE3: %.% já registrado não muda.', tg_table_name, substr(v_coluna, 2) using errcode = '42501';
      end if;
    elsif (v_antes -> v_coluna) is distinct from (v_depois -> v_coluna) then
      raise exception 'OPE3: %.% não se reescreve; registre um ajuste.', tg_table_name, v_coluna using errcode = '42501';
    end if;
  end loop;
  return new;
end
$$;

create trigger proteger_dinheiro before update or delete on public.pagamentos
  for each row execute function interno.proteger_dinheiro(
    'noite_id', 'pedido_id', 'forma', 'valor', 'troco_pix', 'real', 'registrado_em', '!anulado_em');
create trigger proteger_dinheiro before update or delete on public.acertos
  for each row execute function interno.proteger_dinheiro(
    'noite_id', 'caixa_id', 'dinheiro_contado', 'devolver', 'maquininha', 'receber', 'falta', 'sobra', 'pagar',
    'completa', 'do_caixa_dele', 'retirado_caixa_empresa', 'vai_para_empresa', 'conta', 'confirmado_por',
    'confirmado_em', '!reaberto_em');
create trigger proteger_dinheiro before update or delete on public.sobras
  for each row execute function interno.proteger_dinheiro('caixa_id', 'acerto_id', 'valor', '!anulada_em');
create trigger proteger_dinheiro before update or delete on public.faltas
  for each row execute function interno.proteger_dinheiro('caixa_id', 'acerto_id', 'valor', '!anulada_em');
-- A saída guarda a taxa do motoboy (ENT2); o pedido, o total.
create trigger proteger_dinheiro before update or delete on public.saidas
  for each row execute function interno.proteger_dinheiro('noite_id', 'pedido_id', 'caixa_id', 'taxa', '!cancelada_em');
create trigger proteger_dinheiro before update or delete on public.pedidos
  for each row execute function interno.proteger_dinheiro('noite_id', 'codigo', 'total');

-- Recusa com código (PADROES, Erros) ----------------------------------------------

drop function interno.recusar(text);
create function interno.recusar(p_motivo text, p_codigo text default 'recusada') returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'MEL01', message = p_motivo, detail = p_codigo;
end
$$;

create or replace function interno.exigir(p_papeis public.papel[], variadic p_aceitos public.papel[]) returns void
language plpgsql set search_path = '' as $$
begin
  if not (p_papeis && p_aceitos) then
    perform interno.recusar('Sem permissão para isso.', 'sem_permissao');
  end if;
end
$$;

create or replace function interno.noite_aberta(p_noite uuid, p_prefixo text default null) returns public.noites
language plpgsql set search_path = '' as $$
declare
  n public.noites;
begin
  select * into n from public.noites where id = p_noite;
  if not found then
    perform interno.recusar(interno.motivo(p_prefixo, 'noite não encontrada.'), 'noite_nao_encontrada');
  end if;
  if n.fechada_em is not null then
    perform interno.recusar(interno.motivo(p_prefixo, 'a noite já foi fechada.'), 'noite_fechada');
  end if;
  return n;
end
$$;

create or replace function interno.travar_caixa(
  p_caixa uuid, p_uid uuid, p_papeis public.papel[], p_prefixo text default null
) returns public.caixas
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  a public.acertos;
begin
  select * into c from public.caixas where id = p_caixa for update;
  if not found then
    perform interno.recusar(interno.motivo(p_prefixo, 'caixa não encontrado.'), 'caixa_nao_encontrado');
  end if;
  if c.motoboy_id <> p_uid and not interno.eh_equipe_de(p_papeis) then
    perform interno.recusar(interno.motivo(p_prefixo, 'esse caixa é de outro motoboy.'), 'caixa_de_outro');
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

-- PAG2 e PAG4, com os códigos e as mensagens de packages/dominio/src/pagamento.ts.
create or replace function interno.validar_pagamentos(p_total integer, p_pagamentos jsonb, p_prefixo text default null)
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
    perform interno.recusar(interno.motivo(p_prefixo, 'escolha a forma de pagamento.'), 'sem_pagamento');
  end if;
  if jsonb_array_length(p_pagamentos) > 6 then
    perform interno.recusar(interno.motivo(p_prefixo, 'pagamentos demais.'), 'dados_invalidos');
  end if;
  for x in select * from jsonb_array_elements(p_pagamentos) loop
    v_forma := x ->> 'forma';
    if v_forma is null or v_forma not in ('dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado')
      or interno.uuid_de(x ->> 'id') is null then
      perform interno.recusar(interno.motivo(p_prefixo, 'dados inválidos.'), 'dados_invalidos');
    end if;
    v_valor := interno.inteiro(x -> 'valor');
    if v_valor is null or v_valor <= 0 then
      perform interno.recusar(interno.motivo(p_prefixo, 'valor inválido no pagamento.'), 'valor_invalido');
    end if;
    v_troco := coalesce(interno.inteiro(x -> 'troco_pix'), case when x ? 'troco_pix' then -1 else 0 end);
    if v_troco < 0 then
      perform interno.recusar(interno.motivo(p_prefixo, 'troco por Pix inválido.'), 'troco_invalido');
    end if;
    if v_troco > 0 and v_forma <> 'dinheiro' then
      perform interno.recusar(interno.motivo(p_prefixo, 'troco por Pix só com parte em dinheiro.'), 'troco_sem_dinheiro');
    end if;
    v_soma := v_soma + v_valor;
  end loop;
  if v_soma <> p_total then
    perform interno.recusar(
      interno.motivo(p_prefixo,
        'pagamentos somam ' || interno.reais(v_soma) || ', mas o total é ' || interno.reais(p_total) || '.'),
      'soma_diferente');
  end if;
end
$$;

-- Versão por linha (Conflitos e concorrência) --------------------------------------

create function interno.conferir_versao(
  p_atual integer, p_esperada integer, p_quem uuid, p_uid uuid, p_oque text, p_prefixo text default null
) returns void
language plpgsql set search_path = '' as $$
begin
  if p_esperada is null then
    perform interno.recusar(interno.motivo(p_prefixo, 'atualize o app (falta a versão).'), 'versao_ausente');
  end if;
  if p_atual <> p_esperada then
    perform interno.recusar(
      interno.motivo(p_prefixo,
        case when p_quem = p_uid then 'Você' else interno.nome(p_quem) end || ' mudou ' || p_oque
        || '; confira e tente de novo.'),
      'versao_mudou');
  end if;
end
$$;

create function interno.tocar_pedido(p_pedido uuid, p_uid uuid) returns void
language sql set search_path = '' as $$
  update public.pedidos set versao = versao + 1, atualizado_por = p_uid where id = p_pedido
$$;

create function interno.tocar_caixa(p_caixa uuid, p_uid uuid) returns void
language sql set search_path = '' as $$
  update public.caixas set versao = versao + 1, atualizado_por = p_uid where id = p_caixa
$$;

-- Saídas canceladas não contam --------------------------------------------------------

create or replace function interno.saida_mais_recente(p_pedido uuid) returns uuid
language sql stable set search_path = '' as $$
  select s.id from public.saidas s
  where s.pedido_id = p_pedido and s.cancelada_em is null
  order by s.criado_em desc, s.id desc limit 1
$$;

create or replace function interno.atualizar_estado_pedido(p_pedido uuid) returns void
language sql set search_path = '' as $$
  update public.pedidos p
  set estado = case
    when not exists (select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null) then 'cancelado'
    when exists (
      select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null and s.estado = 'entregue'
    ) then 'entregue'
    else 'aberto'
  end::public.estado_pedido
  where p.id = p_pedido
$$;

create or replace function interno.conta_caixa(p_caixa uuid, p_contado integer default null) returns jsonb
language sql stable set search_path = '' as $$
  with cx as (
    select c.caixa_inicial, c.diaria from public.caixas c where c.id = p_caixa
  ), s as (
    select * from public.saidas where caixa_id = p_caixa and cancelada_em is null
  ), entregues as (
    select * from s where estado <> 'voltou'
  ), escopo as (
    select e.id as saida_ref, p.*
    from entregues e
    join public.pagamentos p
      on p.pedido_id = e.pedido_id and (p.saida_id = e.id or p.saida_id is null) and p.anulado_em is null
  ), escolhidos as (
    select x.* from escopo x
    where x.real = exists (select 1 from escopo y where y.saida_ref = x.saida_ref and y.real)
  ), efetivos as (
    select distinct on (id) * from escolhidos order by id
  ), t as (
    select
      coalesce(sum(valor) filter (where forma = 'dinheiro'), 0)::integer as dinheiro,
      coalesce(sum(troco_pix) filter (where forma = 'dinheiro'), 0)::integer as troco,
      coalesce(sum(valor) filter (where forma = 'cartao'), 0)::integer as cartao,
      coalesce(sum(valor) filter (where forma = 'pix_maquininha'), 0)::integer as pix_maquina,
      coalesce(sum(valor) filter (where forma = 'pix_antecipado'), 0)::integer as pix_antecipado
    from efetivos
  ), tx as (
    select
      coalesce(sum(taxa), 0)::integer as taxas,
      count(*) filter (where estado <> 'voltou')::integer as entregues,
      count(*) filter (where estado = 'voltou')::integer as voltaram
    from s
  ), base as (
    select cx.caixa_inicial, cx.diaria, t.*, tx.*,
      cx.caixa_inicial + t.dinheiro + t.troco as devolver,
      t.cartao + t.pix_maquina as maquininha,
      cx.diaria + tx.taxas as receber
    from cx, t, tx
  )
  select jsonb_build_object(
    'caixaInicial', b.caixa_inicial,
    'diaria', b.diaria,
    'dinheiro', b.dinheiro,
    'troco', b.troco,
    'cartao', b.cartao,
    'pixMaquina', b.pix_maquina,
    'pixAntecipado', b.pix_antecipado,
    'taxas', b.taxas,
    'devolver', b.devolver,
    'maquininha', b.maquininha,
    'receber', b.receber,
    'entregues', b.entregues,
    'voltaram', b.voltaram,
    'liquidacao', case
      when p_contado is null then null
      else interno.liquidar(b.caixa_inicial, b.devolver, b.receber, p_contado)
    end
  )
  from base b
$$;

-- Operações que mudam o dinheiro sobem a versão -----------------------------------------

create or replace function interno.op_editar_caixa(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
    perform interno.recusar('Valor inválido.', 'valor_invalido');
  end if;
  update public.caixas
  set caixa_inicial = coalesce(v_caixa, caixa_inicial), diaria = coalesce(v_diaria, diaria)
  where id = c.id;
  perform interno.tocar_caixa(c.id, p_uid);
  return jsonb_build_object('caixa_id', c.id);
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
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'motoboy');
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

-- Desfazer: o lançamento inteiro (saída única) ou um "saiu de novo". Nada é apagado (OPE3).
create or replace function interno.op_cancelar_saida(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  p public.pedidos;
  v_anterior uuid;
  v_motivo text := coalesce(nullif(trim(d ->> 'motivo'), ''), 'Desfeito no app');
begin
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
  if v_anterior is null then
    update public.pagamentos
    set anulado_em = now(), anulado_por = p_uid, motivo_anulacao = left(v_motivo, 300)
    where pedido_id = p.id and anulado_em is null;
  else
    update public.pagamentos set saida_id = v_anterior where saida_id = s.id and anulado_em is null;
  end if;
  perform interno.atualizar_estado_pedido(p.id);
  perform interno.tocar_pedido(p.id, p_uid);
  perform interno.tocar_caixa(s.caixa_id, p_uid);
  return jsonb_build_object('saida_id', s.id, 'pedido_cancelado', v_anterior is null);
end
$$;

create or replace function interno.op_mudar_estado_saida(
  p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  v_codigo text;
  v_estado text := d ->> 'estado';
begin
  if v_estado is null or v_estado not in ('em_rota', 'entregue', 'voltou') then
    perform interno.recusar('Estado inválido.', 'dados_invalidos');
  end if;
  select * into s from public.saidas where id = interno.uuid_de(d ->> 'saida_id') and cancelada_em is null for update;
  if not found then
    perform interno.recusar('Saída não encontrada.', 'saida_nao_encontrada');
  end if;
  select codigo into v_codigo from public.pedidos where id = s.pedido_id;
  perform interno.travar_caixa(s.caixa_id, p_uid, p_papeis, v_codigo);
  if interno.saida_mais_recente(s.pedido_id) <> s.id then
    perform interno.recusar(interno.motivo(v_codigo, 'o pedido já saiu de novo.'), 'saiu_de_novo');
  end if;
  update public.saidas
  set estado = v_estado::public.estado_saida,
      entregue_em = case when v_estado = 'entregue' then p_hora end,
      voltou_em = case when v_estado = 'voltou' then p_hora end
  where id = s.id;
  perform interno.atualizar_estado_pedido(s.pedido_id);
  perform interno.tocar_pedido(s.pedido_id, p_uid);
  perform interno.tocar_caixa(s.caixa_id, p_uid);
  return jsonb_build_object('saida_id', s.id, 'estado', v_estado);
end
$$;

-- PAG3: a forma real substitui a prevista; a troca anterior fica anulada (OPE3).
-- Lista vazia volta para a forma prevista (desfazer).
create or replace function interno.op_trocar_pagamento(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.saidas;
  p public.pedidos;
  v_novos jsonb := coalesce(d -> 'pagamentos', '[]'::jsonb);
  v_ids uuid[];
begin
  select * into s from public.saidas where id = interno.uuid_de(d ->> 'saida_id') and cancelada_em is null for update;
  if not found then
    perform interno.recusar('Saída não encontrada.', 'saida_nao_encontrada');
  end if;
  select * into p from public.pedidos where id = s.pedido_id for update;
  perform interno.travar_caixa(s.caixa_id, p_uid, p_papeis, p.codigo);
  perform interno.conferir_versao(p.versao, interno.inteiro(d -> 'versao_esperada'), p.atualizado_por, p_uid,
    'este pedido', p.codigo);
  if s.estado = 'voltou' then
    perform interno.recusar(interno.motivo(p.codigo, 'essa saída voltou.'), 'saida_voltou');
  end if;
  if interno.saida_mais_recente(p.id) <> s.id then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu de novo.'), 'saiu_de_novo');
  end if;
  if jsonb_typeof(v_novos) <> 'array' then
    perform interno.recusar(interno.motivo(p.codigo, 'dados inválidos.'), 'dados_invalidos');
  end if;
  if jsonb_array_length(v_novos) > 0 then
    perform interno.validar_pagamentos(p.total, v_novos, p.codigo);
  end if;
  select coalesce(array_agg((x ->> 'id')::uuid), '{}') into v_ids from jsonb_array_elements(v_novos) x;
  perform interno.inserir_pagamentos(p, s.id, v_novos, true, p_hora);
  update public.pagamentos
  set anulado_em = now(), anulado_por = p_uid,
      motivo_anulacao = case when jsonb_array_length(v_novos) = 0 then 'Voltou para a forma prevista'
        else 'Forma trocada de novo' end
  where pedido_id = p.id and real and anulado_em is null and not (id = any (v_ids));
  perform interno.tocar_pedido(p.id, p_uid);
  perform interno.tocar_caixa(s.caixa_id, p_uid);
  return jsonb_build_object('saida_id', s.id);
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
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'motoboy');
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
  if v_caixa is null then
    select x.id into v_caixa from public.caixas x where x.noite_id = ant.noite_id and x.motoboy_id = p_uid;
    if v_caixa is null then
      perform interno.recusar(interno.motivo(p.codigo, 'você não tem caixa nesta noite.'), 'sem_caixa');
    end if;
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

create or replace function interno.op_informar_contado(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.caixas;
  v_contado integer := interno.inteiro(d -> 'dinheiro_contado');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  c := interno.travar_caixa(interno.uuid_de(d ->> 'caixa_id'), p_uid, p_papeis);
  if jsonb_typeof(d -> 'dinheiro_contado') <> 'null' and (v_contado is null or v_contado < 0) then
    perform interno.recusar('Valor inválido.', 'valor_invalido');
  end if;
  update public.caixas set dinheiro_contado = v_contado where id = c.id;
  perform interno.tocar_caixa(c.id, p_uid);
  return jsonb_build_object('caixa_id', c.id);
end
$$;

create or replace function interno.op_confirmar_acerto(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  -- Alguém mexeu no caixa depois que o Luan abriu a conta.
  perform interno.conferir_versao(c.versao, interno.inteiro(d -> 'versao_esperada'), c.atualizado_por, p_uid,
    'este caixa');
  if c.dinheiro_contado is null then
    perform interno.recusar('Informe o dinheiro contado.', 'sem_contado');
  end if;
  if length(coalesce(d -> 'conta', '{}'::jsonb)::text) > 60000 then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  v := interno.conta_caixa(c.id, c.dinheiro_contado);
  l := v -> 'liquidacao';
  -- O servidor recalcula: o aparelho confirma o que mostrou, mas não é a fonte da conta.
  foreach k in array array['devolver', 'maquininha', 'receber'] loop
    if (e -> k) is distinct from (v -> k) then
      perform interno.recusar('A conta mudou desde que você abriu. Confira de novo.', 'conta_mudou');
    end if;
  end loop;
  foreach k in array array['dinheiroContado', 'pagar', 'doCaixaDele', 'retiradoCaixaEmpresa', 'vaiParaEmpresa'] loop
    if (e -> k) is distinct from (l -> k) then
      perform interno.recusar('A conta mudou desde que você abriu. Confira de novo.', 'conta_mudou');
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
  perform interno.tocar_caixa(c.id, p_uid);
  return jsonb_build_object('acerto_id', v_id, 'conta', v);
end
$$;

-- ACE9: reabrir é do admin, com motivo. O acerto antigo, a sobra e a falta ficam registrados (OPE3).
create or replace function interno.op_reabrir_acerto(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  a public.acertos;
  v_motivo text := nullif(trim(d ->> 'motivo'), '');
begin
  perform interno.exigir(p_papeis, 'admin');
  if v_motivo is null then
    perform interno.recusar('Diga o motivo da reabertura.', 'sem_motivo');
  end if;
  select * into a from public.acertos
  where caixa_id = interno.uuid_de(d ->> 'caixa_id') and reaberto_em is null for update;
  if not found then
    perform interno.recusar('Esse caixa não tem acerto confirmado.', 'sem_acerto');
  end if;
  perform interno.noite_aberta(a.noite_id);
  update public.acertos
  set reaberto_em = now(), reaberto_por = p_uid, motivo_reabertura = left(v_motivo, 300)
  where id = a.id;
  update public.sobras set anulada_em = now(), anulada_por = p_uid, motivo_anulacao = left(v_motivo, 300)
  where acerto_id = a.id and anulada_em is null;
  update public.faltas set anulada_em = now(), anulada_por = p_uid, motivo_anulacao = left(v_motivo, 300)
  where acerto_id = a.id and anulada_em is null;
  update public.caixas set fechado_em = null where id = a.caixa_id;
  perform interno.tocar_caixa(a.caixa_id, p_uid);
  return jsonb_build_object('caixa_id', a.caixa_id);
end
$$;

-- MFA para admin e gerente --------------------------------------------------------------

create function interno.precisa_mfa() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.ativo and p.papeis && '{admin,gerente}'::public.papel[]
  ) and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
$$;

-- Sem o código do app autenticador, admin e gerente não veem nem mudam nada além do próprio perfil.
create or replace function interno.meus_papeis() returns public.papel[]
language sql stable security definer set search_path = '' as $$
  select case
    when interno.precisa_mfa() then '{}'::public.papel[]
    else coalesce(
      (select p.papeis from public.perfis p where p.id = (select auth.uid()) and p.ativo),
      '{}'::public.papel[]
    )
  end
$$;

-- A porta: horário do servidor, versao_op, MFA e código da recusa -----------------------

-- Versão do formato das operações. O servidor aceita a atual e a anterior (ARQUITETURA, Robustez).
create function interno.versao_op_atual() returns integer
language sql immutable set search_path = '' as $$
  select 1
$$;

create function interno.hora_ou_nulo(p_texto text) returns timestamptz
language plpgsql immutable set search_path = '' as $$
begin
  return p_texto::timestamptz;
exception when others then
  return null;
end
$$;

drop function interno.hora_do_aparelho(text);

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
