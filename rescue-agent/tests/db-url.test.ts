import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl, resolveDatabaseUrlSource } from '@/lib/db';

describe('resolveDatabaseUrl (Neon / managed-Postgres env var aliases)', () => {
  it('prefers RESCUE_DATABASE_URL over every integration-managed name', () => {
    // The Neon Vercel integration owns and locks DATABASE_URL, so pointing this
    // app at its own database depends on the override winning outright.
    expect(
      resolveDatabaseUrl({
        RESCUE_DATABASE_URL: 'postgres://rescue_agent',
        POSTGRES_PRISMA_URL: 'postgres://prisma',
        DATABASE_URL: 'postgres://neondb',
        POSTGRES_URL: 'postgres://b',
      }),
    ).toBe('postgres://rescue_agent');
    expect(
      resolveDatabaseUrlSource({ RESCUE_DATABASE_URL: 'postgres://x', DATABASE_URL: 'postgres://y' }),
    ).toBe('RESCUE_DATABASE_URL');
  });

  it('leaves existing behaviour unchanged when the override is absent', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgres://neondb' })).toBe('postgres://neondb');
    expect(resolveDatabaseUrlSource({ DATABASE_URL: 'postgres://neondb' })).toBe('DATABASE_URL');
  });

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
