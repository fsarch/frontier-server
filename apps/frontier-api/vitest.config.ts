import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    include: ['**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: '../coverage',
      exclude: [
        'node_modules/',
        'dist/',
      ],
    },
  },
});
