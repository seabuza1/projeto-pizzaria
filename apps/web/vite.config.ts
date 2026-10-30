import { execFileSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pacote from './package.json' with { type: 'json' };

// Fora de produção e sem VITE_SUPABASE_* no ambiente, usa o Supabase local (supabase start).
// Assim nenhuma chave fica escrita no código.
function supabaseLocal(): Record<string, string> {
  try {
    const status = JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
        cwd: new URL('../..', import.meta.url).pathname,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ) as Record<string, string>;
    return { VITE_SUPABASE_URL: status.API_URL ?? '', VITE_SUPABASE_ANON_KEY: status.ANON_KEY ?? '' };
  } catch {
    return {};
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const local = !env.VITE_SUPABASE_URL && mode !== 'production' ? supabaseLocal() : {};
  const valores = { ...local, VITE_VERSAO: pacote.version };
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Atualização do PWA: o app avisa "Atualizar" e nunca atualiza sozinho no meio de um lançamento.
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'Mel PDV',
          short_name: 'Mel',
          lang: 'pt-BR',
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#0c0a09',
          background_color: '#0c0a09',
          icons: [
            { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      }),
    ],
    define: Object.fromEntries(
      Object.entries(valores).map(([chave, valor]) => [`import.meta.env.${chave}`, JSON.stringify(valor)]),
    ),
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});
