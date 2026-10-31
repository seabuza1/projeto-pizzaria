-- O atendimento só pede e só vê a comanda. Recibo do acerto e folha da noite têm o dinheiro dos motoboys:
-- ficam com a expedição, a gerente e o admin (e o agente, que imprime).

create or replace function interno.op_pedir_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_impressa boolean := coalesce((d ->> 'impressa')::boolean, false);
begin
  if d ->> 'tipo' = 'comanda' then
    perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao', 'atendente');
  else
    perform interno.exigir(p_papeis, 'admin', 'gerente', 'expedicao');
  end if;
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

drop policy impressoes_leitura on public.impressoes;
create policy impressoes_leitura on public.impressoes for select to authenticated
  using (
    (select interno.tem_papel('admin', 'gerente', 'expedicao', 'agente'))
    or ((select interno.tem_papel('atendente')) and tipo = 'comanda')
    or pedida_por = (select auth.uid())
  );

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa(), interno.eh_balcao() to authenticated;
