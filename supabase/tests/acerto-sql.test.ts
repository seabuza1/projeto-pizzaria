// A conta do servidor (interno.conta_caixa) tem que bater com a do domínio (acerto.ts).
// As noites são montadas pelas mesmas operações do app.

import { entradaDoCaixa } from '@mel/db';
import { type ContaAcerto, calcularAcerto } from '@mel/dominio';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  abrirNoite,
  aplicada,
  areas,
  entrar,
  lancar,
  limpar,
  novoId,
  pedidoDaSaida,
  pg,
  type Sessao,
  sql,
  versaoDoPedido,
} from './apoio';

let luan: Sessao;
let joao: Sessao;
let area: Record<string, string>;
let caixaId: string;

async function contaDoServidor(contado: number | null) {
  const [linha] = await sql`select interno.conta_caixa(${caixaId}, ${contado}) as conta`;
  return linha?.conta as Record<string, unknown>;
}

async function contaDoDominio(contado: number | null): Promise<ContaAcerto> {
  const [caixa] =
    await sql`select id, caixa_inicial, diaria, dinheiro_contado from public.caixas where id = ${caixaId}`;
  const linhas = {
    pedidos: await sql`select id, codigo from public.pedidos`,
    saidas: await sql`select * from public.saidas`,
    pagamentos: await sql`select * from public.pagamentos`,
  };
  // biome-ignore lint/suspicious/noExplicitAny: linhas cruas do postgres
  const entrada = entradaDoCaixa({ ...(caixa as any), dinheiro_contado: contado }, linhas as any);
  return calcularAcerto(entrada);
}

async function conferir(contado: number | null) {
  const servidor = await contaDoServidor(contado);
  const dominio = await contaDoDominio(contado);
  const { porArea, papelFaltando, listaMaquininha, avisos, ...totais } = dominio;
  expect(servidor).toEqual(totais);
  return servidor;
}

const lancarBase = async () => {
  const b = area.Barra ?? '';
  const a = area.Aragarças ?? '';
  const p = area.Pontal ?? '';
  aplicada((await lancar(joao, caixaId, '3557', 113, b, [pg('dinheiro', 113)])).r);
  aplicada((await lancar(joao, caixaId, '0017', 60, a, [pg('pix_antecipado', 60)])).r);
  aplicada((await lancar(joao, caixaId, '2672', 90, p, [pg('cartao', 90)])).r);
  aplicada((await lancar(joao, caixaId, '0910', 72, b, [pg('pix_maquininha', 72)])).r);
  aplicada((await lancar(joao, caixaId, '3595', 47, a, [pg('dinheiro', 47, 3)])).r);
  const voltou = await lancar(joao, caixaId, '8094', 65, b, [pg('dinheiro', 65)]);
  aplicada(voltou.r);
  aplicada(await joao.op('mudar_estado_saida', { saida_id: voltou.saidaId, estado: 'voltou' }));
  return { voltou };
};

beforeEach(async () => {
  await limpar();
  [luan, joao] = await Promise.all([entrar('luan'), entrar('joao')]);
  area = await areas();
  const noite = await abrirNoite(luan, ['joao']);
  caixaId = noite.caixas.joao ?? '';
});

describe('conta do servidor = conta do domínio', () => {
  it('T1 base', async () => {
    await lancarBase();
    expect(await conferir(null)).toMatchObject({ devolver: 24300, maquininha: 16200, receber: 8600 });
  });

  it('T11 a T14: liquidação com contado 243, 240, 140 e 250', async () => {
    await lancarBase();
    for (const contado of [24300, 24000, 14000, 25000]) await conferir(contado);
    expect(((await conferir(14000)).liquidacao as Record<string, number>).vaiParaEmpresa).toBe(15700);
  });

  it('T6 Pix antecipado mais dinheiro no mesmo pedido', async () => {
    await lancarBase();
    aplicada(
      (await lancar(joao, caixaId, '1234', 50, area.Pontal ?? '', [pg('pix_antecipado', 20), pg('dinheiro', 30)])).r,
    );
    expect(await conferir(null)).toMatchObject({ devolver: 27300, receber: 9600, pixAntecipado: 8000 });
  });

  it('T7 o 8094 sai de novo e é entregue', async () => {
    const { voltou } = await lancarBase();
    const nova = novoId();
    aplicada(await joao.op('sair_de_novo', { saida_id: nova, saida_anterior_id: voltou.saidaId, caixa_id: caixaId }));
    aplicada(await joao.op('mudar_estado_saida', { saida_id: nova, estado: 'entregue' }));
    expect(await conferir(null)).toMatchObject({ devolver: 30800, receber: 9800 });
  });

  it('T8 a taxa da área muda depois: a saída guarda a dela (ENT2)', async () => {
    await lancarBase();
    await sql`update public.areas set taxa = 1300 where nome = 'Barra'`;
    expect(await conferir(null)).toMatchObject({ receber: 8600 });
  });

  it('PAG3 a forma trocada na porta substitui a prevista', async () => {
    await lancarBase();
    const [s] = await sql`select s.id from public.saidas s join public.pedidos p on p.id = s.pedido_id
      where p.codigo = '2672'`;
    aplicada(
      await joao.op('trocar_pagamento', {
        saida_id: s?.id,
        versao_esperada: await versaoDoPedido(await pedidoDaSaida(s?.id)),
        pagamentos: [pg('dinheiro', 50), pg('pix_maquininha', 40)],
      }),
    );
    expect(await conferir(null)).toMatchObject({ cartao: 0, devolver: 29300, maquininha: 11200 });
    // Desfazer: volta para a prevista.
    aplicada(
      await joao.op('trocar_pagamento', {
        saida_id: s?.id,
        versao_esperada: await versaoDoPedido(await pedidoDaSaida(s?.id)),
        pagamentos: [],
      }),
    );
    expect(await conferir(null)).toMatchObject({ cartao: 9000, devolver: 24300 });
  });

  it('T18 saída em rota conta como entregue', async () => {
    await lancarBase();
    aplicada((await lancar(joao, caixaId, '5555', 40, area.Aragarças ?? '', [pg('dinheiro', 40)])).r);
    expect(await conferir(null)).toMatchObject({ devolver: 28300, entregues: 6 });
  });

  it('desfazer o lançamento cancela sem apagar; desfazer o "saiu de novo" devolve os pagamentos', async () => {
    const { voltou } = await lancarBase();
    const nova = novoId();
    aplicada(await joao.op('sair_de_novo', { saida_id: nova, saida_anterior_id: voltou.saidaId, caixa_id: caixaId }));
    aplicada(
      await joao.op('cancelar_saida', { saida_id: nova, versao_esperada: await versaoDoPedido(voltou.pedidoId) }),
    );
    const [pgto] = await sql`select saida_id from public.pagamentos where pedido_id = ${voltou.pedidoId}`;
    expect(pgto?.saida_id).toBe(voltou.saidaId);
    aplicada(await joao.op('mudar_estado_saida', { saida_id: voltou.saidaId, estado: 'em_rota' }));
    aplicada(
      await joao.op('cancelar_saida', {
        saida_id: voltou.saidaId,
        versao_esperada: await versaoDoPedido(voltou.pedidoId),
        motivo: 'Lançado errado',
      }),
    );
    // OPE3: o pedido fica cancelado e os pagamentos anulados, com motivo; nada some.
    const [pedido] = await sql`select estado from public.pedidos where id = ${voltou.pedidoId}`;
    expect(pedido?.estado).toBe('cancelado');
    const anulados = await sql`select motivo_anulacao, anulado_por from public.pagamentos
      where pedido_id = ${voltou.pedidoId}`;
    expect(anulados).toEqual([{ motivo_anulacao: 'Lançado errado', anulado_por: joao.id }]);
    expect(await conferir(null)).toMatchObject({ entregues: 5, voltaram: 0, receber: 7400 });
  });

  it('T10 caixa 75 e treze saídas no cartão', async () => {
    aplicada(await luan.op('editar_caixa', { caixa_id: caixaId, caixa_inicial: 7500 }));
    for (let i = 0; i < 10; i++) {
      aplicada((await lancar(joao, caixaId, `10${i}0`, 50, area.Barra ?? '', [pg('cartao', 50)])).r);
    }
    for (let i = 0; i < 2; i++) {
      aplicada((await lancar(joao, caixaId, `20${i}0`, 40, area.Aragarças ?? '', [pg('cartao', 40)])).r);
    }
    aplicada((await lancar(joao, caixaId, '3000', 30, area.Pontal ?? '', [pg('cartao', 30)])).r);
    const conta = await conferir(7500);
    expect(conta.liquidacao).toMatchObject({ doCaixaDele: 7500, retiradoCaixaEmpresa: 9500, vaiParaEmpresa: 0 });
  });
});
