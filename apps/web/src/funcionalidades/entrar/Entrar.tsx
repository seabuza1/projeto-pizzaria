// Login por e-mail e senha; admin e gerente confirmam o código do app autenticador (MFA).
import { type FormEvent, useState } from 'react';
import { Botao } from '../../compartilhado/ui';
import { confirmarCodigo, entrar, type Sessao, sair } from '../../data/repo';

const campo = 'min-h-12 w-full rounded-xl border border-borda bg-cartao px-4 text-texto outline-none focus:border-mel';

export function Entrar({ erroInicial }: { erroInicial?: string | undefined }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(erroInicial ?? '');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro((await entrar(email, senha)) ?? '');
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-4">
      <h1 className="text-2xl font-bold text-mel">Mel Pizzaria</h1>
      <input
        className={campo}
        type="email"
        autoComplete="username"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className={campo}
        type="password"
        autoComplete="current-password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
      />
      {erro && <p className="text-erro">{erro}</p>}
      <Botao variante="principal" type="submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </Botao>
    </form>
  );
}

export function CodigoMfa({ sessao }: { sessao: Extract<Sessao, { estado: 'mfa' | 'cadastrar_mfa' }> }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro((await confirmarCodigo(codigo)) ?? '');
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-4">
      <h1 className="text-xl font-bold">Código do autenticador</h1>
      {sessao.estado === 'cadastrar_mfa' && (
        <>
          <p className="text-apagado">
            Primeiro acesso: leia o QR code com um app autenticador (Google Authenticator ou parecido) e digite o código
            de 6 dígitos.
          </p>
          <img src={sessao.qrCode} alt="QR code do autenticador" className="mx-auto size-48 rounded-xl bg-white p-2" />
          <p className="numero break-all text-center text-xs text-apagado">{sessao.segredo}</p>
        </>
      )}
      <input
        className={`${campo} numero text-center text-2xl tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
      />
      {erro && <p className="text-erro">{erro}</p>}
      <Botao variante="principal" type="submit" disabled={enviando || codigo.length !== 6}>
        Confirmar
      </Botao>
      <Botao variante="fantasma" onClick={() => void sair(true)}>
        Sair
      </Botao>
    </form>
  );
}
