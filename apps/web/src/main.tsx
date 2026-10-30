import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { iniciarSessao, registrarErro } from './data/repo';
import { Expedicao } from './funcionalidades/expedicao/Expedicao';
import './estilo.css';

// Nenhum erro engolido em silêncio (PADROES, Erros).
window.addEventListener('error', (e) => void registrarErro(e.error ?? e.message, 'janela'));
window.addEventListener('unhandledrejection', (e) => void registrarErro(e.reason, 'promessa'));

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta o elemento #raiz no index.html');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App expedicao={(perfil) => <Expedicao perfil={perfil} />} />
    </BrowserRouter>
  </StrictMode>,
);

void iniciarSessao();
