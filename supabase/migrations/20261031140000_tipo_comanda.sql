-- F2, 2c: a comanda impressa entra na fila de impressão. Numa migração à parte: valor novo de enum só pode
-- ser usado depois de gravado.
alter type public.tipo_impressao add value if not exists 'comanda';
