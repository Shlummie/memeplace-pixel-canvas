import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    alias: {
      '@memeplace/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});

