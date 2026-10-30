import { defineConfig, devices } from '@playwright/test';

// Fluxos que dão dinheiro (PADROES, Testes): lançar, entregar, acertar e imprimir.
// Precisa do Supabase local (supabase start); o app sobe sozinho com o vite.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'celular', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
