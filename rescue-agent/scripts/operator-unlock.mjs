#!/usr/bin/env node
/**
 * Clear operator sign-in locks early (issue #73; src/lib/operatorThrottle.ts).
 *
 * Locks expire by themselves after 15 minutes. Use this when the operator
 * cannot wait — for example after a distributed attack has locked sign-in for
 * every browser without a trusted-device cookie.
 *
 *   node scripts/operator-unlock.mjs --status             show counters (no change)
 *   node scripts/operator-unlock.mjs --source 203.0.113.7 clear one address
 *   node scripts/operator-unlock.mjs --global             clear the global lockdown
 *   node scripts/operator-unlock.mjs --all                clear everything
 *
 * Connects with DATABASE_URL (or the same variables as the app). It changes
 * only the OperatorLoginThrottle table. Running it against production is a
 * production data change: do it only when authorised.
 */
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined);

const url = ['RESCUE_DATABASE_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL'].map((n) => process.env[n]).find(Boolean);
if (!url) {
  console.error('No database URL configured (DATABASE_URL or equivalent).');
  process.exit(2);
}

/** Same normalisation and digest as sourceAddress/sourceKey in operatorThrottle.ts. */
function keyFor(address) {
  let source = address.trim();
  if (isIP(source) === 6) {
    const canonical = new URL(`http://[${source}]/`).hostname.slice(1, -1);
    const [left, right] = canonical.split('::');
    const front = left ? left.split(':') : [];
    const back = right ? right.split(':') : [];
    const words = right === undefined ? front : [...front, ...Array(8 - front.length - back.length).fill('0'), ...back];
    if (words.slice(0, 5).every((w) => parseInt(w, 16) === 0) && parseInt(words[5], 16) === 0xffff) {
      const hi = parseInt(words[6], 16);
      const lo = parseInt(words[7], 16);
      source = [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
    } else {
      source = `${words.slice(0, 4).map((w) => w.padStart(4, '0')).join(':')}::/64`;
    }
  } else if (isIP(source) !== 4 && source !== 'local') {
    console.error(`Not an IP address: ${address}`);
    process.exit(2);
  }
  return `source:${createHash('sha256').update(`operator-source|${source}`).digest('hex')}`;
}

const db = new PrismaClient({ datasourceUrl: url });
try {
  if (flag('--status') || args.length === 0) {
    const rows = await db.$queryRawUnsafe(
      `SELECT CASE WHEN "key" = 'global' THEN 'global' ELSE 'source:' || left(substr("key", 8), 12) || '…' END AS "key",
              "failures", "lockedUntil", "updatedAt" FROM "OperatorLoginThrottle" ORDER BY "updatedAt" DESC LIMIT 50`,
    );
    console.table(rows);
    if (args.length === 0) console.log('Use --source <ip>, --global or --all to clear.');
  } else {
    let keys = null;
    if (flag('--all')) keys = 'ALL';
    else if (flag('--global')) keys = ['global'];
    else if (valueOf('--source')) keys = [keyFor(valueOf('--source'))];
    if (!keys) {
      console.error('Specify --status, --source <ip>, --global or --all.');
      process.exit(2);
    }
    const cleared = keys === 'ALL'
      ? await db.$executeRawUnsafe(`DELETE FROM "OperatorLoginThrottle"`)
      : await db.$executeRawUnsafe(`DELETE FROM "OperatorLoginThrottle" WHERE "key" = ANY($1::text[])`, keys);
    console.log(`Cleared ${cleared} counter(s).`);
  }
} finally {
  await db.$disconnect();
}
