// Resumo da noite: por forma de pagamento, pago aos motoboys, caixa da empresa, faltas, sobras e cidades.
import { agruparPorCidade, noiteCsv, resumirNoite } from '@mel/dominio';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { baixarArquivo } from '../../compartilhado/arquivo';
import { mostrarAviso } from '../../compartilhado/avisos';
import { Botao, Linha, Secao } from '../../compartilhado/ui';
import { acoes, contaDoCaixa, type DadosNoite, type Noite, useAreas } from '../../data/repo';

export function Resumo({
  noite,
  dados,
  nomeMotoboy,
  voltar = '← Folha',
}: {
  noite: Noite;
  dados: DadosNoite;
  nomeMotoboy: (id: string) => string;
  voltar?: string;
}) {
  const areas = useAreas(true);
  const contas = useMemo(() => dados.caixas.map((c) => ({ caixa: c, conta: contaDoCaixa(c, dados) })), [dados]);
  const r = resumirNoite(contas.map((c) => c.conta));
  const porCidade = useMemo(() => {
    const cidade = new Map(areas.map((a) => [a.id, a.cidade]));
    return agruparPorCidade(r.porArea, (id) => cidade.get(id) ?? '?');
  }, [areas, r.porArea]);

  function exportar() {
    baixarArquivo(
      `mel-noite-${noite.data}.csv`,
      noiteCsv(
        noite.data,
        contas.map(({ caixa, conta }) => ({
          ordem: caixa.ordem_chegada,
          motoboy: nomeMotoboy(caixa.motoboy_id),
          conta,
          confirmado: dados.acertos.some((a) => a.caixa_id === caixa.id),
        })),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <Link to=".." relative="path" className="min-h-12 py-3 text-apagado">
        {voltar}
      </Link>
      {r.pendentes > 0 && (
        <p className="rounded-xl bg-amber-950 px-3 py-2 text-aviso">
          {r.pendentes} caixa(s) sem dinheiro contado: ficam fora da liquidação.
        </p>
      )}
      <Secao titulo="Recebido por forma">
        <Linha rotulo="Dinheiro" valor={r.porForma.dinheiro} />
        <Linha rotulo="Troco por Pix (a mais em dinheiro)" valor={r.porForma.troco} />
        <Linha rotulo="Cartão" valor={r.porForma.cartao} />
        <Linha rotulo="Pix na maquininha" valor={r.porForma.pixMaquina} />
        <Linha rotulo="Pix antecipado" valor={r.porForma.pixAntecipado} />
      </Secao>
      <Secao titulo="Motoboys">
        <Linha rotulo="Pago aos motoboys" valor={r.pagoMotoboys} forte />
        <Linha rotulo="Do caixa deles" valor={r.doCaixaDeles} />
        <Linha rotulo="Retirado do caixa da empresa" valor={r.retiradoCaixaEmpresa} />
        <Linha rotulo="Foi para a empresa" valor={r.vaiParaEmpresa} forte />
        <Linha rotulo="Faltas" valor={r.faltas} />
        <Linha rotulo="Sobras (retidas)" valor={r.sobras} />
        {r.completado > 0 && <Linha rotulo="Completado do bolso" valor={r.completado} />}
      </Secao>
      <Secao titulo={`Entregas por cidade (${r.entregas}, ${r.voltaram} voltaram)`}>
        {Object.entries(porCidade).map(([cidade, t]) => (
          <div key={cidade} className="flex justify-between text-sm">
            <span>{cidade}</span>
            <span className="numero">
              {t.entregues}
              {t.voltaram > 0 && <span className="text-erro"> +{t.voltaram} voltou</span>}
            </span>
          </div>
        ))}
      </Secao>
      <Botao onClick={exportar}>Exportar a noite (CSV)</Botao>
      {/* A folha impressa é só reserva, por botão (MVP.md). */}
      {!noite.fechada_em && (
        <Botao
          variante="fantasma"
          onClick={() => {
            void acoes.imprimirFolha(noite.id);
            mostrarAviso('Folha na impressora');
          }}
        >
          Imprimir a folha
        </Botao>
      )}
    </div>
  );
}
