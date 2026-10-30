// PreToolUse (Bash): bloqueia comandos que leem segredos ou mexem na produção sem querer.
// Saída 2 bloqueia o comando e mostra o motivo ao Claude. Funciona no Windows e no Linux.
let entrada = '';
for await (const pedaco of process.stdin) entrada += pedaco;

let comando = '';
try {
  comando = JSON.parse(entrada || '{}')?.tool_input?.command ?? '';
} catch {
  process.exit(0);
}

const regras = [
  {
    // .env, .env.local, .env.production, .env.teste... mas não .env.example
    teste: /(^|[\s'"=/\\])\.env(?!\.example)(\.[\w.-]+)?(?=$|[\s'"|;&)])/i,
    motivo:
      'Comando cita um arquivo .env. Segredos não devem ser lidos nem exibidos. Use .env.example para ver os nomes das variáveis.',
  },
  {
    teste: /\.(p12|pfx|pem|key)\b|certificados[/\\]/i,
    motivo: 'Comando cita certificado ou chave privada. Isso fica fora do alcance do Claude.',
  },
  {
    teste: /(^|\s)(printenv|env)(\s*$|\s*\|)|Get-ChildItem\s+env:|\bset\s*$/i,
    motivo: 'Comando lista as variáveis de ambiente, que podem ter segredos.',
  },
  {
    teste: /supabase\s+db\s+reset\b.*--linked/i,
    motivo: 'Resetar o banco remoto (--linked) apaga dados. Só o Felipe faz isso, à mão.',
  },
  {
    teste: /git\s+push\b.*(--force\b|\s-f\b|--force-with-lease\b)/i,
    motivo: 'Push forçado reescreve o histórico. Não faça.',
  },
];

for (const { teste, motivo } of regras) {
  if (teste.test(comando)) {
    process.stderr.write(`Bloqueado: ${motivo}`);
    process.exit(2);
  }
}
process.exit(0);
