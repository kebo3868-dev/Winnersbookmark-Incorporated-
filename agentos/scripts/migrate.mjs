#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql in filename order, once each, recording what
 * ran in agentos_migrations. Works against Supabase (direct or session-pooler
 * connection string) and plain Postgres. Each file runs in its own
 * transaction, so a failing migration leaves nothing half-applied.
 *
 * If you manage the schema with the Supabase CLI (`supabase db push`) instead,
 * do not also run this script against the same database.
 *
 *   DATABASE_URL=postgresql://... npm run db:migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
const local = ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname);
const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

await client.connect();
try {
  await client.query('create table if not exists agentos_migrations (name text primary key, applied_at timestamptz not null default now())');
  await client.query('alter table agentos_migrations enable row level security');
  const { rows } = await client.query('select name from agentos_migrations');
  const applied = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into agentos_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`apply  ${file}`);
    } catch (error) {
      await client.query('rollback');
      console.error(`FAILED ${file}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
