// PADROES e ARQUITETURA (Conflitos e concorrência, Robustez): horário do servidor, versao_op,
// versao_esperada, dinheiro só se acrescenta (OPE3), MFA para admin e gerente e código nas recusas.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  abrirNoite,
  aplicada,
  areas,
  entrar,
  lancar,
  limpar,
  novoId,
  pg,
  type Sessao,
  sql,
  versaoDoCaixa,
  versaoDoPedido,
} from './apoio';

let luan: Sessao;
let dona: Sessao;
let felipe: Sessao;
let area: Record<string, string>;
let caixaId: string;

beforeEach(async () => {
  await limpar();
  [luan, dona, felipe] = await Promise.all([entrar('luan'), entrar('dona'), entrar('felipe')]);
  area = await areas();
  caixaId = (await abrirNoite(luan, ['joao'])).caixas.joao ?? '';
});

describe('horário do servidor', () => {
  it('a hora do aparelho fica registrada, mas não vale para a saída nem para o pagamento', async () => {
    const duasHorasAtras = new Date(Date.now() - 2 * 3600_000).toISOString();
    const opId = novoId();
    const saidaId = novoId();
    aplicada(
      await luan.op(
        'lancar_saida',
        {
          caixa_id: caixaId,
          pedido_id: novoId(),
          saida_id: saidaId,
          codigo: '3557',
          total: 11300,
          area_id: area.Barra ?? '',
          pagamentos: [pg('dinheiro', 113)],
        },
        { id: opId, criadaEm: duasHorasAtras },
      ),
    );
    const [s] = await sql`select extract(epoch from now() - saiu_em)::int as atraso from public.saidas
      where id = ${saidaId}`;
    expect(s?.atraso).toBeLessThan(60);
    const [p] = await sql`select extract(epoch from now() - registrado_em)::int as atraso from public.pagamentos
      where saida_id = ${saidaId}`;
    expect(p?.atraso).toBeLessThan(60);
    const [o] = await sql`select criada_em from public.operacoes where id = ${opId}`;
    expect(new Date(o?.criada_em).toISOString()).toBe(duasHorasAtras);
  });
});

describe('versao_op', () => {
  it('aceita a versão atual e a anterior', async () => {
    aplicada(await luan.opAntiga('avisar_retorno', { caixa_id: caixaId, minutos: 5 }, { versaoOp: 0 }));
  });

  it('versão antiga demais ou sem versão: não recusa nem grava; o app guarda a fila e pede para atualizar', async () => {
    const opId = novoId();
    await expect(
      luan.opAntiga('avisar_retorno', { caixa_id: caixaId, minutos: 5 }, { id: opId, versaoOp: -1 }),
    ).rejects.toMatchObject({
      code: 'MEL02',
      message: 'Atualize o app para continuar.',
    });
    await expect(
      luan.opAntiga('avisar_retorno', { caixa_id: caixaId, minutos: 5 }, { versaoOp: null }),
    ).rejects.toMatchObject({
      code: 'MEL02',
    });
    const [{ n } = { n: -1 }] = await sql<{ n: number }[]>`select count(*)::int as n from public.operacoes
      where id = ${opId}`;
    expect(n).toBe(0);
  });

  it('a configuração guarda a versão mínima do app', async () => {
    const { data } = await luan.db.from('config').select('versao_minima_app').single();
    expect(data?.versao_minima_app).toBe(1);
  });
});

describe('versao_esperada', () => {
  it('o Luan não confirma um caixa que outra pessoa mudou depois que ele abriu a conta', async () => {
    aplicada((await lancar(luan, caixaId, '3557', 113, area.Barra ?? '', [pg('dinheiro', 113)])).r);
    aplicada(await luan.op('informar_contado', { caixa_id: caixaId, dinheiro_contado: 19300 }));
    const versaoQueOLuanViu = await versaoDoCaixa(caixaId);
    aplicada((await lancar(dona, caixaId, '2672', 90, area.Pontal ?? '', [pg('cartao', 90)])).r);
    const r = await luan.op('confirmar_acerto', {
      caixa_id: caixaId,
      acerto_id: novoId(),
      versao_esperada: versaoQueOLuanViu,
      esperado: {
        devolver: 19300,
        maquininha: 0,
        receber: 4200,
        dinheiroContado: 19300,
        pagar: 4200,
        doCaixaDele: 4200,
        retiradoCaixaEmpresa: 0,
        vaiParaEmpresa: 15100,
      },
    });
    expect(r).toMatchObject({
      status: 'recusada',
      codigo: 'versao_mudou',
      motivo: 'Dona mudou este caixa; confira e tente de novo.',
    });
  });

  it('ninguém sobrescreve a troca de forma de outro sem ver', async () => {
    const { r, saidaId, pedidoId } = await lancar(luan, caixaId, '3557', 113, area.Barra ?? '', [pg('dinheiro', 113)]);
    aplicada(r);
    const versao = await versaoDoPedido(pedidoId);
    aplicada(
      await luan.op('trocar_pagamento', {
        saida_id: saidaId,
        versao_esperada: versao,
        pagamentos: [pg('cartao', 113)],
      }),
    );
    const r2 = await dona.op('trocar_pagamento', {
      saida_id: saidaId,
      versao_esperada: versao,
      pagamentos: [pg('pix_maquininha', 113)],
    });
    expect(r2).toMatchObject({
      status: 'recusada',
      codigo: 'versao_mudou',
      motivo: '3557: Luan mudou este pedido; confira e tente de novo.',
    });
  });
});

describe('dinheiro só se acrescenta (OPE3)', () => {
  it('o banco não deixa apagar nem reescrever valores, nem com acesso direto', async () => {
    const { r, pedidoId } = await lancar(luan, caixaId, '3557', 113, area.Barra ?? '', [pg('dinheiro', 113)]);
    aplicada(r);
    await expect(sql`delete from public.pagamentos where pedido_id = ${pedidoId}`).rejects.toThrow(/OPE3/);
    await expect(sql`update public.pagamentos set valor = 1 where pedido_id = ${pedidoId}`).rejects.toThrow(/OPE3/);
    await expect(sql`update public.pedidos set total = 1 where id = ${pedidoId}`).rejects.toThrow(/OPE3/);
    await expect(sql`delete from public.saidas where pedido_id = ${pedidoId}`).rejects.toThrow(/OPE3/);
  });

  it('trocar a forma duas vezes deixa as trocas anteriores anuladas, com motivo', async () => {
    const { r, saidaId, pedidoId } = await lancar(luan, caixaId, '3557', 113, area.Barra ?? '', [pg('dinheiro', 113)]);
    aplicada(r);
    for (const forma of ['cartao', 'pix_maquininha'] as const) {
      aplicada(
        await luan.op('trocar_pagamento', {
          saida_id: saidaId,
          versao_esperada: await versaoDoPedido(pedidoId),
          pagamentos: [pg(forma, 113)],
        }),
      );
    }
    const linhas = await sql`select forma, real, anulado_em is not null as anulado, motivo_anulacao
      from public.pagamentos where pedido_id = ${pedidoId} order by criado_em`;
    expect(linhas).toEqual([
      { forma: 'dinheiro', real: false, anulado: false, motivo_anulacao: null },
      { forma: 'cartao', real: true, anulado: true, motivo_anulacao: 'Forma trocada de novo' },
      { forma: 'pix_maquininha', real: true, anulado: false, motivo_anulacao: null },
    ]);
  });

  it('reabrir o acerto pede motivo e anula a sobra sem apagar', async () => {
    aplicada((await lancar(luan, caixaId, '3557', 113, area.Barra ?? '', [pg('dinheiro', 113)])).r);
    aplicada(await luan.op('informar_contado', { caixa_id: caixaId, dinheiro_contado: 20000 }));
    aplicada(
      await luan.op('confirmar_acerto', {
        caixa_id: caixaId,
        acerto_id: novoId(),
        versao_esperada: await versaoDoCaixa(caixaId),
        esperado: {
          devolver: 19300,
          maquininha: 0,
          receber: 4200,
          dinheiroContado: 20000,
          pagar: 4200,
          doCaixaDele: 4200,
          retiradoCaixaEmpresa: 0,
          vaiParaEmpresa: 15800,
        },
      }),
    );
    expect((await felipe.op('reabrir_acerto', { caixa_id: caixaId, motivo: ' ' })).codigo).toBe('sem_motivo');
    aplicada(await felipe.op('reabrir_acerto', { caixa_id: caixaId, motivo: 'Contou de novo' }));
    const [sobra] = await sql`select valor, motivo_anulacao, anulada_por from public.sobras`;
    expect(sobra).toEqual({ valor: 700, motivo_anulacao: 'Contou de novo', anulada_por: felipe.id });
    const [acerto] = await sql`select pagar, motivo_reabertura from public.acertos`;
    expect(acerto).toEqual({ pagar: 4200, motivo_reabertura: 'Contou de novo' });
  });
});

describe('MFA para admin e gerente', () => {
  it('sem o código do autenticador, o admin não vê a noite nem aplica operações', async () => {
    const semMfa = await entrar('felipe', { semMfa: true });
    expect((await semMfa.db.from('caixas').select('id')).data).toEqual([]);
    expect((await semMfa.db.from('perfis').select('nome')).data).toEqual([{ nome: 'Felipe' }]);
    await expect(semMfa.opAntiga('avisar_retorno', { caixa_id: caixaId, minutos: 5 })).rejects.toMatchObject({
      code: 'MEL03',
      message: 'Confirme o código do app autenticador.',
    });
  });

  it('a gerente também precisa do código', async () => {
    const semMfa = await entrar('dona', { semMfa: true });
    expect((await semMfa.db.from('noites').select('id')).data).toEqual([]);
    const comMfa = await entrar('dona');
    expect((await comMfa.db.from('noites').select('id')).data?.length).toBe(1);
  });

  it('a expedição entra sem MFA', async () => {
    expect((await luan.db.from('caixas').select('id')).data?.length).toBe(1);
  });
});

describe('recusa com código', () => {
  it('a recusa traz o código da regra, igual ao do domínio', async () => {
    const { r } = await lancar(luan, caixaId, '1234', 50, area.Pontal ?? '', [pg('dinheiro', 45)]);
    expect(r).toMatchObject({
      status: 'recusada',
      codigo: 'soma_diferente',
      motivo: '1234: pagamentos somam R$ 45,00, mas o total é R$ 50,00.',
    });
    const [o] = await sql`select codigo from public.operacoes where status = 'recusada'`;
    expect(o?.codigo).toBe('soma_diferente');
  });
});

describe('interruptor de funcionalidades (OPE1)', () => {
  it('o admin desliga uma funcionalidade sem deploy; nome inválido é recusado', async () => {
    aplicada(await felipe.op('salvar_config', { funcionalidades_desligadas: ['motoboy', 'motoboy'] }));
    const { data } = await luan.db.from('config').select('funcionalidades_desligadas').single();
    expect(data?.funcionalidades_desligadas).toEqual(['motoboy']);
    const r = await felipe.op('salvar_config', { funcionalidades_desligadas: ['Painel!'] });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'dados_invalidos' });
    aplicada(await felipe.op('salvar_config', { funcionalidades_desligadas: [] }));
  });

  it('só o admin mexe no interruptor', async () => {
    expect((await luan.op('salvar_config', { funcionalidades_desligadas: ['expedicao'] })).codigo).toBe(
      'sem_permissao',
    );
  });
});
