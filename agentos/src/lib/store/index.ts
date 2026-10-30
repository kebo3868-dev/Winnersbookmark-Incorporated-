import 'server-only';
import { Pool } from 'pg';
import { isProduction } from '@/lib/config';
import { MemoryStore } from './memory';
import { PgStore } from './pg';
import type { Store } from './types';

/**
 * The process-wide store.
 *
 * DATABASE_URL set → Postgres (Supabase). Unset outside production → an
 * in-memory store, announced on every page. Unset in production → refused:
 * a production deployment that forgot its database must fail loudly, never
 * quietly accept tasks it will lose on the next cold start.
 *
 * Supabase: use the pooled connection string (Supavisor, port 6543) on
 * Vercel, without an `sslmode` parameter (TLS is configured here). TLS with
 * certificate verification is required unless the URL is a local database.
 */
export class StoreUnavailableError extends Error {}

const globalForStore = globalThis as unknown as { __agentosStore?: Store };

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export function createStore(env: Record<string, string | undefined> = process.env): Store {
  const url = env.DATABASE_URL;
  if (!url) {
    if (isProduction(env)) throw new StoreUnavailableError('DATABASE_URL is not set. AgentOS will not run in production without its database.');
    return new MemoryStore();
  }
  const pool = new Pool({
    connectionString: url,
    max: Number(env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Verified TLS. Supabase signs with its own CA: put that PEM (Database
    // Settings → SSL → download certificate) in DATABASE_CA_CERT.
    ssl: isLocal(url) ? undefined : { rejectUnauthorized: true, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}) },
  });
  return new PgStore(pool);
}

export function getStore(): Store {
  if (!globalForStore.__agentosStore) globalForStore.__agentosStore = createStore();
  return globalForStore.__agentosStore;
}

export type { Store } from './types';
