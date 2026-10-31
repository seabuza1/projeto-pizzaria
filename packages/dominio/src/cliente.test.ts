import { describe, expect, it } from 'vitest';
import { codigoDoTelefone, formatarTelefone, lerTelefone } from './cliente';

describe('telefone do cliente (F2, 2a)', () => {
  it('guarda só os dígitos, com DDD, do jeito que o atendente colar', () => {
    expect(lerTelefone('(64) 99999-3557')).toEqual({ ok: true, valor: '64999993557' });
    expect(lerTelefone('+55 66 3401-2672')).toEqual({ ok: true, valor: '6634012672' });
    expect(lerTelefone('064 9 9999 0017')).toEqual({ ok: true, valor: '64999990017' });
    expect(lerTelefone('5564999998498')).toEqual({ ok: true, valor: '64999998498' });
  });

  it('recusa telefone sem DDD ou com dígitos a mais', () => {
    expect(lerTelefone('99999-3557')).toMatchObject({ ok: false, erro: { codigo: 'telefone_invalido' } });
    expect(lerTelefone('64 99999-35577')).toMatchObject({ ok: false });
    expect(lerTelefone('')).toMatchObject({ ok: false });
  });

  it('PED1: o código são os 4 últimos dígitos', () => {
    expect(codigoDoTelefone('64999993557')).toBe('3557');
  });

  it('mostra no formato de sempre', () => {
    expect(formatarTelefone('64999993557')).toBe('(64) 99999-3557');
    expect(formatarTelefone('6634012672')).toBe('(66) 3401-2672');
  });
});
