// Padrões de credenciais usados pelos hooks. Um lugar só, para os dois hooks bloquearem igual.
export const PADROES_SEGREDO = [
  { nome: 'chave da Anthropic', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { nome: 'chave da OpenAI', re: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/ },
  { nome: 'chave secreta do Supabase', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  {
    nome: 'token JWT (chave anon/service_role do Supabase ou sessão)',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { nome: 'URL do Postgres com senha', re: /\bpostgres(ql)?:\/\/[^:\s/]+:[^@\s]+@/i },
  { nome: 'token da Meta/WhatsApp', re: /\bEAA[A-Za-z0-9]{30,}/ },
  { nome: 'chave de API do Google', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { nome: 'token do GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { nome: 'token do Mercado Pago', re: /\bAPP_USR-[0-9a-f-]{20,}/i },
  { nome: 'chave da AWS', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nome: 'chave privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

export function acharSegredo(texto) {
  if (!texto) return null;
  for (const { nome, re } of PADROES_SEGREDO) {
    if (re.test(texto)) return nome;
  }
  return null;
}
