-- ARQUITETURA, Robustez: sem o agente, a equipe imprime pelo navegador como reserva e marca "impresso",
-- para o agente não imprimir de novo quando voltar. O atendimento só marca a comanda.
create or replace function interno.op_atualizar_impressao(p_uid uuid, p_papeis public.papel[], d jsonb, p_hora timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := interno.uuid_de(d ->> 'impressao_id');
  v_estado text := d ->> 'estado';
  i public.impressoes;
begin
  if v_estado is null or v_estado not in ('pendente', 'imprimindo', 'impresso', 'erro') then
    perform interno.recusar('Estado inválido.', 'dados_invalidos');
  end if;
  select * into i from public.impressoes where id = v_id for update;
  if not found then
    perform interno.recusar('Impressão não encontrada.', 'impressao_nao_encontrada');
  end if;
  if v_estado = 'impresso' and not (p_papeis && '{agente,admin}'::public.papel[]) then
    if i.tipo = 'comanda' then
      perform interno.exigir(p_papeis, 'gerente', 'expedicao', 'atendente');
    else
      perform interno.exigir(p_papeis, 'gerente', 'expedicao');
    end if;
  else
    perform interno.exigir(p_papeis, 'agente', 'admin');
  end if;
  update public.impressoes
  set estado = v_estado::public.estado_impressao,
      tentativas = tentativas + case when v_estado = 'imprimindo' then 1 else 0 end,
      erro = case when v_estado = 'erro' then left(d ->> 'erro', 500) end,
      impressa_em = case when v_estado = 'impresso' then p_hora else impressa_em end
  where id = v_id;
  return jsonb_build_object('impressao_id', v_id);
end
$$;

revoke all on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.meus_papeis(), interno.tem_papel(public.papel[]), interno.eh_equipe(),
  interno.eh_ativo(), interno.precisa_mfa(), interno.eh_balcao() to authenticated;
