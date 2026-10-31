// Checklist de segurança do MVP (MVP.md, Segurança): conferido no banco a cada mudança.
import { describe, expect, it } from 'vitest';
import { clienteAnonimo, sql } from './apoio';

describe('checklist de segurança (MVP.md)', () => {
  it('RLS em todas as tabelas', async () => {
    const semRls = await sql`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;
    expect(semRls).toEqual([]);
  });

  it('nenhuma tabela legível nem gravável pelo anon; a equipe só lê (toda escrita por aplicar_operacao)', async () => {
    const anon = await sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
        and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
          or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))`;
    expect(anon).toEqual([]);
    const escrita = await sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (has_table_privilege('authenticated', c.oid, 'insert')
          or has_table_privilege('authenticated', c.oid, 'update')
          or has_table_privilege('authenticated', c.oid, 'delete'))`;
    expect(escrita).toEqual([]);
  });

  it('toda função tem search_path fixo; as security definer públicas são só estas', async () => {
    const semCaminho = await sql`
      select n.nspname || '.' || p.proname as funcao from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'interno')
        and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))`;
    expect(semCaminho).toEqual([]);
    const definer = await sql<{ proname: string }[]>`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef order by 1`;
    // Função nova aqui precisa de revisão: roda com os privilégios do dono, fora da RLS.
    expect(definer.map((f) => f.proname)).toEqual([
      'aplicar_operacao',
      'area_sugerida',
      'batimento_agente',
      'registrar_erro',
    ]);
  });

  it('do esquema interno, a equipe só executa os ajudantes de papel das políticas; o anon, nada', async () => {
    const [uso] = await sql`select has_schema_privilege('anon', 'interno', 'usage') as anon`;
    expect(uso?.anon).toBe(false);
    const executa = await sql<{ proname: string }[]>`
      select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'interno' and has_function_privilege('authenticated', p.oid, 'execute') order by 1`;
    expect(executa.map((f) => f.proname)).toEqual([
      'eh_ativo',
      'eh_balcao',
      'eh_equipe',
      'meus_papeis',
      'precisa_mfa',
      'tem_papel',
    ]);
  });

  it('contas só pelo admin: o cadastro aberto está desligado', async () => {
    const { error } = await clienteAnonimo().auth.signUp({ email: 'intruso@exemplo.com', password: 'Senha-forte-123' });
    expect(error).not.toBeNull();
  });
});
