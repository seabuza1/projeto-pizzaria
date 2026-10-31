// Promoção da noite (F2, 2g; PED4): ao abrir a noite, a expedição ou a gerente define o desconto ou "sem promoção".
import { centavos, validarPromocao } from '@mel/dominio';
import { useState } from 'react';
import { CampoValor } from '../../compartilhado/CampoValor';
import { Botao, reais } from '../../compartilhado/ui';
import { acoes, type Noite } from '../../data/repo';

export function PromocaoDaNoite({ noite }: { noite: Noite }) {
  const [mudando, setMudando] = useState(false);
  const [erro, setErro] = useState('');
  const definida = noite.promo_desconto !== null;

  function definir(valor: number) {
    const r = validarPromocao(centavos(valor));
    if (!r.ok) return setErro(r.erro.mensagem);
    setErro('');
    setMudando(false);
    void acoes.definirPromocao(noite.id, valor);
  }

  if (definida && !mudando) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 pt-3 text-sm">
        <span className="text-apagado">
          {noite.promo_desconto === 0 ? 'Sem promoção hoje' : `Promoção da noite: ${reais(noite.promo_desconto ?? 0)}`}
        </span>
        <Botao variante="fantasma" onClick={() => setMudando(true)}>
          Mudar
        </Botao>
      </div>
    );
  }

  return (
    <section aria-label="Promoção da noite" className="m-3 flex flex-col gap-2 rounded-xl bg-amber-950 px-3 py-2">
      {!definida && <span className="text-aviso">Promoção da noite não definida</span>}
      <CampoValor rotulo="Desconto nas tradicionais" inicial={null} aoSalvar={(v) => v !== null && definir(v)} />
      {erro && <span className="text-sm text-erro">{erro}</span>}
      <Botao
        onClick={() => {
          setMudando(false);
          void acoes.definirPromocao(noite.id, 0);
        }}
      >
        Sem promoção
      </Botao>
    </section>
  );
}
