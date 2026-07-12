import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl, resolveDatabaseUrlSource } from '@/lib/db';

describe('resolveDatabaseUrl (Neon / managed-Postgres env var aliases)', () => {
  it('prefers POSTGRES_PRISMA_URL (Neon pgbouncer-safe Prisma URL) over the plain pooled URL', () => {
    expect(
      resolveDatabaseUrl({ POSTGRES_PRISMA_URL: 'postgres://prisma', DATABASE_URL: 'postgres://pooled', POSTGRES_URL: 'postgres://b' }),
    ).toBe('postgres://prisma');
  });

  it('falls back DATABASE_URL → POSTGRES_URL → PRISMA_DATABASE_URL', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgres://a', POSTGRES_URL: 'postgres://b' })).toBe('postgres://a');
    expect(resolveDatabaseUrl({ POSTGRES_URL: 'postgres://b', PRISMA_DATABASE_URL: 'postgres://c' })).toBe('postgres://b');
    expect(resolveDatabaseUrl({ PRISMA_DATABASE_URL: 'postgres://c' })).toBe('postgres://c');
  });

  it('returns undefined when nothing is set', () => {
    expect(resolveDatabaseUrl({})).toBeUndefined();
  });

  it('reports the source env var name for diagnostics', () => {
    expect(resolveDatabaseUrlSource({ POSTGRES_PRISMA_URL: 'postgres://x' })).toBe('POSTGRES_PRISMA_URL');
    expect(resolveDatabaseUrlSource({ DATABASE_URL: 'postgres://x' })).toBe('DATABASE_URL');
    expect(resolveDatabaseUrlSource({})).toBeNull();
  });
});
