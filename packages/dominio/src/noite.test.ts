import { describe, expect, it } from 'vitest';
import { dataDaNoite, formatarData, formatarDataCurta, formatarHora } from './noite';

const SP = 'America/Sao_Paulo';

describe('data da noite no fuso da pizzaria', () => {
  it('à noite vale o próprio dia', () => {
    // 16/10 às 19h em Brasília = 22h UTC
    expect(dataDaNoite(new Date('2026-10-16T22:00:00Z'), SP)).toBe('2026-10-16');
  });

  it('das 00h às 06h vale o dia anterior', () => {
    expect(dataDaNoite(new Date('2026-10-17T03:30:00Z'), SP)).toBe('2026-10-16'); // 00h30
    expect(dataDaNoite(new Date('2026-10-17T08:59:00Z'), SP)).toBe('2026-10-16'); // 05h59
    expect(dataDaNoite(new Date('2026-10-17T09:00:00Z'), SP)).toBe('2026-10-17'); // 06h00
  });

  it('não depende do fuso do aparelho (celular em MT marcando Cuiabá)', () => {
    // 23h50 em Brasília é 22h50 em Cuiabá; a noite é a mesma de qualquer jeito.
    const instante = new Date('2026-10-17T02:50:00Z');
    expect(dataDaNoite(instante, SP)).toBe('2026-10-16');
    expect(formatarHora(instante.toISOString(), SP)).toBe('23:50');
  });

  it('formata datas e horas', () => {
    expect(formatarData('2026-10-16')).toBe('16/10/2026');
    expect(formatarDataCurta('2026-10-16')).toBe('16/10');
    expect(formatarHora('2026-10-17T02:48:00Z', SP)).toBe('23:48');
  });
});
