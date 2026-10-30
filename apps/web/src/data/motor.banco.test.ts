// Integração com o Supabase local (supabase start). Roda com `pnpm --filter @mel/web test:db`.
// "Pronto quando" da F1: em modo avião o motoboy lança e marca entregas; com a internet de volta,
// tudo sobe sozinho e nada duplica.
import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type Database, entradaDoCaixa } from '@mel/db';
import { calcularAcerto } from '@mel/dominio';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BancoLocal } from './banco-local';
import { Motor } from './motor';

const status = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
    cwd: new URL('../../../..', import.meta.url).pathname,
    encoding: 'utf8',
  }),
) as Record<string, string>;
const URL_API = status.API_URL ?? '';
const ANON = status.ANON_KEY ?? '';
const SENHA = 'Mel12345teste';

async function cliente(email: string, fetchFalso?: typeof fetch) {
  const c = createClient<Database>(URL_API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(fetchFalso ? { global: { fetch: fetchFalso } } : {}),
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return { c, id: data.user.id };
}

async function op(c: Awaited<ReturnType<typeof cliente>>['c'], tipo: string, dados: object) {
  const { data, error } = await c.rpc('aplicar_operacao', {
    op: { id: randomUUID(), tipo, dados, criada_em: new Date().toISOString() } as never,
  });
  if (error) throw error;
  return data as { status: string; motivo: string | null };
}

const rede = { fora: false };
const fetchComModoAviao: typeof fetch = (entrada, init) =>
  rede.fora ? Promise.reject(new TypeError('fetch failed')) : fetch(entrada, init);

let luan: Awaited<ReturnType<typeof cliente>>;
let joao: Awaited<ReturnType<typeof cliente>>;
let banco: BancoLocal;
let motor: Motor;
let caixaId: string;
let barra: string;

const novoId = () => randomUUID();

beforeAll(async () => {
  luan = await cliente('luan@mel.test');
  joao = await cliente('joao@mel.test', fetchComModoAviao);
  // Começa de uma noite limpa (só no banco local de testes).
  execFileSync(
    'psql',
    [
      status.DB_URL ?? '',
      '-qc',
      'truncate public.eventos, public.operacoes, public.impressoes, public.sobras, public.faltas, public.acertos, public.pagamentos, public.saidas, public.pedidos, public.caixas, public.noites cascade',
    ],
    { encoding: 'utf8' },
  );
  const noiteId = novoId();
  caixaId = novoId();
  expect((await op(luan.c, 'abrir_noite', { noite_id: noiteId })).status).toBe('aplicada');
  expect((await op(luan.c, 'abrir_caixa', { caixa_id: caixaId, noite_id: noiteId, motoboy_id: joao.id })).status).toBe(
    'aplicada',
  );
  barra = (await luan.c.from('areas').select('id').eq('nome', 'Barra').single()).data?.id ?? '';

  banco = new BancoLocal(`teste-${novoId()}`);
  motor = new Motor({ supabase: joao.c, banco, aparelho: 'teste' });
  await motor.iniciar(joao.id);
});

afterAll(async () => {
  await motor.parar();
  await banco.delete();
});

const lancar = (codigo: string, reais: number, forma: 'dinheiro' | 'cartao') =>
  motor.executar('lancar_saida', {
    caixa_id: caixaId,
    pedido_id: novoId(),
    saida_id: novoId(),
    codigo,
    total: reais * 100,
    area_id: barra,
    pagamentos: [{ id: novoId(), forma, valor: reais * 100 }],
  });

async function contaLocal() {
  const caixa = await banco.caixas.get(caixaId);
  if (!caixa) throw new Error('sem caixa local');
  return calcularAcerto(
    entradaDoCaixa(caixa, {
      pedidos: await banco.pedidos.toArray(),
      saidas: await banco.saidas.toArray(),
      pagamentos: await banco.pagamentos.toArray(),
    }),
  );
}

describe('fila offline', () => {
  it('baixa o caixa da noite ao entrar', async () => {
    expect((await banco.caixas.get(caixaId))?.caixa_inicial).toBe(8000);
  });

  it('em modo avião, lança e marca entregue só no aparelho', async () => {
    rede.fora = true;
    await lancar('3557', 113, 'dinheiro');
    await lancar('2672', 90, 'cartao');
    const saida = (await banco.saidas.toArray())[0];
    await motor.executar('mudar_estado_saida', { saida_id: saida?.id ?? '', estado: 'entregue' });

    expect(await banco.fila.count()).toBe(3);
    expect(await contaLocal()).toMatchObject({ devolver: 19300, maquininha: 9000, receber: 5400 });
    const servidor = await luan.c.from('pedidos').select('id');
    expect(servidor.data).toEqual([]);
  });

  it('quando a internet volta, tudo sobe e nada duplica', async () => {
    rede.fora = false;
    await motor.enviar();
    expect(await banco.fila.count()).toBe(0);
    const pedidos = await luan.c.from('pedidos').select('codigo').order('codigo');
    expect(pedidos.data?.map((p) => p.codigo)).toEqual(['2672', '3557']);
    const entregues = await luan.c.from('saidas').select('id').eq('estado', 'entregue');
    expect(entregues.data?.length).toBe(1);
  });

  it('a confirmação que se perdeu no caminho é reenviada sem duplicar', async () => {
    const ultima = (await joao.c.from('operacoes').select('*').order('criado_em', { ascending: false }).limit(1))
      .data?.[0];
    // Simula: o servidor aplicou, mas a resposta não chegou ao aparelho.
    await banco.fila.add({
      id: ultima?.id ?? '',
      tipo: 'lancar_saida',
      dados: ultima?.dados as never,
      criada_em: new Date().toISOString(),
      seq: 99,
      tentativas: 0,
    });
    const repetida = (await joao.c.from('operacoes').select('id')).data?.length;
    await motor.enviar();
    expect(await banco.fila.count()).toBe(0);
    expect((await joao.c.from('operacoes').select('id')).data?.length).toBe(repetida);
    expect((await luan.c.from('pedidos').select('id')).data?.length).toBe(2);
  });

  it('operação recusada desfaz o efeito local e mostra o motivo', async () => {
    // O Luan confirma o acerto enquanto o motoboy está sem internet.
    const conta = await contaLocal();
    expect((await op(luan.c, 'informar_contado', { caixa_id: caixaId, dinheiro_contado: conta.devolver })).status).toBe(
      'aplicada',
    );
    rede.fora = true;
    await lancar('9999', 40, 'dinheiro');
    expect(await banco.pedidos.where('codigo').equals('9999').count()).toBe(1);

    const l = calcularAcerto({ ...(await entradaAtual()), dinheiroContado: conta.devolver }).liquidacao;
    expect(
      (
        await op(luan.c, 'confirmar_acerto', {
          caixa_id: caixaId,
          acerto_id: novoId(),
          esperado: {
            devolver: conta.devolver,
            maquininha: conta.maquininha,
            receber: conta.receber,
            dinheiroContado: l?.dinheiroContado,
            pagar: l?.pagar,
            doCaixaDele: l?.doCaixaDele,
            retiradoCaixaEmpresa: l?.retiradoCaixaEmpresa,
            vaiParaEmpresa: l?.vaiParaEmpresa,
          },
        })
      ).status,
    ).toBe('aplicada');

    rede.fora = false;
    await motor.enviar();
    expect(await banco.fila.count()).toBe(0);
    const recusas = await banco.recusas.toArray();
    expect(recusas.map((r) => r.motivo)).toContain('9999: o acerto já foi confirmado por Luan.');
    expect(await banco.pedidos.where('codigo').equals('9999').count()).toBe(0);
    expect(await banco.acertos.count()).toBe(1);
  });
});

async function entradaAtual() {
  // A conta que o Luan vê: só o que está no servidor (sem o 9999 que ficou no aparelho).
  const [caixa, pedidos, saidas, pagamentos] = await Promise.all([
    luan.c.from('caixas').select('*').eq('id', caixaId).single(),
    luan.c.from('pedidos').select('*'),
    luan.c.from('saidas').select('*'),
    luan.c.from('pagamentos').select('*'),
  ]);
  if (!caixa.data) throw new Error('sem caixa');
  return entradaDoCaixa(caixa.data, {
    pedidos: pedidos.data ?? [],
    saidas: saidas.data ?? [],
    pagamentos: pagamentos.data ?? [],
  });
}
