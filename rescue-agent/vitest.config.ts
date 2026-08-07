import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env: {
      // The suite never connects to a database — store tests pass a recording
      // fake in place of the client. But `@/lib/db` constructs a PrismaClient
      // at import time, so importing anything that touches it needs a
      // syntactically valid URL. CI sets the same value for the same reason.
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:5432/test?schema=public',
    },
  },
});
