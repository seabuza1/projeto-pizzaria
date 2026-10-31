import { describe, expect, it } from 'vitest';
import { situacaoDaImpressora } from './impressora';

const agora = new Date('2026-10-16T23:00:00Z');
const antes = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();

describe('batimento do agente (ARQUITETURA, Robustez)', () => {
  it('bateu há pouco e a impressora atende: ok', () => {
    expect(situacaoDaImpressora({ vistoEm: antes(30), impressoraOk: true }, agora)).toBe('ok');
  });
  it('sem sinal há mais de 2 minutos, ou a impressora não atende: "Impressora sem resposta"', () => {
    expect(situacaoDaImpressora({ vistoEm: antes(121), impressoraOk: true }, agora)).toBe('sem_resposta');
    expect(situacaoDaImpressora({ vistoEm: antes(10), impressoraOk: false }, agora)).toBe('sem_resposta');
  });
  it('o agente nunca bateu', () => {
    expect(situacaoDaImpressora(null, agora)).toBe('sem_agente');
  });
});
