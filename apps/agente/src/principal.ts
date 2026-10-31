// Agente de impressão (ARQUITETURA, Impressão): roda no computador do balcão.
// - escuta `impressoes` pelo Realtime e confere a fila a cada 10 s;
// - imprime na térmica da rede (TCP 9100) e marca o trabalho;
// - sem internet, imprime o que o balcão manda em http://localhost e registra depois;
// - a cada 30 s grava o batimento ("Impressora sem resposta" na tela quando para).
// Os registros não levam telefone nem endereço: só tipo, id e erro.
import { createClient } from '@supabase/supabase-js';
import { lerConfig } from './config.ts';
import { FilaSupabase } from './fila-supabase.ts';
import { ImpressoraDeRede } from './impressora-rede.ts';
import { Processador, type Registro } from './processador.ts';
import { servidorLocal } from './servidor-local.ts';

const VERSAO = '0.1.0';
const config = lerConfig(process.env);
const hora = () => new Date().toISOString();
const registro: Registro = {
  info: (m) => console.log(`${hora()} ${m}`),
  erro: (m) => console.error(`${hora()} ${m}`),
};

const db = createClient(config.supabaseUrl, config.anonKey, {
  auth: { persistSession: false, autoRefreshToken: true },
});
const impressora = new ImpressoraDeRede(config.impressora, config.impressoraHost, config.impressoraPorta);
const processador = new Processador(new FilaSupabase(db, config.impressora), impressora, registro);

// A impressão local funciona mesmo sem internet desde o primeiro minuto.
servidorLocal(processador, config.impressora).listen(config.portaLocal, '127.0.0.1', () =>
  registro.info(`impressão local em http://localhost:${config.portaLocal}`),
);

let logado = false;
async function entrar() {
  const { error } = await db.auth.signInWithPassword({ email: config.email, password: config.senha });
  if (error) {
    registro.erro(`login: ${error.message}`);
    return;
  }
  logado = true;
  registro.info('agente conectado');
  db.channel('impressoes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'impressoes' }, () => void processador.rodar())
    .subscribe();
  void processador.rodar();
}

async function batimento() {
  if (!logado) return;
  const ok = await impressora.testar();
  const { error } = await db.rpc('batimento_agente', {
    p: {
      impressora: `${config.impressoraHost}:${config.impressoraPorta}`,
      impressora_ok: ok,
      erro: ok ? null : 'Impressora sem resposta',
      versao: VERSAO,
    },
  });
  if (error) registro.erro(`batimento: ${error.message}`);
}

void entrar();
setInterval(() => (logado ? void processador.rodar() : void entrar()), 10_000);
setInterval(() => void batimento(), 30_000);
