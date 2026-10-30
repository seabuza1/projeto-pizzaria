import { defineConfig } from 'vitest/config';

// PADROES, Testes: 100% das linhas de packages/dominio cobertas.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: { lines: 100, functions: 100 },
    },
  },
});
