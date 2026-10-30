// PreToolUse (Edit|Write): impede que um segredo seja escrito em arquivo e que arquivos .env sejam escritos pelo Claude.
// Segredos vão só para o .env (preenchido à mão pelo Felipe) ou para os secrets do Supabase.
import { acharSegredo } from './padroes-segredos.mjs';

let entrada = '';
for await (const pedaco of process.stdin) entrada += pedaco;

let entradaFerramenta = {};
try {
  entradaFerramenta = JSON.parse(entrada || '{}')?.tool_input ?? {};
} catch {
  process.exit(0);
}

const arquivo = String(entradaFerramenta.file_path ?? '');
const nomeArquivo = arquivo.split(/[/\\]/).pop() ?? '';

if (/^\.env(\..+)?$/i.test(nomeArquivo) && nomeArquivo.toLowerCase() !== '.env.example') {
  process.stderr.write(
    `Bloqueado: o Claude não escreve ${nomeArquivo}. O Felipe preenche esse arquivo à mão; use .env.example para listar as variáveis.`,
  );
  process.exit(2);
}

const textos = [
  entradaFerramenta.content,
  entradaFerramenta.new_string,
  ...(Array.isArray(entradaFerramenta.edits) ? entradaFerramenta.edits.map((e) => e?.new_string) : []),
].filter((t) => typeof t === 'string');

for (const texto of textos) {
  const achado = acharSegredo(texto);
  if (achado) {
    process.stderr.write(
      `Bloqueado: o conteúdo para ${arquivo || 'o arquivo'} parece ter ${achado}. Leia o valor de uma variável de ambiente ou de um secret do Supabase, nunca escreva no código.`,
    );
    process.exit(2);
  }
}
process.exit(0);
