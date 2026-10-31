-- Etapa 6 (F2, 2a e 2g): cardápio, "acabou hoje", clientes e promoção da noite.
-- Preços em centavos. O cardápio inicial vem de docs/dados/cardapio-mel.json (supabase/seeds/cardapio.sql).

create type public.faixa_pizza as enum ('tradicional', 'especial', 'premium', 'doce', 'doce_especial');
create type public.tamanho_pizza as enum ('B', 'P', 'M', 'G');

-- Cardápio (PED8) -------------------------------------------------------------------------

-- O preço da pizza depende da faixa do sabor e do tamanho.
create table public.cardapio_faixas (
  id uuid primary key default gen_random_uuid(),
  faixa public.faixa_pizza not null,
  tamanho public.tamanho_pizza not null,
  preco integer not null check (preco > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (faixa, tamanho)
);

create table public.cardapio_sabores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  faixa public.faixa_pizza not null,
  ingredientes text check (length(ingredientes) <= 300),
  -- Para a busca do atendente ("filé", "4 queijos").
  apelidos text[] not null default '{}',
  ativo boolean not null default true,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index cardapio_sabores_nome on public.cardapio_sabores (lower(nome));

create table public.cardapio_bordas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  preco integer not null check (preco >= 0),
  ativo boolean not null default true,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index cardapio_bordas_nome on public.cardapio_bordas (lower(nome));

-- Adicional da pizza (R$ 10 cada) ou item avulso com preço próprio (kit de molhos, cuba de avelã).
create table public.cardapio_adicionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  preco integer not null check (preco >= 0),
  avulso boolean not null default false,
  ativo boolean not null default true,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index cardapio_adicionais_nome on public.cardapio_adicionais (lower(nome));

create table public.cardapio_bebidas (
  id uuid primary key default gen_random_uuid(),
  grupo text not null check (length(trim(grupo)) between 1 and 40),
  nome text not null check (length(trim(nome)) between 1 and 80),
  preco integer not null check (preco >= 0),
  apelidos text[] not null default '{}',
  ativo boolean not null default true,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index cardapio_bebidas_nome on public.cardapio_bebidas (lower(nome));

create table public.cardapio_combos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[0-9]{2}$'),
  itens text[] not null check (cardinality(itens) between 1 and 10),
  preco integer not null check (preco > 0),
  ativo boolean not null default true,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- "Acabou hoje": vale só na noite; na seguinte o item volta sozinho.
create table public.cardapio_acabou (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  tipo text not null check (tipo in ('sabor', 'borda', 'adicional', 'bebida', 'combo')),
  item_id uuid not null,
  marcado_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (noite_id, item_id)
);
create index cardapio_acabou_marcado_por on public.cardapio_acabou (marcado_por);

-- Clientes (F2, 2a): telefone completo, nome e o último local. Sem registro em eventos: dado de cliente.
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique check (telefone ~ '^[0-9]{10,11}$'),
  nome text check (length(nome) <= 80),
  -- Pino ou link do Maps.
  local_link text check (length(local_link) <= 500),
  local_endereco text check (length(local_endereco) <= 300),
  local_referencia text check (length(local_referencia) <= 300),
  area_id uuid references public.areas (id),
  atualizado_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index clientes_area on public.clientes (area_id);
create index clientes_atualizado_por on public.clientes (atualizado_por);

-- PED4: null = promoção não definida; 0 = "sem promoção"; senão, de R$ 3 a R$ 23.
alter table public.noites drop constraint noites_promo_desconto_check;
alter table public.noites add constraint noites_promo_desconto_check
  check (promo_desconto = 0 or promo_desconto between 300 and 2300);

-- Gatilhos, registro de mudanças (preços: quem, quando, de quanto para quanto) e RLS ---------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'cardapio_faixas', 'cardapio_sabores', 'cardapio_bordas', 'cardapio_adicionais', 'cardapio_bebidas',
    'cardapio_combos', 'cardapio_acabou', 'clientes'
  ] loop
    execute format(
      'create trigger tocar_atualizado_em before update on public.%I '
      'for each row execute function interno.tocar_atualizado_em()', t);
    execute format('alter table public.%I enable row level security', t);
    if t <> 'clientes' then
      execute format(
        'create trigger registrar_evento after insert or update or delete on public.%I '
        'for each row execute function interno.registrar_evento()', t);
    end if;
  end loop;
end
$$;

-- Equipe do balcão: quem atende o cliente (admin, gerente, expedição e atendimento). O agente não.
create function interno.eh_balcao() returns boolean
language sql stable security definer set search_path = '' as $$
  select interno.tem_papel('admin', 'gerente', 'expedicao', 'atendente')
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'cardapio_faixas', 'cardapio_sabores', 'cardapio_bordas', 'cardapio_adicionais', 'cardapio_bebidas',
    'cardapio_combos', 'cardapio_acabou', 'clientes'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select interno.eh_balcao()))',
      t || '_leitura', t);
  end loop;
end
$$;

-- Tempo real: uma mudança de preço ou um "acabou hoje" aparece nos outros aparelhos.
alter publication supabase_realtime add table
  public.cardapio_faixas, public.cardapio_sabores, public.cardapio_bordas, public.cardapio_adicionais,
  public.cardapio_bebidas, public.cardapio_combos, public.cardapio_acabou, public.clientes;

-- Operações ------------------------------------------------------------------------------

create function interno.texto(d jsonb, p_campo text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(trim(d ->> p_campo), p_max), '')
$$;

create function interno.lista_de_texto(p_valor jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(left(trim(x), 40)) filter (where trim(x) <> ''), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(p_valor) = 'array' then p_valor else '[]' end) x
$$;

-- Preço da faixa por tamanho (gerente e admin). Pedido antigo não muda: guarda a fotografia (pedido_itens).
create function interno.op_salvar_preco_faixa(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_preco integer := interno.inteiro(d -> 'preco');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente');
  if v_preco is null or v_preco <= 0 or d ->> 'faixa' is null or d ->> 'tamanho' is null then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  insert into public.cardapio_faixas (faixa, tamanho, preco)
  values ((d ->> 'faixa')::public.faixa_pizza, (d ->> 'tamanho')::public.tamanho_pizza, v_preco)
  on conflict (faixa, tamanho) do update set preco = excluded.preco;
  return jsonb_build_object('faixa', d ->> 'faixa', 'tamanho', d ->> 'tamanho', 'preco', v_preco);
end
$$;

-- Itens do cardápio (gerente e admin): sabor, borda, adicional, bebida ou combo. Desativar em vez de apagar.
create function interno.op_salvar_item_cardapio(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'item_id');
  v_tipo text := d ->> 'tipo';
  v_nome text := interno.texto(d, 'nome', 80);
  v_preco integer := interno.inteiro(d -> 'preco');
  v_ativo boolean := coalesce((d ->> 'ativo')::boolean, true);
  v_ordem smallint := coalesce(interno.inteiro(d -> 'ordem'), 0);
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente');
  if v_id is null or v_nome is null then
    perform interno.recusar('Preencha o nome.', 'dados_invalidos');
  end if;
  if v_tipo <> 'sabor' and (v_preco is null or v_preco < 0) then
    perform interno.recusar(interno.motivo(v_nome, 'preço inválido.'), 'preco_invalido');
  end if;
  case v_tipo
    when 'sabor' then
      insert into public.cardapio_sabores (id, nome, faixa, ingredientes, apelidos, ativo, ordem)
      values (v_id, v_nome, (d ->> 'faixa')::public.faixa_pizza, interno.texto(d, 'ingredientes', 300),
        interno.lista_de_texto(d -> 'apelidos'), v_ativo, v_ordem)
      on conflict (id) do update set nome = excluded.nome, faixa = excluded.faixa,
        ingredientes = excluded.ingredientes, apelidos = excluded.apelidos, ativo = excluded.ativo,
        ordem = excluded.ordem;
    when 'borda' then
      insert into public.cardapio_bordas (id, nome, preco, ativo, ordem) values (v_id, v_nome, v_preco, v_ativo, v_ordem)
      on conflict (id) do update set nome = excluded.nome, preco = excluded.preco, ativo = excluded.ativo,
        ordem = excluded.ordem;
    when 'adicional' then
      insert into public.cardapio_adicionais (id, nome, preco, avulso, ativo, ordem)
      values (v_id, v_nome, v_preco, coalesce((d ->> 'avulso')::boolean, false), v_ativo, v_ordem)
      on conflict (id) do update set nome = excluded.nome, preco = excluded.preco, avulso = excluded.avulso,
        ativo = excluded.ativo, ordem = excluded.ordem;
    when 'bebida' then
      insert into public.cardapio_bebidas (id, grupo, nome, preco, apelidos, ativo, ordem)
      values (v_id, coalesce(interno.texto(d, 'grupo', 40), 'diversas'), v_nome, v_preco,
        interno.lista_de_texto(d -> 'apelidos'), v_ativo, v_ordem)
      on conflict (id) do update set grupo = excluded.grupo, nome = excluded.nome, preco = excluded.preco,
        apelidos = excluded.apelidos, ativo = excluded.ativo, ordem = excluded.ordem;
    when 'combo' then
      insert into public.cardapio_combos (id, codigo, itens, preco, ativo, ordem)
      values (v_id, v_nome, interno.lista_de_texto(d -> 'itens'), v_preco, v_ativo, v_ordem)
      on conflict (id) do update set codigo = excluded.codigo, itens = excluded.itens, preco = excluded.preco,
        ativo = excluded.ativo, ordem = excluded.ordem;
    else
      perform interno.recusar('Tipo de item desconhecido.', 'dados_invalidos');
  end case;
  return jsonb_build_object('item_id', v_id);
end
$$;

-- "Acabou hoje": gerente, expedição ou atendimento, só na noite aberta.
create function interno.op_marcar_acabou(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n public.noites;
  v_item uuid := interno.uuid_de(d ->> 'item_id');
  v_tipo text := d ->> 'tipo';
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  n := interno.noite_aberta(interno.uuid_de(d ->> 'noite_id'));
  if v_item is null or v_tipo is null or jsonb_typeof(d -> 'acabou') is distinct from 'boolean' then
    perform interno.recusar('Dados inválidos.', 'dados_invalidos');
  end if;
  if (d ->> 'acabou')::boolean then
    insert into public.cardapio_acabou (noite_id, tipo, item_id, marcado_por)
    values (n.id, v_tipo, v_item, p_uid)
    on conflict (noite_id, item_id) do nothing;
  else
    delete from public.cardapio_acabou where noite_id = n.id and item_id = v_item;
  end if;
  return jsonb_build_object('item_id', v_item);
end
$$;

-- PED4 e F2, 2g: a gerente ou a expedição define a promoção da noite (0 = sem promoção).
create function interno.op_definir_promocao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n public.noites;
  v_desconto integer := interno.inteiro(d -> 'desconto');
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  n := interno.noite_aberta(interno.uuid_de(d ->> 'noite_id'));
  if v_desconto is null or not (v_desconto = 0 or v_desconto between 300 and 2300) then
    perform interno.recusar('A promoção da noite vai de R$ 3,00 a R$ 23,00.', 'promo_fora_da_faixa');
  end if;
  update public.noites set promo_desconto = v_desconto where id = n.id;
  return jsonb_build_object('noite_id', n.id, 'desconto', v_desconto);
end
$$;

-- Cliente pelo telefone completo (equipe do balcão). Dois aparelhos com o mesmo telefone ficam num cliente só.
create function interno.op_salvar_cliente(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_tel text := d ->> 'telefone';
  v_id uuid;
begin
  perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  if v_tel is null or v_tel !~ '^[0-9]{10,11}$' or interno.uuid_de(d ->> 'cliente_id') is null then
    perform interno.recusar('Digite o telefone com DDD.', 'telefone_invalido');
  end if;
  if d ? 'area_id' and d ->> 'area_id' is not null
    and not exists (select 1 from public.areas where id = interno.uuid_de(d ->> 'area_id')) then
    perform interno.recusar('Área não encontrada.', 'area_invalida');
  end if;
  insert into public.clientes as c (
    id, telefone, nome, local_link, local_endereco, local_referencia, area_id, atualizado_por
  ) values (
    interno.uuid_de(d ->> 'cliente_id'), v_tel, interno.texto(d, 'nome', 80), interno.texto(d, 'local_link', 500),
    interno.texto(d, 'local_endereco', 300), interno.texto(d, 'local_referencia', 300),
    interno.uuid_de(d ->> 'area_id'), p_uid
  )
  -- Só muda o que veio: o pedido que só traz o nome não apaga o local.
  on conflict (telefone) do update set
    nome = case when d ? 'nome' then excluded.nome else c.nome end,
    local_link = case when d ? 'local_link' then excluded.local_link else c.local_link end,
    local_endereco = case when d ? 'local_endereco' then excluded.local_endereco else c.local_endereco end,
    local_referencia = case when d ? 'local_referencia' then excluded.local_referencia else c.local_referencia end,
    area_id = case when d ? 'area_id' then excluded.area_id else c.area_id end,
    atualizado_por = p_uid
  returning id into v_id;
  return jsonb_build_object('cliente_id', v_id);
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa(), interno.eh_balcao() to authenticated;
