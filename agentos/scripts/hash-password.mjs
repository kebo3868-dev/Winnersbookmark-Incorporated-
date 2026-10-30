#!/usr/bin/env node
/**
 * Produce AGENTOS_OWNER_PASSWORD_HASH. Reads the password from stdin so it
 * never lands in shell history:
 *
 *   npm run --silent hash-password            (type, then Enter, then Ctrl-D)
 *   printf '%s' "$PW" | npm run --silent hash-password
 *
 * Same scrypt parameters as src/lib/auth/session.ts.
 */
import { randomBytes, scryptSync } from 'node:crypto';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
if (password.length < 12) {
  console.error('Refusing: use a password of at least 12 characters.');
  process.exit(1);
}
const N = 32768, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password.normalize('NFKC'), salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
process.stdout.write(`scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}\n`);
