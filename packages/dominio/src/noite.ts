// Datas e horas sempre no fuso da pizzaria (config.fuso), nunca no do aparelho.

export const FUSO_PADRAO = 'America/Sao_Paulo';

function partes(instante: Date, fuso: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(instante).map((x) => [x.type, x.value]));
  return { ano: p.year ?? '', mes: p.month ?? '', dia: p.day ?? '', hora: p.hour ?? '', minuto: p.minute ?? '' };
}

/** Glossário: uma noite aberta entre 00h e 06h pertence ao dia anterior. Devolve AAAA-MM-DD. */
export function dataDaNoite(instante: Date, fuso: string = FUSO_PADRAO): string {
  const seisHorasAntes = new Date(instante.getTime() - 6 * 3600_000);
  const { ano, mes, dia } = partes(seisHorasAntes, fuso);
  return `${ano}-${mes}-${dia}`;
}

/** ISO → "23:48" no fuso da pizzaria. */
export function formatarHora(iso: string, fuso: string = FUSO_PADRAO): string {
  const { hora, minuto } = partes(new Date(iso), fuso);
  return `${hora}:${minuto}`;
}

/** AAAA-MM-DD → "16/10/2026" */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** AAAA-MM-DD → "16/10" */
export function formatarDataCurta(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}
