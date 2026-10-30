import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // `server-only` throws outside a React Server Components bundle; the
      // guard is for the Next build, and tests import server modules directly.
      'server-only': path.resolve(import.meta.dirname, './tests/support/server-only.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The suite is hermetic: no test reaches a real provider. The Postgres
    // store test runs only when AGENTOS_TEST_DATABASE_URL names a disposable
    // database (CI provides one), and skips itself otherwise.
  },
});
