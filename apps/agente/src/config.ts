// Configuração do agente pelo ambiente (arquivo .env ao lado, fora do repositório). Nunca grava nem mostra a senha.

export interface Config {
  supabaseUrl: string;
  anonKey: string;
  email: string;
  senha: string;
  /** Nome da impressora na fila (impressoes.impressora). */
  impressora: string;
  impressoraHost: string;
  impressoraPorta: number;
  /** Porta da impressão sem internet, só em localhost (ARQUITETURA, Impressão). */
  portaLocal: number;
}

export function lerConfig(env: Record<string, string | undefined>): Config {
  const faltam = [
    'MEL_SUPABASE_URL',
    'MEL_SUPABASE_ANON_KEY',
    'MEL_AGENTE_EMAIL',
    'MEL_AGENTE_SENHA',
    'MEL_IMPRESSORA_HOST',
  ].filter((k) => !env[k]);
  if (faltam.length > 0) throw new Error(`Faltam no ambiente: ${faltam.join(', ')}`);
  const porta = (valor: string | undefined, padrao: number) => {
    const n = Number(valor ?? padrao);
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`Porta inválida: ${valor}`);
    return n;
  };
  return {
    supabaseUrl: env.MEL_SUPABASE_URL ?? '',
    anonKey: env.MEL_SUPABASE_ANON_KEY ?? '',
    email: env.MEL_AGENTE_EMAIL ?? '',
    senha: env.MEL_AGENTE_SENHA ?? '',
    impressora: env.MEL_IMPRESSORA_NOME ?? 'balcao',
    impressoraHost: env.MEL_IMPRESSORA_HOST ?? '',
    impressoraPorta: porta(env.MEL_IMPRESSORA_PORTA, 9100),
    portaLocal: porta(env.MEL_AGENTE_PORTA_LOCAL, 9180),
  };
}
