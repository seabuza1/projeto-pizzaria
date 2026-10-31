-- F2, 2b: estados do pedido do atendimento. Rascunho → aguardando cliente → em produção → saiu (saída) ou
-- retirado · cancelado. "aberto" continua sendo o pedido que saiu e ainda não teve o acerto.
-- Numa migração à parte: valor novo de enum só pode ser usado depois de gravado.
alter type public.estado_pedido add value if not exists 'rascunho';
alter type public.estado_pedido add value if not exists 'aguardando';
alter type public.estado_pedido add value if not exists 'em_producao';
alter type public.estado_pedido add value if not exists 'retirado';
