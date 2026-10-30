// Peças de tela usadas por três ou mais funcionalidades.
import { centavos, formatarCurto, formatarReais } from '@mel/dominio';
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react';

/** Valores do banco (centavos inteiros) formatados como R$ 1.234,56. */
export const reais = (valor: number) => formatarReais(centavos(valor));
export const curto = (valor: number) => formatarCurto(centavos(valor));

export const NOME_FORMA = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix_maquininha: 'Pix maq.',
  pix_antecipado: 'Pix antecipado',
} as const;

export const SIGLA_FORMA = {
  dinheiro: 'din',
  cartao: 'cartão',
  pix_maquininha: 'pix maq',
  pix_antecipado: 'pix',
} as const;

type Variante = 'principal' | 'normal' | 'perigo' | 'fantasma';

const CORES: Record<Variante, string> = {
  principal: 'bg-mel text-black active:bg-amber-600',
  normal: 'bg-cartao text-texto border border-borda active:bg-stone-800',
  perigo: 'bg-red-950 text-erro border border-red-900 active:bg-red-900',
  fantasma: 'text-apagado active:text-texto',
};

export function Botao({
  variante = 'normal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-xl px-4 font-semibold disabled:opacity-40 ${CORES[variante]} ${className}`}
      {...props}
    />
  );
}

/** Sem confirm(): o primeiro toque arma, o segundo confirma (CLAUDE.md, Interface). */
export function DoisToques({
  rotulo,
  confirmar = 'Toque de novo para confirmar',
  aoConfirmar,
  variante = 'normal',
  className = '',
  disabled,
}: {
  rotulo: string;
  confirmar?: string;
  aoConfirmar: () => void;
  variante?: Variante;
  className?: string;
  disabled?: boolean;
}) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 3000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <Botao
      variante={armado ? 'principal' : variante}
      className={className}
      disabled={disabled}
      onClick={() => {
        if (armado) {
          setArmado(false);
          aoConfirmar();
        } else setArmado(true);
      }}
    >
      {armado ? confirmar : rotulo}
    </Botao>
  );
}

export function Chip({
  ativo,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-xl border px-3 text-left ${
        ativo ? 'border-mel bg-amber-950 text-mel' : 'border-borda bg-cartao text-texto'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Folha que sobe de baixo, para menus e formulários curtos. */
export function Folha({
  aberta,
  aoFechar,
  titulo,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
      onKeyDown={(e) => e.key === 'Escape' && aoFechar()}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border-t border-borda bg-fundo p-0 text-texto backdrop:bg-black/70 sm:mx-auto sm:max-w-lg"
    >
      <div className="flex flex-col gap-3 p-4 pb-8">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold">{titulo}</div>
          <Botao variante="fantasma" onClick={aoFechar} aria-label="Fechar">
            ✕
          </Botao>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Linha({ rotulo, valor, forte }: { rotulo: ReactNode; valor: number; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${forte ? 'font-semibold' : ''}`}>
      <span className={forte ? '' : 'text-apagado'}>{rotulo}</span>
      <span className="numero">{reais(valor)}</span>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-borda pt-3">
      <h2 className="text-sm uppercase tracking-wide text-apagado">{titulo}</h2>
      {children}
    </section>
  );
}
