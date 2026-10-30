-- Índices das chaves estrangeiras (Supabase Advisors: unindexed_foreign_keys).
create index acertos_confirmado_por on public.acertos (confirmado_por);
create index acertos_reaberto_por on public.acertos (reaberto_por);
create index sobras_acerto on public.sobras (acerto_id);
create index faltas_acerto on public.faltas (acerto_id);
create index impressoes_noite on public.impressoes (noite_id);
create index impressoes_caixa on public.impressoes (caixa_id);
create index impressoes_pedida_por on public.impressoes (pedida_por);
create index noites_aberta_por on public.noites (aberta_por);
create index noites_fechada_por on public.noites (fechada_por);
create index pagamentos_pix_confirmado_por on public.pagamentos (pix_confirmado_por);
create index pedidos_area on public.pedidos (area_id);
create index pedidos_criado_por on public.pedidos (criado_por);
create index saidas_area on public.saidas (area_id);
