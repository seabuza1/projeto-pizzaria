#!/usr/bin/env bash
# Ensaio de restauração do backup (MVP.md, Segurança), no Supabase local: pg_dump dos esquemas da Mel,
# restaura num banco novo, confere tabela por tabela as contagens e as políticas, e apaga o banco do ensaio.
# Em produção, o ensaio é restaurar o backup do Supabase num projeto de teste (docs/CONTINGENCIA.md).
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_mel-pdv}"
ENSAIO=ensaio_restauracao
psql_em() { docker exec -i "$CONTAINER" psql -U postgres -d "$1" -tA -v ON_ERROR_STOP=1 -c "$2"; }

echo "1. Backup (pg_dump de public, interno e auth)"
docker exec "$CONTAINER" pg_dump -U postgres -Fc --schema=public --schema=interno --schema=auth -f /tmp/mel.dump postgres

echo "2. Restauração num banco novo ($ENSAIO)"
psql_em postgres "drop database if exists $ENSAIO" >/dev/null
psql_em postgres "create database $ENSAIO" >/dev/null
# Erros esperados: o esquema public já existe e os privilégios padrão de papéis do Supabase.
docker exec "$CONTAINER" pg_restore -U postgres -d "$ENSAIO" --no-owner /tmp/mel.dump 2>/dev/null || true

echo "3. Conferência"
contagens() {
  psql_em "$1" "select string_agg(t, ',' order by t) from (
    select format('%s=%s', table_name,
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text) as t
    from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') x"
}
politicas() { psql_em "$1" "select count(*) from pg_policies where schemaname = 'public'"; }
ORIGEM="$(contagens postgres) politicas=$(politicas postgres)"
COPIA="$(contagens $ENSAIO) politicas=$(politicas $ENSAIO)"
psql_em postgres "drop database $ENSAIO" >/dev/null
docker exec "$CONTAINER" rm -f /tmp/mel.dump

if [ "$ORIGEM" = "$COPIA" ]; then
  echo "OK: todas as tabelas e políticas voltaram iguais."
  echo "$ORIGEM" | tr ',' '\n' | sed 's/^/   /'
else
  echo "FALHOU: a cópia não bate com a origem."
  diff <(echo "$ORIGEM" | tr ',' '\n') <(echo "$COPIA" | tr ',' '\n') || true
  exit 1
fi
