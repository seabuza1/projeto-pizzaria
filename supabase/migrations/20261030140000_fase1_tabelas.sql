-- Fase 1: tipos, tabelas, registro de mudanças (OPE2) e RLS.
-- Toda escrita das telas passa por public.aplicar_operacao (migração seguinte).
-- Por isso as tabelas só têm políticas de leitura: anon e authenticated não escrevem direto.

create schema if not exists interno;
revoke all on schema interno from public, anon, authenticated;
grant usage on schema interno to authenticated, service_role;

-- Tipos -----------------------------------------------------------------------

create type public.papel as enum (
  'admin', 'gerente', 'expedicao', 'atendente', 'motoboy', 'cozinha', 'garcom', 'agente'
);
create type public.ambiente as enum ('producao', 'teste');
-- PAG1 sem o crédito do cliente (fase 2: alter type ... add value).
create type public.forma_pagamento as enum ('dinheiro', 'cartao', 'pix_maquininha', 'pix_antecipado');
create type public.origem_pagamento as enum ('manual', 'webhook', 'maquininha');
-- ENT5
create type public.estado_saida as enum ('separada', 'em_rota', 'entregue', 'voltou');
-- PED5
create type public.origem_pedido as enum ('papel', 'whatsapp', 'balcao', 'mesa', 'link');
create type public.tipo_pedido as enum ('entrega', 'retirada', 'mesa');
create type public.estado_pedido as enum ('aberto', 'entregue', 'cancelado');
create type public.tipo_impressao as enum ('recibo_acerto', 'folha_noite');
create type public.estado_impressao as enum ('pendente', 'imprimindo', 'impresso', 'erro');

-- atualizado_em ----------------------------------------------------------------

create function interno.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

-- Tabelas ---------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 60),
  -- O Felipe é admin e motoboy (PROJETO, seção 3).
  papeis public.papel[] not null check (cardinality(papeis) >= 1),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.config (
  id uuid primary key default gen_random_uuid(),
  unica boolean not null default true unique check (unica),
  -- OPE e glossário: sempre o fuso da pizzaria, nunca o do aparelho.
  fuso text not null default 'America/Sao_Paulo',
  ambiente public.ambiente not null default 'producao',
  caixa_inicial_padrao integer not null default 8000 check (caixa_inicial_padrao >= 0),
  diaria_padrao integer not null default 3000 check (diaria_padrao >= 0),
  -- OPE1
  fases_ligadas text[] not null default '{F1}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) between 1 and 40),
  cidade text not null check (length(trim(cidade)) between 1 and 60),
  -- ENT1, em centavos. ENT2: a saída grava a taxa; mudar aqui não muda saídas antigas.
  taxa integer not null check (taxa >= 0),
  ativa boolean not null default true,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.noites (
  id uuid primary key default gen_random_uuid(),
  -- Das 00h às 06h vale o dia anterior, no fuso da pizzaria.
  data date not null unique,
  promo_desconto integer check (promo_desconto between 300 and 2300),
  aberta_em timestamptz not null default now(),
  aberta_por uuid references public.perfis (id),
  fechada_em timestamptz,
  fechada_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.caixas (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  motoboy_id uuid not null references public.perfis (id),
  caixa_inicial integer not null check (caixa_inicial >= 0),
  diaria integer not null check (diaria >= 0),
  -- ACE7
  ordem_chegada smallint not null check (ordem_chegada >= 1),
  dinheiro_contado integer check (dinheiro_contado >= 0),
  -- "Volto em 5": quando ele disse que volta.
  retorno_em timestamptz,
  fechado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (noite_id, motoboy_id),
  unique (noite_id, ordem_chegada)
);
create index caixas_motoboy on public.caixas (motoboy_id);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  -- PED1: 4 últimos dígitos do telefone; pode repetir na noite.
  codigo text not null check (codigo ~ '^[0-9]{4}$'),
  origem public.origem_pedido not null,
  tipo public.tipo_pedido not null default 'entrega',
  area_id uuid references public.areas (id),
  -- PED2: o total inclui a taxa.
  total integer not null check (total > 0),
  promocao boolean not null default false,
  estado public.estado_pedido not null default 'aberto',
  obs text check (length(obs) <= 500),
  criado_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pedidos_noite on public.pedidos (noite_id);
create index pedidos_codigo on public.pedidos (codigo, criado_em desc);

create table public.saidas (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  caixa_id uuid not null references public.caixas (id),
  motoboy_id uuid not null references public.perfis (id),
  area_id uuid not null references public.areas (id),
  -- ENT2: taxa gravada na saída.
  taxa integer not null check (taxa >= 0),
  estado public.estado_saida not null default 'em_rota',
  saiu_em timestamptz,
  entregue_em timestamptz,
  voltou_em timestamptz,
  -- ACE8
  papel_conferido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index saidas_noite on public.saidas (noite_id);
create index saidas_pedido on public.saidas (pedido_id);
create index saidas_caixa on public.saidas (caixa_id);
create index saidas_motoboy on public.saidas (motoboy_id);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  -- Quem recebeu na porta. Pix antecipado fica só no pedido.
  saida_id uuid references public.saidas (id),
  forma public.forma_pagamento not null,
  valor integer not null check (valor > 0),
  troco_pix integer not null default 0 check (troco_pix >= 0),
  -- PAG3: false = prevista na comanda; true = confirmada na porta.
  real boolean not null default false,
  -- PAG5
  pix_confirmado boolean not null default false,
  pix_confirmado_por uuid references public.perfis (id),
  pix_confirmado_em timestamptz,
  origem public.origem_pagamento not null default 'manual',
  referencia_externa text check (length(referencia_externa) <= 100),
  -- Hora do registro no aparelho (validada), para a ordem da lista da maquininha.
  registrado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- PAG4: troco por Pix só na parte em dinheiro.
  check (troco_pix = 0 or forma = 'dinheiro'),
  check ((forma = 'pix_antecipado') = (saida_id is null))
);
create index pagamentos_noite on public.pagamentos (noite_id);
create index pagamentos_pedido on public.pagamentos (pedido_id);
create index pagamentos_saida on public.pagamentos (saida_id);

create table public.acertos (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid not null references public.noites (id),
  caixa_id uuid not null references public.caixas (id),
  -- ACE9: valores do momento da confirmação, calculados no servidor.
  dinheiro_contado integer not null,
  devolver integer not null,
  maquininha integer not null,
  receber integer not null,
  falta integer not null,
  sobra integer not null,
  pagar integer not null,
  completa integer not null,
  do_caixa_dele integer not null,
  retirado_caixa_empresa integer not null,
  vai_para_empresa integer not null,
  -- Conta completa para o recibo e o histórico (ACE10).
  conta jsonb not null,
  confirmado_por uuid not null references public.perfis (id),
  confirmado_em timestamptz not null default now(),
  reaberto_por uuid references public.perfis (id),
  reaberto_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index acertos_um_valido_por_caixa on public.acertos (caixa_id) where reaberto_em is null;
create index acertos_noite on public.acertos (noite_id);

-- ACE6: sobra retida até descobrir a origem.
create table public.sobras (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas (id),
  acerto_id uuid not null references public.acertos (id) on delete cascade,
  valor integer not null check (valor > 0),
  origem text check (length(origem) <= 300),
  resolvida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index sobras_caixa on public.sobras (caixa_id);

-- ACE5: falta descontada; se o erro aparecer depois, o valor é devolvido.
create table public.faltas (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas (id),
  acerto_id uuid not null references public.acertos (id) on delete cascade,
  valor integer not null check (valor > 0),
  origem text check (length(origem) <= 300),
  devolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index faltas_caixa on public.faltas (caixa_id);

create table public.impressoes (
  id uuid primary key default gen_random_uuid(),
  noite_id uuid references public.noites (id),
  caixa_id uuid references public.caixas (id),
  tipo public.tipo_impressao not null,
  impressora text not null default 'balcao' check (length(impressora) <= 40),
  -- Marcação ReceiptLine (packages/dominio/src/impressao).
  conteudo text not null check (length(conteudo) <= 20000),
  estado public.estado_impressao not null default 'pendente',
  tentativas smallint not null default 0,
  erro text check (length(erro) <= 500),
  pedida_por uuid references public.perfis (id),
  impressa_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index impressoes_estado on public.impressoes (estado, criado_em);

-- Fila aplicada: idempotência de aplicar_operacao.
create table public.operacoes (
  id uuid primary key,
  tipo text not null check (length(tipo) <= 40),
  dados jsonb not null,
  autor uuid not null references public.perfis (id),
  aparelho text check (length(aparelho) <= 80),
  criada_em timestamptz,
  status text not null check (status in ('aplicada', 'recusada')),
  motivo text,
  resultado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index operacoes_autor on public.operacoes (autor, criado_em desc);

-- OPE2: quem fez o quê e quando.
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  operacao_id uuid,
  autor uuid,
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('insert', 'update', 'delete')),
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index eventos_registro on public.eventos (tabela, registro_id);
create index eventos_operacao on public.eventos (operacao_id);

-- Erros do front, do agente e das funções. Sem dados de cliente.
create table public.erros (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('web', 'agente', 'funcao', 'banco')),
  mensagem text not null check (length(mensagem) <= 1000),
  pilha text check (length(pilha) <= 8000),
  contexto jsonb,
  versao text check (length(versao) <= 40),
  autor uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index erros_criado on public.erros (criado_em desc);

-- Gatilhos de atualizado_em ---------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfis', 'config', 'areas', 'noites', 'caixas', 'pedidos', 'saidas', 'pagamentos', 'acertos',
    'sobras', 'faltas', 'impressoes', 'operacoes', 'eventos', 'erros'
  ] loop
    execute format(
      'create trigger tocar_atualizado_em before update on public.%I '
      'for each row execute function interno.tocar_atualizado_em()', t);
  end loop;
end
$$;

-- Registro de mudanças (OPE2) -------------------------------------------------

create function interno.registrar_evento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then
    return null;
  end if;
  insert into public.eventos (operacao_id, autor, tabela, registro_id, acao, antes, depois)
  values (
    nullif(current_setting('mel.operacao_id', true), '')::uuid,
    coalesce(nullif(current_setting('mel.autor', true), '')::uuid, auth.uid()),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    v_antes,
    v_depois
  );
  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['noites', 'caixas', 'pedidos', 'saidas', 'pagamentos', 'acertos', 'sobras', 'faltas'] loop
    execute format(
      'create trigger registrar_evento after insert or update or delete on public.%I '
      'for each row execute function interno.registrar_evento()', t);
  end loop;
end
$$;

-- Papéis do usuário logado ----------------------------------------------------

create function interno.meus_papeis() returns public.papel[]
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.papeis from public.perfis p where p.id = (select auth.uid()) and p.ativo),
    '{}'::public.papel[]
  )
$$;

create function interno.tem_papel(variadic p_papeis public.papel[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select interno.meus_papeis() && p_papeis
$$;

-- Expedição, gerente ou admin: quem vê a noite inteira e faz o acerto (ACE9).
create function interno.eh_equipe() returns boolean
language sql stable security definer set search_path = '' as $$
  select interno.tem_papel('admin', 'gerente', 'expedicao')
$$;

create function interno.eh_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select cardinality(interno.meus_papeis()) > 0
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo() to authenticated;

-- Acesso ----------------------------------------------------------------------

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema interno revoke all on functions from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfis', 'config', 'areas', 'noites', 'caixas', 'pedidos', 'saidas', 'pagamentos', 'acertos',
    'sobras', 'faltas', 'impressoes', 'operacoes', 'eventos', 'erros'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end
$$;

-- Nome e papéis da equipe: para mostrar "Confirmado por Luan". O agente vê só o próprio.
create policy perfis_leitura on public.perfis for select to authenticated
  using (
    id = (select auth.uid())
    or (select interno.tem_papel('admin', 'gerente', 'expedicao', 'atendente', 'motoboy', 'cozinha', 'garcom'))
  );

create policy config_leitura on public.config for select to authenticated
  using ((select interno.eh_ativo()));

create policy areas_leitura on public.areas for select to authenticated
  using ((select interno.eh_ativo()));

create policy noites_leitura on public.noites for select to authenticated
  using ((select interno.eh_ativo()));

-- ENT8: cada motoboy vê só o próprio caixa e as próprias saídas.
create policy caixas_leitura on public.caixas for select to authenticated
  using (motoboy_id = (select auth.uid()) or (select interno.eh_equipe()));

create policy saidas_leitura on public.saidas for select to authenticated
  using (motoboy_id = (select auth.uid()) or (select interno.eh_equipe()));

create policy pedidos_leitura on public.pedidos for select to authenticated
  using (
    (select interno.eh_equipe())
    or exists (
      select 1 from public.saidas s where s.pedido_id = pedidos.id and s.motoboy_id = (select auth.uid())
    )
  );

create policy pagamentos_leitura on public.pagamentos for select to authenticated
  using (
    (select interno.eh_equipe())
    or exists (
      select 1 from public.saidas s where s.pedido_id = pagamentos.pedido_id and s.motoboy_id = (select auth.uid())
    )
  );

create policy acertos_leitura on public.acertos for select to authenticated
  using (
    (select interno.eh_equipe())
    or exists (select 1 from public.caixas c where c.id = acertos.caixa_id and c.motoboy_id = (select auth.uid()))
  );

create policy sobras_leitura on public.sobras for select to authenticated
  using (
    (select interno.eh_equipe())
    or exists (select 1 from public.caixas c where c.id = sobras.caixa_id and c.motoboy_id = (select auth.uid()))
  );

create policy faltas_leitura on public.faltas for select to authenticated
  using (
    (select interno.eh_equipe())
    or exists (select 1 from public.caixas c where c.id = faltas.caixa_id and c.motoboy_id = (select auth.uid()))
  );

create policy impressoes_leitura on public.impressoes for select to authenticated
  using (
    (select interno.tem_papel('admin', 'gerente', 'expedicao', 'agente')) or pedida_por = (select auth.uid())
  );

create policy operacoes_leitura on public.operacoes for select to authenticated
  using (autor = (select auth.uid()) or (select interno.tem_papel('admin')));

create policy eventos_leitura on public.eventos for select to authenticated
  using ((select interno.tem_papel('admin', 'gerente')));

create policy erros_leitura on public.erros for select to authenticated
  using ((select interno.tem_papel('admin')));

-- Dados iniciais (valem também em produção) -----------------------------------

insert into public.config default values;

-- ENT1: taxa padrão por cidade e a área com taxa própria conhecida.
insert into public.areas (nome, cidade, taxa, ordem) values
  ('Aragarças', 'Aragarças', 500, 1),
  ('Barra', 'Barra do Garças', 1200, 2),
  ('Pontal', 'Pontal do Araguaia', 1000, 3),
  ('Parque de Exposições', 'Barra do Garças', 1500, 4);

-- Tempo real: o painel e o app recebem as mudanças da noite.
alter publication supabase_realtime add table
  public.config, public.areas, public.noites, public.caixas, public.pedidos, public.saidas, public.pagamentos,
  public.acertos, public.impressoes, public.perfis;
