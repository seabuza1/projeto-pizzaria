// Agente de impressão com uma impressora falsa: um servidor TCP que guarda os bytes, como a térmica na porta 9100.
import { randomUUID } from 'node:crypto';
import { type AddressInfo, createServer, type Server } from 'node:net';
import { VERSAO_OP } from '@mel/db';
import { comandaDoPedido, type Resultado, type TrabalhoImpressao } from '@mel/dominio';
import { afterEach, describe, expect, it } from 'vitest';
import { lerConfig } from './config.ts';
import { VERSAO_OP_AGENTE } from './fila-supabase.ts';
import { ImpressoraDeRede } from './impressora-rede.ts';
import { type EstadoImpressao, type Fila, Processador, type TrabalhoLocal } from './processador.ts';
import { servidorLocal } from './servidor-local.ts';

const abertos: { close: () => void }[] = [];
afterEach(() => {
  for (const a of abertos.splice(0)) a.close();
});

/** Térmica falsa: devolve a porta e o que chegou em cada conexão. */
async function termica(): Promise<{ porta: number; recebidos: Buffer[] }> {
  const recebidos: Buffer[] = [];
  const servidor: Server = createServer((s) => {
    const partes: Buffer[] = [];
    s.on('data', (b: Buffer) => partes.push(b));
    s.on('end', () => recebidos.push(Buffer.concat(partes)));
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  abertos.push(servidor);
  return { porta: (servidor.address() as AddressInfo).port, recebidos };
}

const comanda = comandaDoPedido({
  codigo: '3557',
  promocao: false,
  alterado: false,
  linhas: [{ nome: 'Refrigerante 2L', detalhes: [], quantidade: 1, desconto: 0 as never, total: 1500 as never }],
  tipo: 'retirada',
  area: null,
  endereco: null,
  referencia: null,
  link: null,
  telefone: '64999993557',
  cliente: null,
  total: 1500 as never,
  pagamentos: [{ forma: 'dinheiro', valor: 1500 as never }],
  trocoPara: null,
  pixPago: null,
  data: '2026-10-16',
  hora: '21:48',
});
const trabalho = (id: string = randomUUID()): TrabalhoImpressao => ({ id, tipo: 'comanda', conteudo: comanda });

class FilaFalsa implements Fila {
  fila: TrabalhoImpressao[] = [];
  marcas: [string, EstadoImpressao, string?][] = [];
  locais: TrabalhoLocal[] = [];
  semInternet = false;
  async pendentes() {
    const lista = this.fila;
    this.fila = [];
    return lista;
  }
  async marcar(id: string, estado: EstadoImpressao, erro?: string) {
    this.marcas.push(erro ? [id, estado, erro] : [id, estado]);
  }
  async registrarLocal(t: TrabalhoLocal) {
    if (this.semInternet) throw new Error('sem internet');
    this.locais.push(t);
  }
}

const calado = { info: () => {}, erro: () => {} };

describe('impressora de rede (TCP 9100)', () => {
  it('manda o ESC/POS da comanda: começa iniciando a impressora e termina cortando o papel', async () => {
    const t = await termica();
    const r = await new ImpressoraDeRede('balcao', '127.0.0.1', t.porta).imprimir(trabalho());
    expect(r.ok).toBe(true);
    await expect.poll(() => t.recebidos.length).toBe(1);
    const bytes = t.recebidos[0] ?? Buffer.alloc(0);
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    expect(bytes.includes(Buffer.from('3557'))).toBe(true);
    expect(bytes.includes(Buffer.from([0x1d, 0x56]))).toBe(true);
  });

  it('impressora desligada: falha com "Impressora sem resposta", sem travar', async () => {
    const t = await termica();
    abertos.pop()?.close();
    const impressora = new ImpressoraDeRede('balcao', '127.0.0.1', t.porta);
    const r = await impressora.imprimir(trabalho());
    expect(r).toEqual({ ok: false, erro: { codigo: 'impressora_sem_resposta', mensagem: 'Impressora sem resposta.' } });
    expect(await impressora.testar()).toBe(false);
  });
});

describe('processador da fila', () => {
  it('imprime na ordem e marca imprimindo e impresso; erro fica marcado com o motivo', async () => {
    const fila = new FilaFalsa();
    const feitos: string[] = [];
    let falhar = false;
    const impressora = {
      nome: 'balcao',
      async imprimir(t: TrabalhoImpressao): Promise<Resultado<void>> {
        if (falhar)
          return { ok: false, erro: { codigo: 'impressora_sem_resposta', mensagem: 'Impressora sem resposta.' } };
        feitos.push(t.id);
        return { ok: true, valor: undefined };
      },
    };
    const p = new Processador(fila, impressora, calado);
    fila.fila = [trabalho('a'), trabalho('b')];
    await p.rodar();
    expect(feitos).toEqual(['a', 'b']);
    expect(fila.marcas).toEqual([
      ['a', 'imprimindo'],
      ['a', 'impresso'],
      ['b', 'imprimindo'],
      ['b', 'impresso'],
    ]);
    falhar = true;
    fila.marcas = [];
    fila.fila = [trabalho('c')];
    await p.rodar();
    expect(fila.marcas).toEqual([
      ['c', 'imprimindo'],
      ['c', 'erro', 'Impressora sem resposta.'],
    ]);
  });

  it('chamadas juntas (Realtime e relógio) não imprimem duas vezes', async () => {
    const fila = new FilaFalsa();
    let vezes = 0;
    const impressora = {
      nome: 'balcao',
      async imprimir(): Promise<Resultado<void>> {
        vezes++;
        return { ok: true, valor: undefined };
      },
    };
    const p = new Processador(fila, impressora, calado);
    fila.fila = [trabalho('a')];
    await Promise.all([p.rodar(), p.rodar(), p.rodar()]);
    expect(vezes).toBe(1);
  });

  it('sem internet: imprime o que veio pela rede local, registra quando a internet volta e não reimprime', async () => {
    const fila = new FilaFalsa();
    fila.semInternet = true;
    let vezes = 0;
    const impressora = {
      nome: 'balcao',
      async imprimir(): Promise<Resultado<void>> {
        vezes++;
        return { ok: true, valor: undefined };
      },
    };
    const p = new Processador(fila, impressora, calado);
    expect(await p.imprimirLocal({ ...trabalho('x'), pedidoId: 'p1' })).toEqual({ ok: true });
    expect(await p.imprimirLocal(trabalho('x'))).toEqual({ ok: true, repetida: true });
    expect(fila.locais).toEqual([]);

    fila.semInternet = false;
    // O pedido do balcão chegou pela fila com o mesmo id: só marca, não imprime de novo.
    fila.fila = [trabalho('x')];
    await p.rodar();
    expect(vezes).toBe(1);
    expect(fila.locais.map((t) => [t.id, t.pedidoId])).toEqual([['x', 'p1']]);
    expect(fila.marcas).toEqual([['x', 'impresso']]);
  });
});

describe('impressão sem internet (http://localhost)', () => {
  const ORIGEM = 'https://mel.exemplo.app';
  const json = { 'Content-Type': 'application/json', Origin: ORIGEM };

  async function servidor() {
    const t = await termica();
    const fila = new FilaFalsa();
    const processador = new Processador(fila, new ImpressoraDeRede('balcao', '127.0.0.1', t.porta), calado);
    const s = servidorLocal(processador, 'balcao', [ORIGEM]);
    await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
    abertos.push(s);
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    return { t, fila, url };
  }

  it('o app manda a comanda; repetida não imprime de novo', async () => {
    const { t, fila, url } = await servidor();
    const corpo = JSON.stringify({ id: randomUUID(), tipo: 'comanda', conteudo: comanda });
    const r1 = await fetch(`${url}/imprimir`, { method: 'POST', body: corpo, headers: json });
    expect(await r1.json()).toEqual({ ok: true });
    const r2 = await fetch(`${url}/imprimir`, { method: 'POST', body: corpo, headers: json });
    expect(await r2.json()).toEqual({ ok: true, repetida: true });
    await expect.poll(() => t.recebidos.length).toBe(1);
    await expect.poll(() => fila.locais.length).toBe(1);
  });

  it('só a origem do app: outro site aberto no balcão não manda imprimir', async () => {
    const { t, url } = await servidor();
    const corpo = JSON.stringify({ id: randomUUID(), tipo: 'comanda', conteudo: comanda });
    const outro = await fetch(`${url}/imprimir`, {
      method: 'POST',
      body: corpo,
      headers: { 'Content-Type': 'application/json', Origin: 'https://site-qualquer.example' },
    });
    expect(outro.status).toBe(403);
    expect(outro.headers.get('access-control-allow-origin')).toBeNull();
    const semOrigem = await fetch(`${url}/imprimir`, { method: 'POST', body: corpo });
    expect(semOrigem.status).toBe(403);
    const pre = await fetch(`${url}/imprimir`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://site-qualquer.example' },
    });
    expect(pre.headers.get('access-control-allow-private-network')).toBeNull();
    expect(t.recebidos).toHaveLength(0);
  });

  it('libera a rede local do Chrome para o app; exige JSON; recusa dado inválido e corpo grande demais', async () => {
    const { url } = await servidor();
    const pre = await fetch(`${url}/imprimir`, { method: 'OPTIONS', headers: { Origin: ORIGEM } });
    expect(pre.headers.get('access-control-allow-private-network')).toBe('true');
    expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGEM);
    const texto = await fetch(`${url}/imprimir`, { method: 'POST', body: '{}', headers: { Origin: ORIGEM } });
    expect(texto.status).toBe(415);
    const ruim = await fetch(`${url}/imprimir`, { method: 'POST', body: JSON.stringify({ id: 'x' }), headers: json });
    expect(ruim.status).toBe(400);
    const grande = await fetch(`${url}/imprimir`, { method: 'POST', body: 'x'.repeat(70 * 1024), headers: json });
    expect(grande.status).toBe(413);
    expect(await (await fetch(`${url}/saude`, { headers: { Origin: ORIGEM } })).json()).toEqual({
      ok: true,
      impressora: 'balcao',
    });
  });
});

const base = () => ({
  MEL_SUPABASE_URL: 'http://127.0.0.1:54321',
  MEL_SUPABASE_ANON_KEY: 'chave-publica',
  MEL_AGENTE_EMAIL: 'agente@mel.test',
  MEL_AGENTE_SENHA: 'x',
  MEL_IMPRESSORA_HOST: '192.168.0.50',
});

describe('configuração', () => {
  it('pede o que falta e usa as portas padrão', () => {
    expect(() => lerConfig({})).toThrow(/MEL_SUPABASE_URL/);
    const c = lerConfig(base());
    expect(c).toMatchObject({ impressora: 'balcao', impressoraPorta: 9100, portaLocal: 9180, origens: [] });
    expect(lerConfig({ ...base(), MEL_AGENTE_ORIGENS: 'https://a.app, http://localhost:5173' }).origens).toEqual([
      'https://a.app',
      'http://localhost:5173',
    ]);
    expect(() => lerConfig({ ...c, MEL_IMPRESSORA_PORTA: '99999' } as never)).toThrow();
  });

  it('a versão das operações é a mesma do app', () => {
    expect(VERSAO_OP_AGENTE).toBe(VERSAO_OP);
  });
});
