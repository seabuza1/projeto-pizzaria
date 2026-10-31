// ARQUITETURA, Robustez: sem batimento do agente há 2 minutos, "Impressora sem resposta" e a impressão pelo
// navegador como reserva, para o que está parado na fila.
import { useState } from 'react';
import { acoes, useImpressoesParadas, useNoite, useSituacaoImpressora } from '../data/repo';
import { Botao } from './ui';

const NOME: Record<string, string> = { comanda: 'Comanda', recibo_acerto: 'Recibo', folha_noite: 'Folha' };

export function AvisoImpressora() {
  const situacao = useSituacaoImpressora();
  const noite = useNoite();
  const paradas = useImpressoesParadas(noite && !noite.fechada_em ? noite.id : undefined);
  const [aberto, setAberto] = useState(false);
  if (situacao === null || situacao === 'ok') return null;

  return (
    <div role="alert" className="flex flex-col gap-2 bg-red-950 px-4 py-2 text-sm text-erro">
      <div className="flex items-center justify-between gap-2">
        <span>Impressora sem resposta.{paradas.length > 0 && ` ${paradas.length} na fila.`}</span>
        {paradas.length > 0 && (
          <Botao variante="fantasma" onClick={() => setAberto((a) => !a)}>
            {aberto ? 'Fechar' : 'Imprimir pelo navegador'}
          </Botao>
        )}
      </div>
      {aberto &&
        paradas.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2">
            <span className="numero">
              {NOME[i.tipo] ?? i.tipo} {i.conteudo.match(/^\^+(\d{4})/m)?.[1] ?? ''}
            </span>
            <Botao onClick={() => void acoes.imprimirNoNavegador(i.id)}>Imprimir</Botao>
          </div>
        ))}
    </div>
  );
}
