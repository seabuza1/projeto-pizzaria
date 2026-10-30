import { defineConfig } from 'vitest/config';

// Precisa do Supabase local rodando (supabase start). Os arquivos rodam em sequência: dividem o mesmo banco.
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
