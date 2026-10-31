// Fechar a noite (F1, Fluxo da noite, 7): lista o que ficou pendente; o Luan resolve ou fecha mesmo assim.
import { DoisToques } from '../../compartilhado/ui';
import { acoes, type DadosNoite, type Noite, pendenciasDe } from '../../data/repo';

export function FecharNoite({
  noite,
  dados,
  nomeMotoboy,
  aoFechar,
}: {
  noite: Noite;
  dados: DadosNoite;
  nomeMotoboy: (id: string) => string;
  aoFechar: () => void;
}) {
  const p = pendenciasDe(dados);
  const nomeDoCaixa = (id: string) => nomeMotoboy(dados.caixas.find((c) => c.id === id)?.motoboy_id ?? '');
  const linhas = [
    { rotulo: 'Pedido sem saída', itens: p.semSaida.map((x) => x.codigo), numero: true },
    { rotulo: 'Caixa sem acerto', itens: p.caixasSemAcerto.map(nomeDoCaixa), numero: false },
    { rotulo: 'Pix sem "caiu"', itens: p.pixSemCaiu.map((x) => x.codigo), numero: true },
    { rotulo: 'Rascunho aberto', itens: p.rascunhos.map((x) => x.codigo), numero: true },
  ].filter((l) => l.itens.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {linhas.length === 0 ? (
        <p className="text-apagado">Nada pendente.</p>
      ) : (
        <ul aria-label="Pendentes" className="flex flex-col gap-2">
          {linhas.map((l) => (
            <li key={l.rotulo} className="flex flex-col rounded-xl bg-amber-950 px-3 py-2 text-aviso">
              <span className="text-sm">{l.rotulo}</span>
              <span className={l.numero ? 'numero text-lg' : 'text-lg'}>{l.itens.join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
      <DoisToques
        rotulo={p.total > 0 ? `Fechar com ${p.total} pendente${p.total > 1 ? 's' : ''}` : 'Fechar a noite'}
        variante={p.total > 0 ? 'perigo' : 'principal'}
        aoConfirmar={() => void acoes.fecharNoite(noite.id).then(aoFechar)}
      />
    </div>
  );
}
