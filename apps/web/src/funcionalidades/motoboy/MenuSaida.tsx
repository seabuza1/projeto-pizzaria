// Menu da comanda na porta: trocou a forma, voltou, saiu de novo, desfazer o lançamento.
import { useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { Botao, Chip, curto, DoisToques, Folha, reais } from '../../compartilhado/ui';
import { acoes, type Pagamento, type Pedido, type Saida, useAreas } from '../../data/repo';
import { EditorPagamentos } from './EditorPagamentos';

export function MenuSaida({
  saida,
  pedido,
  vigentes,
  aoFechar,
}: {
  saida: Saida;
  pedido: Pedido;
  vigentes: Pagamento[];
  aoFechar: () => void;
}) {
  const [tela, setTela] = useState<'menu' | 'forma' | 'saiu'>('menu');
  const areas = useAreas();
  const [areaId, setAreaId] = useState(saida.area_id);
  const codigo = pedido.codigo;
  const reaisAntes = vigentes.some((p) => p.real);

  function trocar(linhas: Parameters<typeof acoes.trocarPagamento>[1]) {
    const anteriores = vigentes.map((p) => ({ forma: p.forma, valor: p.valor, trocoPix: p.troco_pix }));
    void acoes.trocarPagamento(saida.id, linhas);
    aoFechar();
    mostrarAviso(`${codigo}: forma trocada`, {
      // Desfazer: volta para o que valia antes (a prevista, se ainda não tinha troca).
      desfazer: () => void acoes.trocarPagamento(saida.id, reaisAntes ? anteriores : []),
    });
  }

  function voltou() {
    void acoes.mudarEstado(saida.id, 'voltou');
    aoFechar();
    mostrarAviso(`${codigo} voltou`, {
      desfazer: () => void acoes.mudarEstado(saida.id, saida.estado === 'entregue' ? 'entregue' : 'em_rota'),
    });
  }

  async function saiuDeNovo() {
    const nova = await acoes.sairDeNovo(saida.id, { areaId });
    aoFechar();
    mostrarAviso(`${codigo} saiu de novo`, { desfazer: () => void acoes.cancelarSaida(nova, 'Desfeito: não saiu') });
  }

  return (
    <Folha aberta aoFechar={aoFechar} titulo={`${codigo} · ${reais(pedido.total)}`}>
      {tela === 'menu' && (
        <div className="flex flex-col gap-2">
          {saida.estado !== 'voltou' && (
            <>
              <Botao onClick={() => setTela('forma')}>Trocou a forma</Botao>
              <Botao variante="perigo" onClick={voltou}>
                Voltou
              </Botao>
            </>
          )}
          {saida.estado === 'voltou' && (
            <>
              <Botao variante="principal" onClick={() => setTela('saiu')}>
                Saiu de novo
              </Botao>
              <Botao
                onClick={() => {
                  void acoes.mudarEstado(saida.id, 'em_rota');
                  aoFechar();
                }}
              >
                Não voltou (desfazer)
              </Botao>
            </>
          )}
          {saida.estado === 'entregue' && (
            <Botao
              onClick={() => {
                void acoes.mudarEstado(saida.id, 'em_rota');
                aoFechar();
              }}
            >
              Ainda não entregou
            </Botao>
          )}
          <DoisToques
            rotulo="Desfazer o lançamento"
            confirmar="Toque de novo para desfazer"
            variante="fantasma"
            aoConfirmar={() => {
              void acoes.cancelarSaida(saida.id, 'Desfeito pelo motoboy');
              aoFechar();
            }}
          />
        </div>
      )}
      {tela === 'forma' && (
        <EditorPagamentos
          total={pedido.total}
          inicial={vigentes.map((p) => ({ forma: p.forma, valor: p.valor, trocoPix: p.troco_pix }))}
          rotulo="Salvar a forma"
          aoConfirmar={trocar}
        />
      )}
      {tela === 'saiu' && (
        <div className="flex flex-col gap-3">
          <p className="text-apagado">Outra saída, com outra taxa (ENT4). Área:</p>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <Chip key={a.id} ativo={a.id === areaId} onClick={() => setAreaId(a.id)}>
                {a.nome} <span className="numero text-apagado">{curto(a.taxa)}</span>
              </Chip>
            ))}
          </div>
          <Botao variante="principal" onClick={() => void saiuDeNovo()}>
            Saiu de novo
          </Botao>
        </div>
      )}
    </Folha>
  );
}
