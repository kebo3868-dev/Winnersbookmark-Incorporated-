import { PrismaClient } from '@prisma/client';

// Read-only release preflight. Use the same precedence as src/lib/db.ts.
// Never print the connection string or tenant identifiers.
const url = [
  'RESCUE_DATABASE_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL',
].map((name) => process.env[name]).find(Boolean);
if (!url) {
  console.error('BLOCKED: no database configured for the login-slug collision check.');
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });
try {
  const collision = await db.fdTenant.findUnique({ where: { slug: 'login' }, select: { id: true } });
  if (collision) {
    console.error('BLOCKED: an existing tenant uses slug login. Do not release this route.');
    process.exitCode = 1;
  } else {
    console.log('PASS: no existing tenant uses slug login.');
  }
} catch {
  console.error('BLOCKED: unable to verify the login-slug collision check.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
