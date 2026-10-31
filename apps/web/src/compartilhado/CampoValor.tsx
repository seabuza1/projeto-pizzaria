// Campo de valor em reais: aceita "113" ou "47,50" e salva ao sair do campo ou no Enter.
import { lerValor } from '@mel/dominio';
import { useState } from 'react';
import { reais } from './ui';

const campo = 'numero min-h-12 w-32 rounded-xl border border-borda bg-cartao px-3 text-right text-lg';

export function CampoValor({
  rotulo,
  inicial,
  aoSalvar,
  desabilitado = false,
}: {
  rotulo: string;
  inicial: number | null;
  aoSalvar: (centavos: number | null) => void;
  desabilitado?: boolean;
}) {
  const [texto, setTexto] = useState(inicial === null ? '' : reais(inicial).replace('R$ ', ''));
  const [erro, setErro] = useState('');
  function salvar() {
    if (texto.trim() === '') return aoSalvar(null);
    const v = lerValor(texto);
    if (!v.ok) return setErro(v.erro.mensagem);
    setErro('');
    if (v.valor !== inicial) aoSalvar(v.valor);
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span>{rotulo}</span>
        <input
          className={campo}
          inputMode="decimal"
          aria-label={rotulo}
          value={texto}
          disabled={desabilitado}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </span>
      {erro && <span className="text-sm text-erro">{erro}</span>}
    </label>
  );
}
