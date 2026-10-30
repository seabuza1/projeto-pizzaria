import { defineConfig } from 'vitest/config';

// `test`: unidade, sem rede. `test:db`: integração com o Supabase local (*.banco.test.ts).
export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', 'e2e/**', ...(process.env.MEL_TESTE_BANCO ? [] : ['**/*.banco.test.ts'])],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
