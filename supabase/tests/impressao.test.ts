// Impressão sem fio (etapa 8): fila de impressão, agente, impressão pela rede local e batimento.
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirNoite, aplicada, entrar, limpar, novoId, type Sessao, sql } from './apoio';

let luan: Sessao;
let atendimento: Sessao;
let agente: Sessao;
let noiteId: string;

beforeEach(async () => {
  await limpar();
  [luan, atendimento, agente] = await Promise.all([entrar('luan'), entrar('atendimento'), entrar('agente')]);
  ({ noiteId } = await abrirNoite(luan, []));
});

const comanda = (impressao_id = novoId()) => ({
  impressao_id,
  tipo: 'comanda' as const,
  conteudo: '^^^^3557\n=\n',
  noite_id: noiteId,
});

const estado = async (id: string) => {
  const [l] = await sql<{ estado: string; tentativas: number; impressa: boolean }[]>`
    select estado, tentativas, impressa_em is not null as impressa from public.impressoes where id = ${id}`;
  return l;
};

describe('fila de impressão', () => {
  it('o atendimento pede a comanda; pedir de novo com o mesmo id não duplica', async () => {
    const d = comanda();
    aplicada(await atendimento.op('pedir_impressao', d));
    aplicada(await atendimento.op('pedir_impressao', d, { id: novoId() }));
    expect(await sql`select 1 from public.impressoes`).toHaveLength(1);
    expect(await estado(d.impressao_id)).toEqual({ estado: 'pendente', tentativas: 0, impressa: false });
  });

  it('o agente pega, imprime e marca; erro fica registrado com a tentativa', async () => {
    const d = comanda();
    aplicada(await luan.op('pedir_impressao', d));
    aplicada(await agente.op('atualizar_impressao', { impressao_id: d.impressao_id, estado: 'imprimindo' }));
    aplicada(
      await agente.op('atualizar_impressao', { impressao_id: d.impressao_id, estado: 'erro', erro: 'Sem papel' }),
    );
    aplicada(await agente.op('atualizar_impressao', { impressao_id: d.impressao_id, estado: 'imprimindo' }));
    aplicada(await agente.op('atualizar_impressao', { impressao_id: d.impressao_id, estado: 'impresso' }));
    expect(await estado(d.impressao_id)).toEqual({ estado: 'impresso', tentativas: 2, impressa: true });
    const r = await atendimento.op('atualizar_impressao', { impressao_id: d.impressao_id, estado: 'pendente' });
    expect(r.codigo).toBe('sem_permissao');
  });

  it('sem internet: o agente imprime pela rede local e registra; o pedido da fila chega depois e não reimprime', async () => {
    const d = comanda();
    aplicada(await agente.op('registrar_impressao_local', d));
    aplicada(await atendimento.op('pedir_impressao', d));
    expect(await estado(d.impressao_id)).toEqual({ estado: 'impresso', tentativas: 0, impressa: true });
    const [l] = await sql`select pedida_por from public.impressoes where id = ${d.impressao_id}`;
    expect(l?.pedida_por).toBe(agente.id);
  });

  it('o agente não pede impressão nem lê pedidos; o atendimento vê a fila', async () => {
    const r = await agente.op('pedir_impressao', comanda());
    expect(r.codigo).toBe('sem_permissao');
    aplicada(await luan.op('pedir_impressao', comanda()));
    expect((await atendimento.db.from('impressoes').select('tipo')).data).toEqual([{ tipo: 'comanda' }]);
    expect((await agente.db.from('impressoes').select('conteudo')).data).toHaveLength(1);
    expect((await agente.db.from('pedidos').select('id')).data).toEqual([]);
  });
});

describe('batimento do agente', () => {
  it('o agente diz que está vivo; a equipe do balcão vê; outra conta não bate pelo agente', async () => {
    const { error } = await agente.db.rpc('batimento_agente', {
      p: { impressora: '192.168.0.50:9100', impressora_ok: true, versao: 'teste' },
    });
    expect(error).toBeNull();
    const { data } = await atendimento.db.from('agentes').select('impressora, impressora_ok');
    expect(data).toEqual([{ impressora: '192.168.0.50:9100', impressora_ok: true }]);
    const outro = await luan.db.rpc('batimento_agente', { p: {} });
    expect(outro.error?.message).toBe('Só o agente de impressão.');
  });
});
