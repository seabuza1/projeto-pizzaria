// Impressão sem internet: o balcão manda o trabalho direto ao agente em http://localhost (ARQUITETURA, Impressão).
// Só escuta em 127.0.0.1. O Chrome pede permissão de rede local: a resposta ao preflight libera.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { TipoImpressao } from '@mel/dominio';
import { type Processador, TIPOS } from './processador.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CORPO = 64 * 1024;

function responder(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    let corpo = '';
    req.setEncoding('utf8');
    req.on('data', (pedaco: string) => {
      corpo += pedaco;
      if (corpo.length > MAX_CORPO) rejeitar(new Error('grande demais'));
    });
    req.on('end', () => resolver(corpo));
    req.on('error', rejeitar);
  });
}

export function servidorLocal(processador: Processador, impressora: string): Server {
  return createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return responder(res, 204, null);
    if (req.method === 'GET' && req.url === '/saude') return responder(res, 200, { ok: true, impressora });
    if (req.method !== 'POST' || req.url !== '/imprimir') return responder(res, 404, { erro: 'Não encontrado.' });
    let dados: Record<string, unknown>;
    try {
      dados = JSON.parse(await lerCorpo(req)) as Record<string, unknown>;
    } catch {
      return responder(res, 400, { erro: 'Dados inválidos.' });
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
      return responder(res, 400, { erro: 'Dados inválidos.' });
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
    return responder(res, r.ok ? 200 : 502, r);
  });
}
