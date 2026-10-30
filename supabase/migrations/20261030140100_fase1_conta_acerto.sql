-- Conta do acerto no servidor: a confirmação (ACE9) não confia no aparelho.
-- Espelha packages/dominio/src/acerto.ts; supabase/tests/acerto-sql.test.ts compara os dois.

-- ACE4 a ACE6.
create function interno.liquidar(
  p_caixa_inicial integer, p_devolver integer, p_receber integer, p_contado integer
) returns jsonb
language sql immutable set search_path = '' as $$
  with l as (
    select
      p_contado - p_devolver as dif,
      greatest(0, p_devolver - p_contado) as falta,
      greatest(0, p_contado - p_devolver) as sobra
  ), p as (
    select l.*,
      greatest(0, p_receber - l.falta) as pagar,
      greatest(0, l.falta - p_receber) as completa
    from l
  ), c as (
    select p.*, least(p_caixa_inicial, p.pagar, p_contado) as do_caixa_dele from p
  )
  select jsonb_build_object(
    'dinheiroContado', p_contado,
    'dif', c.dif,
    'falta', c.falta,
    'sobra', c.sobra,
    'pagar', c.pagar,
    'completa', c.completa,
    'doCaixaDele', c.do_caixa_dele,
    'retiradoCaixaEmpresa', c.pagar - c.do_caixa_dele,
    'vaiParaEmpresa', p_contado - c.do_caixa_dele + c.completa
  )
  from c
$$;

-- Totais de um caixa. Com p_contado, inclui a liquidação.
create function interno.conta_caixa(p_caixa uuid, p_contado integer default null) returns jsonb
language sql stable set search_path = '' as $$
  with cx as (
    select c.caixa_inicial, c.diaria from public.caixas c where c.id = p_caixa
  ), s as (
    select * from public.saidas where caixa_id = p_caixa
  ), entregues as (
    -- ENT5: em rota no fechamento conta como entregue (com aviso no aparelho).
    select * from s where estado <> 'voltou'
  ), escopo as (
    -- Pagamentos de cada saída entregue: os do pedido ligados a ela ou só ao pedido (Pix antecipado).
    select e.id as saida_ref, p.*
    from entregues e
    join public.pagamentos p on p.pedido_id = e.pedido_id and (p.saida_id = e.id or p.saida_id is null)
  ), escolhidos as (
    -- PAG3: os reais, se houver; senão os previstos.
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

revoke all on function interno.liquidar(integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function interno.conta_caixa(uuid, integer) from public, anon, authenticated;
