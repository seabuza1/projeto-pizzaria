-- Etapa 7 (F2, 2b e 2e): pedido digitado pelo atendimento, trava, itens com a fotografia do preço,
-- autorização, alteração antes de sair, cancelamento e retirada.

-- Pedido -------------------------------------------------------------------------------------

alter table public.pedidos
  add column telefone text check (telefone ~ '^[0-9]{10,11}$'),
  add column cliente_id uuid references public.clientes (id),
  -- O que o atendente digitou (itens e pagamentos previstos), para retomar o rascunho e alterar depois.
  add column atendimento jsonb,
  add column troco_para integer check (troco_para > 0),
  add column local_pendente boolean not null default false,
  -- O endereço usado neste pedido (o cliente guarda só o último).
  add column endereco_link text check (length(endereco_link) <= 500),
  add column endereco_texto text check (length(endereco_texto) <= 300),
  add column endereco_referencia text check (length(endereco_referencia) <= 300),
  -- Trava de atendimento: liberada ao autorizar, cancelar ou depois de 10 min parado.
  add column atendendo_por uuid references public.perfis (id),
  add column atendendo_aparelho text check (length(atendendo_aparelho) <= 80),
  add column atendendo_desde timestamptz,
  add column autorizado_em timestamptz,
  add column autorizado_por uuid references public.perfis (id),
  -- Alterado depois de autorizado: a comanda reimprime com "ALTERADO".
  add column alterado boolean not null default false,
  add column retirado_em timestamptz,
  add column cancelado_em timestamptz,
  add column cancelado_por uuid references public.perfis (id),
  add column motivo_cancelamento text check (length(motivo_cancelamento) <= 300);
create index pedidos_telefone on public.pedidos (telefone, criado_em desc);
create index pedidos_cliente on public.pedidos (cliente_id);
create index pedidos_atendendo_por on public.pedidos (atendendo_por);
create index pedidos_autorizado_por on public.pedidos (autorizado_por);
create index pedidos_cancelado_por on public.pedidos (cancelado_por);

-- O rascunho pode estar sem itens; depois de autorizado, o total é maior que zero.
alter table public.pedidos drop constraint pedidos_total_check;
alter table public.pedidos add constraint pedidos_total_check
  check (total > 0 or (total = 0 and estado in ('rascunho', 'aguardando')));

-- OPE3: o total e o código só mudam antes de o pedido sair (alterar antes de sair, F2).
create function interno.proteger_pedido() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'OPE3: pedidos não se apaga; cancele com motivo.' using errcode = '42501';
  end if;
  if new.noite_id is distinct from old.noite_id then
    raise exception 'OPE3: pedidos.noite_id não se reescreve.' using errcode = '42501';
  end if;
  if (new.total is distinct from old.total or new.codigo is distinct from old.codigo)
    and (old.estado not in ('rascunho', 'aguardando', 'em_producao')
      or exists (select 1 from public.saidas s where s.pedido_id = old.id and s.cancelada_em is null)) then
    raise exception 'OPE3: o pedido já saiu; o total não se reescreve.' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger proteger_dinheiro on public.pedidos;
create trigger proteger_dinheiro before update or delete on public.pedidos
  for each row execute function interno.proteger_pedido();

-- Itens: a fotografia do momento da venda. Mudar o cardápio não muda pedido antigo (como a taxa, ENT2).
create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  ordem smallint not null,
  -- O item como foi pedido, para "Repetir".
  item jsonb not null,
  nome text not null check (length(nome) between 1 and 200),
  detalhes text[] not null default '{}',
  faixa_cobrada public.faixa_pizza,
  unitario integer not null check (unitario >= 0),
  desconto integer not null default 0 check (desconto >= 0 and desconto <= unitario),
  quantidade smallint not null check (quantidade >= 1),
  total integer not null check (total = (unitario - desconto) * quantidade),
  -- Pedido alterado: a versão anterior fica registrada (OPE3).
  anulado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pedido_itens_pedido on public.pedido_itens (pedido_id);
create index pedido_itens_noite on public.pedido_itens (noite_id);
create trigger tocar_atualizado_em before update on public.pedido_itens
  for each row execute function interno.tocar_atualizado_em();
create trigger proteger_dinheiro before update or delete on public.pedido_itens
  for each row execute function interno.proteger_dinheiro(
    'noite_id', 'pedido_id', 'item', 'nome', 'unitario', 'desconto', 'quantidade', 'total', '!anulado_em');
alter table public.pedido_itens enable row level security;
revoke all on public.pedido_itens from anon, authenticated;
grant select on public.pedido_itens to authenticated;
alter publication supabase_realtime add table public.pedido_itens;

-- O atendimento vê os pedidos, os itens, os pagamentos e as saídas; caixas e acertos continuam da equipe.
drop policy pedidos_leitura on public.pedidos;
create policy pedidos_leitura on public.pedidos for select to authenticated using ((select interno.eh_balcao()));
drop policy pagamentos_leitura on public.pagamentos;
create policy pagamentos_leitura on public.pagamentos for select to authenticated using ((select interno.eh_balcao()));
drop policy saidas_leitura on public.saidas;
create policy saidas_leitura on public.saidas for select to authenticated using ((select interno.eh_balcao()));
create policy pedido_itens_leitura on public.pedido_itens for select to authenticated
  using ((select interno.eh_balcao()));

-- Estado e despacho ---------------------------------------------------------------------------

-- Sem saída: a comanda de papel foi desfeita; o pedido do balcão volta para "em produção" (despacho).
-- Rascunho, aguardando, retirado e cancelado não dependem das saídas.
create or replace function interno.atualizar_estado_pedido(p_pedido uuid) returns void
language sql set search_path = '' as $$
  update public.pedidos p
  set estado = case
    when p.estado in ('cancelado', 'retirado', 'rascunho', 'aguardando') then p.estado::text
    when not exists (select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null) then
      case when p.origem = 'papel' then 'cancelado' else 'em_producao' end
    when exists (
      select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null and s.estado = 'entregue'
    ) then 'entregue'
    else 'aberto'
  end::public.estado_pedido
  where p.id = p_pedido
$$;

create or replace function interno.op_despachar(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
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
    -- Só sai o que foi autorizado (PED6).
    if p.tipo <> 'entrega' or p.estado <> 'em_producao' then
      perform interno.recusar(interno.motivo(p.codigo, 'o pedido não está para entrega.'), 'nao_e_entrega');
    end if;
    select * into a from public.areas where id = p.area_id;
    if not found then
      perform interno.recusar(interno.motivo(p.codigo, 'o pedido está sem área.'), 'area_invalida');
    end if;
    insert into public.saidas (id, noite_id, pedido_id, caixa_id, motoboy_id, area_id, taxa, estado, saiu_em)
    values (v_saida, c.noite_id, p.id, c.id, c.motoboy_id, a.id, a.taxa, 'em_rota', p_hora);
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

-- Atendimento ---------------------------------------------------------------------------------

-- A noite do pedido: a aberta que o aparelho mandou; senão a de hoje. Se ninguém abriu, o primeiro pedido
-- abre a noite com os padrões (ERROS-PREVISTOS).
create function interno.noite_do_pedido(p_noite uuid, p_uid uuid, p_hora timestamptz) returns public.noites
language plpgsql set search_path = '' as $$
declare
  n public.noites;
begin
  select * into n from public.noites where id = p_noite and fechada_em is null;
  if found then
    return n;
  end if;
  select * into n from public.noites where data = interno.data_da_noite(p_hora);
  if found then
    return interno.noite_aberta(n.id);
  end if;
  insert into public.noites (id, data, aberta_em, aberta_por)
  values (coalesce(p_noite, gen_random_uuid()), interno.data_da_noite(p_hora), p_hora, p_uid)
  returning * into n;
  return n;
end
$$;

-- Outro aparelho atendendo o mesmo pedido (ou o mesmo telefone) há menos de 10 min.
create function interno.conferir_trava(p public.pedidos, p_aparelho text) returns void
language plpgsql set search_path = '' as $$
begin
  if p.estado in ('rascunho', 'aguardando') and p.atendendo_aparelho is not null
    and p.atendendo_aparelho is distinct from p_aparelho and p.atendendo_desde > now() - interval '10 minutes' then
    perform interno.recusar(
      interno.motivo(p.codigo, 'atendendo em outro aparelho há '
        || floor(extract(epoch from now() - p.atendendo_desde) / 60)::int || ' min. Toque em "Assumir".'),
      'em_atendimento');
  end if;
end
$$;

-- Itens com a fotografia (calculada no aparelho por packages/dominio/src/preco.ts). O servidor confere as
-- contas de cada linha, o desconto da promoção da noite e devolve a soma.
create function interno.validar_itens(p_itens jsonb, p_promo integer, p_promocao boolean, p_prefixo text)
returns integer
language plpgsql set search_path = '' as $$
declare
  x jsonb;
  v_soma integer := 0;
  v_unit integer;
  v_desc integer;
  v_qtd integer;
begin
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) > 40 then
    perform interno.recusar(interno.motivo(p_prefixo, 'itens inválidos.'), 'dados_invalidos');
  end if;
  for x in select * from jsonb_array_elements(p_itens) loop
    v_unit := interno.inteiro(x -> 'unitario');
    v_desc := coalesce(interno.inteiro(x -> 'desconto'), 0);
    v_qtd := interno.inteiro(x -> 'quantidade');
    if v_unit is null or v_unit < 0 or v_qtd is null or v_qtd < 1 or v_desc < 0 or v_desc > v_unit
      or interno.inteiro(x -> 'total') is distinct from (v_unit - v_desc) * v_qtd
      or coalesce(trim(x ->> 'nome'), '') = '' or jsonb_typeof(x -> 'item') is distinct from 'object' then
      perform interno.recusar(interno.motivo(p_prefixo, 'item com conta errada.'), 'item_invalido');
    end if;
    -- PED4: só há desconto em pedido com promoção, e no máximo o da noite.
    if v_desc > 0 and (not p_promocao or v_desc > coalesce(p_promo, 0)) then
      perform interno.recusar(interno.motivo(p_prefixo, 'desconto diferente da promoção da noite.'), 'promo_invalida');
    end if;
    v_soma := v_soma + (v_unit - v_desc) * v_qtd;
  end loop;
  return v_soma;
end
$$;

-- Salvar o pedido do atendimento. etapa: "rascunho" (digitando), "aguardando" (resumo mandado ao cliente)
-- ou "autorizar" (vai para a produção; PED6). Pedido já autorizado e que ainda não saiu: "autorizar" de novo
-- grava a alteração (ALTERADO na comanda).
create function interno.op_salvar_pedido(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n public.noites;
  p public.pedidos;
  a public.areas;
  outro public.pedidos;
  v_id uuid := interno.uuid_de(d ->> 'pedido_id');
  v_tel text := d ->> 'telefone';
  v_codigo text := right(d ->> 'telefone', 4);
  v_etapa text := d ->> 'etapa';
  v_tipo text := coalesce(d ->> 'tipo', 'entrega');
  v_aparelho text := left(d ->> 'aparelho', 80);
  v_promocao boolean := coalesce((d ->> 'promocao')::boolean, false);
  v_troco integer := interno.inteiro(d -> 'troco_para');
  v_taxa integer := 0;
  v_itens integer;
  v_total integer;
  v_existe boolean;
  x jsonb;
  i integer := 0;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  if v_id is null or v_etapa not in ('rascunho', 'aguardando', 'autorizar') or v_tipo not in ('entrega', 'retirada') then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  if v_tel is null or v_tel !~ '^[0-9]{10,11}$' then
    perform interno.recusar('Digite o telefone com DDD.', 'telefone_invalido');
  end if;

  select * into p from public.pedidos where id = v_id for update;
  v_existe := found;
  if v_existe then
    n := interno.noite_aberta(p.noite_id, p.codigo);
    if p.estado not in ('rascunho', 'aguardando', 'em_producao') then
      perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu ou foi encerrado.'), 'pedido_encerrado');
    end if;
    perform interno.conferir_trava(p, v_aparelho);
    if p.estado = 'em_producao' then
      perform interno.conferir_versao(p.versao, interno.inteiro(d -> 'versao_esperada'), p.atualizado_por, p_uid,
        'este pedido', p.codigo);
      if v_etapa <> 'autorizar' then
        perform interno.recusar(interno.motivo(p.codigo, 'o pedido já foi autorizado.'), 'ja_autorizado');
      end if;
      if exists (select 1 from public.saidas s where s.pedido_id = p.id and s.cancelada_em is null) then
        perform interno.recusar(interno.motivo(p.codigo, 'o pedido já saiu.'), 'ja_saiu');
      end if;
    end if;
  else
    n := interno.noite_do_pedido(interno.uuid_de(d ->> 'noite_id'), p_uid, p_hora);
  end if;

  -- Trava por telefone: outro aparelho já atende esse cliente.
  select * into outro from public.pedidos o
  where o.noite_id = n.id and o.telefone = v_tel and o.id <> v_id and o.estado in ('rascunho', 'aguardando')
    and o.atendendo_aparelho is distinct from v_aparelho and o.atendendo_desde > now() - interval '10 minutes'
  limit 1;
  if found then
    perform interno.conferir_trava(outro, v_aparelho);
  end if;

  if v_tipo = 'entrega' and d ->> 'area_id' is not null then
    select * into a from public.areas where id = interno.uuid_de(d ->> 'area_id');
    if not found then
      perform interno.recusar(interno.motivo(v_codigo, 'escolha a área.'), 'area_invalida');
    end if;
    v_taxa := a.taxa;
  end if;
  v_itens := interno.validar_itens(coalesce(d -> 'itens', '[]'), n.promo_desconto, v_promocao, v_codigo);
  v_total := v_itens + v_taxa;

  if v_etapa = 'autorizar' then
    if jsonb_array_length(coalesce(d -> 'itens', '[]')) = 0 then
      perform interno.recusar(interno.motivo(v_codigo, 'o pedido está sem itens.'), 'sem_itens');
    end if;
    if v_tipo = 'entrega' and a.id is null then
      perform interno.recusar(interno.motivo(v_codigo, 'escolha a área.'), 'area_invalida');
    end if;
    perform interno.validar_pagamentos(v_total, coalesce(d -> 'pagamentos', '[]'), v_codigo);
    -- "Troco para 100": só com parte em dinheiro e não menor que ela.
    if v_troco is not null and (v_troco < coalesce((
      select sum(interno.inteiro(pg -> 'valor')) from jsonb_array_elements(d -> 'pagamentos') pg
      where pg ->> 'forma' = 'dinheiro'), 0) or not exists (
      select 1 from jsonb_array_elements(d -> 'pagamentos') pg where pg ->> 'forma' = 'dinheiro')) then
      perform interno.recusar(interno.motivo(v_codigo, 'troco inválido.'), 'troco_invalido');
    end if;
  end if;

  if not v_existe then
    insert into public.pedidos (
      id, noite_id, codigo, origem, tipo, total, estado, criado_por, atualizado_por
    ) values (
      v_id, n.id, v_codigo, coalesce(nullif(d ->> 'origem', ''), 'whatsapp')::public.origem_pedido,
      v_tipo::public.tipo_pedido, v_total, 'rascunho', p_uid, p_uid
    ) returning * into p;
  end if;

  update public.pedidos set
    codigo = v_codigo,
    telefone = v_tel,
    cliente_id = (select c.id from public.clientes c where c.telefone = v_tel),
    tipo = v_tipo::public.tipo_pedido,
    area_id = case when v_tipo = 'entrega' then a.id end,
    total = v_total,
    promocao = v_promocao,
    troco_para = v_troco,
    local_pendente = coalesce((d ->> 'local_pendente')::boolean, false),
    endereco_link = interno.texto(d, 'endereco_link', 500),
    endereco_texto = interno.texto(d, 'endereco_texto', 300),
    endereco_referencia = interno.texto(d, 'endereco_referencia', 300),
    obs = interno.texto(d, 'obs', 500),
    atendimento = jsonb_build_object('itens', coalesce(d -> 'itens', '[]'), 'pagamentos', coalesce(d -> 'pagamentos', '[]')),
    estado = case
      when v_etapa = 'autorizar' then 'em_producao'
      when p.estado = 'em_producao' then p.estado::text
      else v_etapa
    end::public.estado_pedido,
    alterado = p.estado = 'em_producao' or p.alterado,
    autorizado_em = case when v_etapa = 'autorizar' then coalesce(p.autorizado_em, p_hora) end,
    autorizado_por = case when v_etapa = 'autorizar' then coalesce(p.autorizado_por, p_uid) end,
    -- Autorizar libera a trava; digitar renova.
    atendendo_por = case when v_etapa = 'autorizar' then null else p_uid end,
    atendendo_aparelho = case when v_etapa = 'autorizar' then null else v_aparelho end,
    atendendo_desde = case when v_etapa = 'autorizar' then null else now() end
  where id = v_id;

  -- Autorizado: a fotografia dos itens e os pagamentos previstos (PAG3). Alteração anula a versão anterior.
  if v_etapa = 'autorizar' then
    update public.pedido_itens set anulado_em = now() where pedido_id = v_id and anulado_em is null;
    update public.pagamentos set anulado_em = now(), anulado_por = p_uid, motivo_anulacao = 'Pedido alterado'
    where pedido_id = v_id and anulado_em is null and not real;
    for x in select * from jsonb_array_elements(d -> 'itens') loop
      i := i + 1;
      insert into public.pedido_itens (
        noite_id, pedido_id, ordem, item, nome, detalhes, faixa_cobrada, unitario, desconto, quantidade, total
      ) values (
        n.id, v_id, i, x -> 'item', left(x ->> 'nome', 200), interno.lista_de_texto(x -> 'detalhes'),
        (x ->> 'faixa_cobrada')::public.faixa_pizza, interno.inteiro(x -> 'unitario'),
        coalesce(interno.inteiro(x -> 'desconto'), 0), interno.inteiro(x -> 'quantidade'), interno.inteiro(x -> 'total')
      );
    end loop;
    select * into p from public.pedidos where id = v_id;
    perform interno.inserir_pagamentos(p, null, d -> 'pagamentos', false, p_hora);
  end if;
  perform interno.tocar_pedido(v_id, p_uid);
  return jsonb_build_object('pedido_id', v_id, 'noite_id', n.id, 'total', v_total);
end
$$;

-- "Assumir": o pedido passa para este aparelho (F2, 2b).
create function interno.op_assumir_pedido(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  p public.pedidos;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  select * into p from public.pedidos where id = interno.uuid_de(d ->> 'pedido_id') for update;
  if not found or p.estado not in ('rascunho', 'aguardando') then
    perform interno.recusar('Pedido não encontrado.', 'pedido_nao_encontrado');
  end if;
  update public.pedidos
  set atendendo_por = p_uid, atendendo_aparelho = left(d ->> 'aparelho', 80), atendendo_desde = now()
  where id = p.id;
  return jsonb_build_object('pedido_id', p.id);
end
$$;

-- Cancelar com motivo, a qualquer momento antes do acerto (F2, 2b). As saídas e os pagamentos ficam
-- registrados, cancelados e anulados (OPE3).
create function interno.op_cancelar_pedido(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  p public.pedidos;
  s public.saidas;
  v_motivo text := interno.texto(d, 'motivo', 300);
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  select * into p from public.pedidos where id = interno.uuid_de(d ->> 'pedido_id') for update;
  if not found then
    perform interno.recusar('Pedido não encontrado.', 'pedido_nao_encontrado');
  end if;
  perform interno.noite_aberta(p.noite_id, p.codigo);
  if p.estado in ('cancelado', 'retirado') then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido já foi encerrado.'), 'pedido_encerrado');
  end if;
  if v_motivo is null then
    perform interno.recusar(interno.motivo(p.codigo, 'diga o motivo do cancelamento.'), 'sem_motivo');
  end if;
  perform interno.conferir_versao(p.versao, interno.inteiro(d -> 'versao_esperada'), p.atualizado_por, p_uid,
    'este pedido', p.codigo);
  for s in select * from public.saidas where pedido_id = p.id and cancelada_em is null for update loop
    perform interno.travar_caixa(s.caixa_id, p_uid, '{admin}'::public.papel[], p.codigo);
    update public.saidas set cancelada_em = now(), cancelada_por = p_uid, motivo_cancelamento = v_motivo
    where id = s.id;
    perform interno.tocar_caixa(s.caixa_id, p_uid);
  end loop;
  update public.pagamentos set anulado_em = now(), anulado_por = p_uid, motivo_anulacao = v_motivo
  where pedido_id = p.id and anulado_em is null;
  update public.pedidos set
    estado = 'cancelado', cancelado_em = now(), cancelado_por = p_uid, motivo_cancelamento = v_motivo,
    atendendo_por = null, atendendo_aparelho = null, atendendo_desde = null
  where id = p.id;
  perform interno.tocar_pedido(p.id, p_uid);
  return jsonb_build_object('pedido_id', p.id);
end
$$;

-- Retirada (F2, 2e): marcar como retirado e, se o cliente pagou diferente do previsto, o pagamento do balcão.
create function interno.op_marcar_retirado(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  p public.pedidos;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  select * into p from public.pedidos where id = interno.uuid_de(d ->> 'pedido_id') for update;
  if not found then
    perform interno.recusar('Pedido não encontrado.', 'pedido_nao_encontrado');
  end if;
  perform interno.noite_aberta(p.noite_id, p.codigo);
  if p.tipo <> 'retirada' or p.estado <> 'em_producao' then
    perform interno.recusar(interno.motivo(p.codigo, 'o pedido não está para retirada.'), 'nao_e_retirada');
  end if;
  perform interno.conferir_versao(p.versao, interno.inteiro(d -> 'versao_esperada'), p.atualizado_por, p_uid,
    'este pedido', p.codigo);
  if jsonb_array_length(coalesce(d -> 'pagamentos', '[]')) > 0 then
    perform interno.validar_pagamentos(p.total, d -> 'pagamentos', p.codigo);
    perform interno.inserir_pagamentos(p, null, d -> 'pagamentos', true, p_hora);
  end if;
  update public.pedidos set estado = 'retirado', retirado_em = p_hora where id = p.id;
  perform interno.tocar_pedido(p.id, p_uid);
  return jsonb_build_object('pedido_id', p.id);
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa(), interno.eh_balcao() to authenticated;
