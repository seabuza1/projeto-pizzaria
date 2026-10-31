// Conta do acerto com a origem de cada número (ACE10), no caixa do motoboy do painel.
import { agruparPorCidade, type ContaAcerto, explicarConta, textoDasPartes } from '@mel/dominio';
import { useMemo } from 'react';
import { Linha, NOME_FORMA, reais, Secao } from '../../compartilhado/ui';
import { useAreas } from '../../data/repo';

export function ContaDetalhada({ conta }: { conta: ContaAcerto }) {
  const areas = useAreas(true);
  const e = explicarConta(conta);
  const porCidade = useMemo(() => {
    const cidade = new Map(areas.map((a) => [a.id, a.cidade]));
    return agruparPorCidade(conta.porArea, (id) => cidade.get(id) ?? '?');
  }, [areas, conta.porArea]);
  const l = conta.liquidacao;

  return (
    <div className="flex flex-col gap-3">
      <Secao titulo="Devolver">
        <Linha rotulo="Devolver" valor={conta.devolver} forte />
        <p className="text-sm text-apagado">{textoDasPartes(e.devolver)}</p>
      </Secao>

      <Secao titulo="Receber">
        <Linha rotulo="Receber" valor={conta.receber} forte />
        <p className="text-sm text-apagado">{textoDasPartes(e.receber)}</p>
      </Secao>

      <Secao titulo="Maquininha">
        <Linha rotulo="Maquininha esperada" valor={conta.maquininha} forte />
        {conta.listaMaquininha.map((m) => (
          <div key={m.pagamentoId} className="flex justify-between text-sm">
            <span>
              <span className="numero">{m.codigo}</span> <span className="text-apagado">{NOME_FORMA[m.forma]}</span>
            </span>
            <span className="numero">{reais(m.valor)}</span>
          </div>
        ))}
        {conta.pixAntecipado > 0 && (
          <p className="text-sm text-apagado">Pix antecipado (não passa pelo motoboy): {reais(conta.pixAntecipado)}</p>
        )}
      </Secao>

      <Secao titulo="Entregas por cidade">
        {Object.entries(porCidade).map(([cidade, t]) => (
          <div key={cidade} className="flex justify-between text-sm">
            <span>
              {cidade}: {t.entregues}
              {t.voltaram > 0 && <span className="text-erro"> (+{t.voltaram} voltou)</span>}
            </span>
            <span className="numero text-apagado">taxas {reais(t.taxas)}</span>
          </div>
        ))}
        {Object.keys(porCidade).length === 0 && <p className="text-sm text-apagado">Nenhuma entrega ainda.</p>}
      </Secao>

      <Secao titulo="Papéis faltando">
        <p className="text-sm">
          {conta.papelFaltando.length === 0 ? 'Nenhum' : conta.papelFaltando.map((p) => p.codigo).join(', ')}
        </p>
      </Secao>

      {l && (
        <Secao titulo="Liquidação">
          <Linha rotulo="Contado" valor={l.dinheiroContado} />
          {l.falta > 0 && <Linha rotulo="Falta" valor={l.falta} />}
          {l.sobra > 0 && <Linha rotulo="Sobra (fica retida)" valor={l.sobra} />}
          <Linha rotulo="Do caixa dele" valor={l.doCaixaDele} />
          <Linha rotulo="Retirado do caixa da empresa" valor={l.retiradoCaixaEmpresa} />
          <Linha rotulo="Vai para a empresa" valor={l.vaiParaEmpresa} forte />
          {l.completa > 0 && <p className="text-erro">Ele completa {reais(l.completa)} do bolso.</p>}
        </Secao>
      )}
    </div>
  );
}
