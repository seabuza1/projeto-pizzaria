// Cadastro de motoboys (F1; decisão 0007): nome e ativo, pela gerente e pelo admin.
// Desativar em vez de apagar: os caixas antigos apontam para o cadastro.
import { type FormEvent, useState } from 'react';
import { mostrarAviso } from '../../compartilhado/avisos';
import { IndicadorFila } from '../../compartilhado/status';
import { Botao } from '../../compartilhado/ui';
import { acoes, type Motoboy, useMotoboys } from '../../data/repo';

const campo = 'min-h-12 flex-1 rounded-xl border border-borda bg-cartao px-3';

function Linha({ motoboy }: { motoboy: Motoboy }) {
  const [nome, setNome] = useState(motoboy.nome);
  function salvarNome() {
    const novo = nome.trim();
    if (novo === '' || novo === motoboy.nome) return setNome(motoboy.nome);
    void acoes.salvarMotoboy({ id: motoboy.id, nome: novo, ativo: motoboy.ativo });
  }
  return (
    <li className="flex items-center gap-2 border-b border-borda py-2">
      <input
        aria-label={`Nome de ${motoboy.nome}`}
        className={`${campo} ${motoboy.ativo ? '' : 'text-apagado line-through'}`}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={salvarNome}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <Botao
        aria-pressed={motoboy.ativo}
        aria-label={`${motoboy.nome} ${motoboy.ativo ? 'ativo' : 'inativo'}`}
        variante={motoboy.ativo ? 'normal' : 'fantasma'}
        onClick={() => void acoes.salvarMotoboy({ id: motoboy.id, nome: motoboy.nome, ativo: !motoboy.ativo })}
      >
        {motoboy.ativo ? 'Ativo' : 'Inativo'}
      </Botao>
    </li>
  );
}

export function Motoboys() {
  const motoboys = useMotoboys();
  const [nome, setNome] = useState('');

  function cadastrar(e: FormEvent) {
    e.preventDefault();
    const novo = nome.trim();
    if (novo === '') return;
    void acoes.salvarMotoboy({ nome: novo, ativo: true });
    mostrarAviso(`${novo} cadastrado`);
    setNome('');
  }

  return (
    <>
      <header className="sticky top-[var(--faixa)] z-30 flex items-center justify-between gap-2 border-b border-borda bg-fundo/95 px-3 py-2 backdrop-blur">
        <span className="font-semibold">Motoboys</span>
        <IndicadorFila />
      </header>
      <div className="flex flex-col gap-3 p-3">
        <form className="flex gap-2" onSubmit={cadastrar}>
          <input
            className={campo}
            placeholder="Nome do motoboy"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Botao variante="principal" type="submit" disabled={nome.trim() === ''}>
            Cadastrar
          </Botao>
        </form>
        <p className="text-sm text-apagado">Quem não trabalha mais fica inativo e sai da lista de chegada.</p>
        <ul aria-label="Motoboys cadastrados">
          {motoboys.map((m) => (
            <Linha key={m.id} motoboy={m} />
          ))}
        </ul>
      </div>
    </>
  );
}
