// MFA (decisão 0005): o primeiro autenticador de admin e gerente só se cadastra com a liberação do admin.
import { afterEach, describe, expect, it } from 'vitest';
import { aplicada, CONTAS, codigoTotp, entrar, sql } from './apoio';

const nova = CONTAS.nova.id;

afterEach(async () => {
  await sql`delete from auth.mfa_factors where user_id = ${nova}`;
  await sql`update public.perfis set mfa_liberado_ate = null where id = ${nova}`;
});

async function cadastrarAutenticador() {
  const s = await entrar('nova', { semMfa: true });
  const { data, error } = await s.db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'teste' });
  if (error || !data) throw error ?? new Error('sem fator');
  return { s, fatorId: data.id, segredo: data.totp.secret };
}

describe('cadastro do primeiro autenticador', () => {
  it('sem a liberação do admin, quem tem só a senha não cadastra o autenticador', async () => {
    const { s, fatorId, segredo } = await cadastrarAutenticador();
    const r = await s.db.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigoTotp(segredo) });
    expect(r.error?.message).toMatch(/não liberado/);
    const nivel = await s.db.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(nivel.data?.currentLevel).toBe('aal1');
  });

  it('com a liberação (30 min), a gerente cadastra e entra com o código', async () => {
    const felipe = await entrar('felipe');
    aplicada(await felipe.op('salvar_perfil', { perfil_id: nova, liberar_mfa: true }));
    const [l] = await sql`select mfa_liberado_ate - now() between interval '29 minutes' and interval '31 minutes' as ok
      from public.perfis where id = ${nova}`;
    expect(l?.ok).toBe(true);

    const { s, fatorId, segredo } = await cadastrarAutenticador();
    const r = await s.db.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigoTotp(segredo) });
    expect(r.error).toBeNull();
    const nivel = await s.db.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(nivel.data?.currentLevel).toBe('aal2');
  });

  it('só o admin libera', async () => {
    const dona = await entrar('dona');
    const r = await dona.op('salvar_perfil', { perfil_id: nova, liberar_mfa: true });
    expect(r.codigo).toBe('sem_permissao');
  });
});
