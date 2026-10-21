import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    testTimeout: 10_000,
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'src/api/**/*.ts',
        'src/hooks/**/*.ts',
        'src/pages/**/*.tsx',
        'src/App.tsx',
        'src/components/**/*.tsx',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: { lines: 80, functions: 75, statements: 75, branches: 70 },
    },
  },
});
