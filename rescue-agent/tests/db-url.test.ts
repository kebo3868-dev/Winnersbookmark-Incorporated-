import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl } from '@/lib/db';

describe('resolveDatabaseUrl (managed-Postgres env var aliases)', () => {
  it('prefers DATABASE_URL', () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL: 'postgres://a', POSTGRES_URL: 'postgres://b', PRISMA_DATABASE_URL: 'postgres://c' }),
    ).toBe('postgres://a');
  });

  it('falls back to POSTGRES_URL then PRISMA_DATABASE_URL', () => {
    expect(resolveDatabaseUrl({ POSTGRES_URL: 'postgres://b', PRISMA_DATABASE_URL: 'postgres://c' })).toBe('postgres://b');
    expect(resolveDatabaseUrl({ PRISMA_DATABASE_URL: 'postgres://c' })).toBe('postgres://c');
  });

  it('returns undefined when nothing is set', () => {
    expect(resolveDatabaseUrl({})).toBeUndefined();
  });
});
