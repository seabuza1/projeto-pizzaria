// Testes de acesso: uma conta de cada papel em uso (admin, gerente, expedicao, agente).
// O motoboy não tem login: é um cadastro (decisão 0007).

import { beforeAll, describe, expect, it } from 'vitest';
import {
  abrirNoite,
  aplicada,
  areas,
  clienteAnonimo,
  confirmarAcerto,
  entrar,
  lancar,
  limpar,
  novoId,
  pg,
  SENHA,
  type Sessao,
  sql,
  versaoDoCaixa,
} from './apoio';

const TABELAS = [
  'perfis',
  'config',
  'areas',
  'noites',
  'caixas',
  'pedidos',
  'saidas',
  'pagamentos',
  'acertos',
  'sobras',
  'faltas',
  'impressoes',
  'operacoes',
  'eventos',
  'erros',
  'motoboys',
  'cardapio_faixas',
  'cardapio_sabores',
  'cardapio_bordas',
  'cardapio_adicionais',
  'cardapio_bebidas',
  'cardapio_combos',
  'cardapio_acabou',
  'clientes',
] as const;

let felipe: Sessao;
let luan: Sessao;
let dona: Sessao;
let agente: Sessao;
let area: Record<string, string>;
let noiteId: string;
let caixas: Record<string, string>;

/** Uma saída qualquer da noite, para operações que só precisam de uma. */
async function umaSaida(): Promise<string> {
  const [s] = await sql<{ id: string }[]>`select id from public.saidas limit 1`;
  return s?.id ?? '';
}

beforeAll(async () => {
  await limpar();
  [felipe, luan, dona, agente] = await Promise.all([
    entrar('felipe'),
    entrar('luan'),
    entrar('dona'),
    entrar('agente'),
  ]);
  area = await areas();
  ({ noiteId, caixas } = await abrirNoite(luan, ['joao', 'pedro', 'felipe']));
});

describe('sem login (anon)', () => {
  it('não lê nenhuma tabela', async () => {
    const anon = clienteAnonimo();
    for (const t of TABELAS) {
      const { data, error } = await anon.from(t).select('*').limit(1);
      expect(error ?? (data ?? []).length === 0, t).toBeTruthy();
      if (!error) expect(data, t).toEqual([]);
    }
  });

  it('não chama aplicar_operacao', async () => {
    const anon = clienteAnonimo();
    const { error } = await anon.rpc('aplicar_operacao', {
      op: { id: novoId(), tipo: 'abrir_noite', dados: { noite_id: novoId() } },
    });
    expect(error).not.toBeNull();
  });
});

describe('escrita direta nas tabelas', () => {
  it('é negada para todos os papéis; só aplicar_operacao escreve', async () => {
    for (const s of [felipe, luan, dona, agente]) {
      const ins = await s.db.from('noites').insert({ data: '2020-01-01' });
      expect(ins.error?.code, s.conta).toBe('42501');
      const upd = await s.db
        .from('caixas')
        .update({ dinheiro_contado: 1 })
        .eq('id', caixas.joao ?? '');
      expect(upd.error?.code, s.conta).toBe('42501');
      const del = await s.db.from('areas').delete().eq('nome', 'Barra');
      expect(del.error?.code, s.conta).toBe('42501');
    }
  });
});

describe('motoboy sem login (decisão 0007)', () => {
  it('o motoboy não entra no sistema', async () => {
    const { error } = await clienteAnonimo().auth.signInWithPassword({ email: 'joao@mel.test', password: SENHA });
    expect(error).not.toBeNull();
  });

  it('a expedição lança no caixa de cada motoboy', async () => {
    aplicada((await lancar(luan, caixas.joao ?? '', '3557', 113, area.Barra ?? '', [pg('dinheiro', 113)])).r);
    aplicada((await lancar(luan, caixas.pedro ?? '', '1111', 40, area.Aragarças ?? '', [pg('cartao', 40)])).r);
    const sd = await luan.db.from('saidas').select('caixa_id');
    expect(sd.data?.map((s) => s.caixa_id).sort()).toEqual([caixas.joao, caixas.pedro].sort());
  });

  it('cadastro de motoboys: gerente e admin cadastram; a expedição só lê', async () => {
    const novo = novoId();
    aplicada(await dona.op('salvar_motoboy', { motoboy_id: novo, nome: 'Zé', ativo: true }));
    expect((await luan.op('salvar_motoboy', { motoboy_id: novoId(), nome: 'X', ativo: true })).codigo).toBe(
      'sem_permissao',
    );
    const lidos = await luan.db.from('motoboys').select('nome').eq('id', novo);
    expect(lidos.data).toEqual([{ nome: 'Zé' }]);
    expect((await agente.db.from('motoboys').select('id')).data).toEqual([]);
    // Desativar em vez de apagar: o caixa antigo continua apontando para ele.
    aplicada(await felipe.op('salvar_motoboy', { motoboy_id: novo, nome: 'Zé', ativo: false }));
    const r = await luan.op('abrir_caixa', { caixa_id: novoId(), noite_id: noiteId, motoboy_id: novo });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'motoboy_invalido' });
  });

  it('caixa só para motoboy do cadastro, não para uma conta do sistema', async () => {
    const r = await luan.op('abrir_caixa', { caixa_id: novoId(), noite_id: noiteId, motoboy_id: luan.id });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'motoboy_invalido' });
  });

  it('ninguém recebe o papel motoboy', async () => {
    const r = await felipe.opAntiga('salvar_perfil', { perfil_id: luan.id, papeis: ['expedicao', 'motoboy'] });
    expect(r).toMatchObject({ status: 'recusada', codigo: 'papel_sem_uso' });
  });

  it('pagamento que não soma o total é recusado (PAG2)', async () => {
    const { r } = await lancar(luan, caixas.joao ?? '', '1234', 50, area.Pontal ?? '', [
      pg('pix_antecipado', 20),
      pg('dinheiro', 25),
    ]);
    expect(r).toMatchObject({ status: 'recusada', motivo: '1234: pagamentos somam R$ 45,00, mas o total é R$ 50,00.' });
  });

  it('troco por Pix sem parte em dinheiro é recusado (PAG4)', async () => {
    const { r } = await lancar(luan, caixas.joao ?? '', '2672', 90, area.Pontal ?? '', [pg('cartao', 90, 3)]);
    expect(r).toMatchObject({ status: 'recusada', motivo: '2672: troco por Pix só com parte em dinheiro.' });
  });
});

describe('fila idempotente', () => {
  it('a mesma operação enviada duas vezes aplica uma vez só', async () => {
    const opId = novoId();
    const dados = {
      caixa_id: caixas.joao ?? '',
      pedido_id: novoId(),
      saida_id: novoId(),
      codigo: '0910',
      total: 7200,
      area_id: area.Barra ?? '',
      pagamentos: [pg('pix_maquininha', 72)],
    };
    const r1 = await luan.op('lancar_saida', dados, { id: opId });
    const r2 = await luan.op('lancar_saida', dados, { id: opId });
    expect(r1.status).toBe('aplicada');
    expect(r2).toMatchObject({ status: 'aplicada', repetida: true });
    const [{ n } = { n: -1 }] = await sql<
      { n: number }[]
    >`select count(*)::int as n from public.pedidos where codigo = '0910'`;
    expect(n).toBe(1);
  });

  it('outra pessoa não reaproveita o id de uma operação', async () => {
    const opId = novoId();
    aplicada(await luan.op('conferir_papel', { saida_id: await umaSaida(), conferido: true }, { id: opId }));
    await expect(
      dona.op('conferir_papel', { saida_id: await umaSaida(), conferido: false }, { id: opId }),
    ).rejects.toThrow();
  });
});

describe('acerto (ACE9)', () => {
  it('confirmar com conta desatualizada é recusado', async () => {
    aplicada(await luan.op('informar_contado', { caixa_id: caixas.joao ?? '', dinheiro_contado: 19300 }));
    const r = await luan.op('confirmar_acerto', {
      caixa_id: caixas.joao ?? '',
      acerto_id: novoId(),
      versao_esperada: await versaoDoCaixa(caixas.joao ?? ''),
      esperado: {
        devolver: 1,
        maquininha: 0,
        receber: 0,
        dinheiroContado: 19300,
        pagar: 0,
        doCaixaDele: 0,
        retiradoCaixaEmpresa: 0,
        vaiParaEmpresa: 0,
      },
    });
    expect(r).toMatchObject({ status: 'recusada', motivo: 'A conta mudou desde que você abriu. Confira de novo.' });
  });

  it('depois de confirmado, ninguém mexe no caixa nem nas saídas', async () => {
    aplicada(await confirmarAcerto(luan, caixas.joao ?? ''));
    const [saida] = await sql`select id from public.saidas where caixa_id = ${caixas.joao ?? ''} limit 1`;
    const r = await luan.op('mudar_estado_saida', { saida_id: saida?.id, estado: 'voltou' });
    expect(r.status).toBe('recusada');
    expect(r.motivo).toMatch(/o acerto já foi confirmado por Luan\.$/);
    const novo = await lancar(luan, caixas.joao ?? '', '4444', 30, area.Barra ?? '', [pg('dinheiro', 30)]);
    expect(novo.r.motivo).toBe('4444: o acerto já foi confirmado por Luan.');
    // Reabrir é do admin.
    const ed = await luan.op('editar_caixa', { caixa_id: caixas.joao ?? '', diaria: 4000 });
    expect(ed.motivo).toBe('O acerto já foi confirmado por Luan.');
  });

  it('o acerto grava os valores do servidor, a sobra e a falta', async () => {
    const [a] = await sql`select * from public.acertos where caixa_id = ${caixas.joao ?? ''}`;
    // 3557 em dinheiro (113) + 0910 no Pix da maquininha (72); Barra 12 + 12.
    expect(a).toMatchObject({
      devolver: 19300,
      maquininha: 7200,
      receber: 5400,
      pagar: 5400,
      do_caixa_dele: 5400,
      retirado_caixa_empresa: 0,
      vai_para_empresa: 13900,
      confirmado_por: luan.id,
    });
  });

  it('a expedição não reabre; o admin reabre e o caixa volta a aceitar lançamento', async () => {
    expect((await luan.op('reabrir_acerto', { caixa_id: caixas.joao ?? '', motivo: 'Teste' })).motivo).toBe(
      'Sem permissão para isso.',
    );
    aplicada(await felipe.op('reabrir_acerto', { caixa_id: caixas.joao ?? '', motivo: 'Faltou lançar um pedido' }));
    aplicada((await lancar(luan, caixas.joao ?? '', '4444', 30, area.Barra ?? '', [pg('dinheiro', 30)])).r);
  });
});

describe('gerente e registro de mudanças (OPE2)', () => {
  it('a gerente lê os eventos, com autor; a expedição não', async () => {
    const ev = await dona.db.from('eventos').select('tabela, autor, acao').eq('tabela', 'acertos');
    expect(ev.error).toBeNull();
    expect(ev.data?.length).toBeGreaterThanOrEqual(2);
    expect(ev.data?.find((e) => e.acao === 'insert')?.autor).toBe(luan.id);
    expect(ev.data?.find((e) => e.acao === 'update')?.autor).toBe(felipe.id);
    expect((await luan.db.from('eventos').select('id')).data).toEqual([]);
  });

  it('cada mudança de pagamento e saída fica registrada com a operação', async () => {
    const [{ n } = { n: -1 }] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.eventos e
      where e.tabela in ('saidas', 'pagamentos') and (e.operacao_id is null or e.autor is null)`;
    expect(n).toBe(0);
  });

  it('a gerente vê a noite inteira', async () => {
    const cx = await dona.db.from('caixas').select('id').eq('noite_id', noiteId);
    expect(cx.data?.length).toBe(3);
  });
});

describe('agente de impressão', () => {
  it('vê as impressões, mas não vê caixas, saídas nem pagamentos', async () => {
    const impressaoId = novoId();
    aplicada(
      await luan.op('pedir_impressao', {
        impressao_id: impressaoId,
        tipo: 'folha_noite',
        conteudo: 'MEL PIZZARIA',
        noite_id: noiteId,
      }),
    );
    const imp = await agente.db.from('impressoes').select('id, estado');
    expect(imp.data).toEqual([{ id: impressaoId, estado: 'pendente' }]);
    for (const t of ['caixas', 'saidas', 'pagamentos', 'pedidos', 'acertos'] as const) {
      expect((await agente.db.from(t).select('id')).data, t).toEqual([]);
    }
    aplicada(await agente.op('atualizar_impressao', { impressao_id: impressaoId, estado: 'imprimindo' }));
    aplicada(await agente.op('atualizar_impressao', { impressao_id: impressaoId, estado: 'impresso' }));
    const [linha] = await sql`select estado, tentativas from public.impressoes where id = ${impressaoId}`;
    expect(linha).toMatchObject({ estado: 'impresso', tentativas: 1 });
  });

  it('não lança saída nem abre noite', async () => {
    const { r } = await lancar(agente, caixas.joao ?? '', '5555', 30, area.Barra ?? '', [pg('dinheiro', 30)]);
    expect(r.motivo).toBe('Sem permissão para isso.');
  });

  it('o agente não pede impressão; quem pede é a equipe do balcão', async () => {
    const r = await agente.op('pedir_impressao', { impressao_id: novoId(), tipo: 'folha_noite', conteudo: 'x' });
    expect(r.motivo).toBe('Sem permissão para isso.');
  });
});

describe('admin', () => {
  it('não tira o próprio acesso de admin', async () => {
    const r = await felipe.op('salvar_perfil', { perfil_id: felipe.id, papeis: ['expedicao'] });
    expect(r.motivo).toBe('Você não pode tirar o próprio acesso de admin.');
  });

  it('só o admin muda a configuração', async () => {
    expect((await dona.op('salvar_config', { ambiente: 'producao' })).motivo).toBe('Sem permissão para isso.');
    aplicada(await felipe.op('salvar_config', { ambiente: 'teste' }));
  });
});
