import { defineConfig } from 'vitest/config';

// `test`: unidade, com impressora falsa. `test:db`: integração com o Supabase local (*.banco.test.ts).
export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', ...(process.env.MEL_TESTE_BANCO ? [] : ['**/*.banco.test.ts'])],
    testTimeout: 20_000,
  },
});
