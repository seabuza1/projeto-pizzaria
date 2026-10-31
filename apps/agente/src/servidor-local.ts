// Impressão sem internet: o balcão manda o trabalho direto ao agente em http://localhost (ARQUITETURA, Impressão).
// Só escuta em 127.0.0.1 e só atende as origens do app (MEL_AGENTE_ORIGENS): outro site aberto no computador
// do balcão não manda imprimir. O pedido é sempre JSON, o que força o preflight do navegador; a resposta ao
// preflight libera o acesso à rede local do Chrome só para essas origens.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { TipoImpressao } from '@mel/dominio';
import { type Processador, TIPOS } from './processador.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CORPO = 64 * 1024;

function responder(res: ServerResponse, status: number, corpo: unknown, origem: string | null) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    ...(origem
      ? {
          'Access-Control-Allow-Origin': origem,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Private-Network': 'true',
        }
      : {}),
  });
  res.end(corpo === null ? undefined : JSON.stringify(corpo));
}

/** Lê o corpo até o limite; passou do limite, corta a conexão. */
function lerCorpo(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolver, rejeitar) => {
    let corpo = '';
    req.setEncoding('utf8');
    req.on('data', (pedaco: string) => {
      corpo += pedaco;
      if (corpo.length > MAX_CORPO) {
        req.removeAllListeners('data');
        req.resume();
        resolver(null);
      }
    });
    req.on('end', () => resolver(corpo));
    req.on('error', rejeitar);
  });
}

export function servidorLocal(processador: Processador, impressora: string, origens: readonly string[]): Server {
  return createServer(async (req, res) => {
    const origem =
      typeof req.headers.origin === 'string' && origens.includes(req.headers.origin) ? req.headers.origin : null;
    if (req.method === 'OPTIONS') return responder(res, origem ? 204 : 403, null, origem);
    if (!origem) return responder(res, 403, { erro: 'Origem não autorizada.' }, null);
    if (req.method === 'GET' && req.url === '/saude') return responder(res, 200, { ok: true, impressora }, origem);
    if (req.method !== 'POST' || req.url !== '/imprimir')
      return responder(res, 404, { erro: 'Não encontrado.' }, origem);
    if (!req.headers['content-type']?.startsWith('application/json')) {
      return responder(res, 415, { erro: 'Mande JSON.' }, origem);
    }
    const texto = await lerCorpo(req);
    if (texto === null) return responder(res, 413, { erro: 'Grande demais.' }, origem);
    let dados: Record<string, unknown>;
    try {
      dados = JSON.parse(texto) as Record<string, unknown>;
    } catch {
      return responder(res, 400, { erro: 'Dados inválidos.' }, origem);
    }
    const { id, tipo, conteudo } = dados;
    const opcional = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : undefined);
    if (
      typeof id !== 'string' ||
      !UUID.test(id) ||
      !TIPOS.includes(tipo as TipoImpressao) ||
      typeof conteudo !== 'string' ||
      conteudo.length < 1 ||
      conteudo.length > 20000
    ) {
      return responder(res, 400, { erro: 'Dados inválidos.' }, origem);
    }
    const noiteId = opcional(dados.noite_id);
    const caixaId = opcional(dados.caixa_id);
    const pedidoId = opcional(dados.pedido_id);
    const r = await processador.imprimirLocal({
      id,
      tipo: tipo as TipoImpressao,
      conteudo,
      ...(noiteId ? { noiteId } : {}),
      ...(caixaId ? { caixaId } : {}),
      ...(pedidoId ? { pedidoId } : {}),
    });
    return responder(res, r.ok ? 200 : 502, r, origem);
  });
}
