import { beforeAll, afterAll, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { POST as message } from '@/app/api/frontdesk/[tenantSlug]/message/route';
import { POST as login } from '@/app/api/frontdesk/auth/login/route';
import { getTenantBySlug } from '@/lib/frontdesk/store';

beforeAll(() => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/rescue_remediation') throw new Error('Disposable database required');
  process.env.BASIC_AUTH_USER = 'operator';
  process.env.BASIC_AUTH_PASSWORD = 'local-verification-operator-password';
});
afterAll(async () => { await prisma.$disconnect(); });

it('reproduces one audit row per unauthenticated message on the exact baseline', async () => {
  const before = await prisma.fdAuditLog.count();
  for (let i = 0; i < 25; i++) {
    const response = await message(new Request('http://localhost/message', { method: 'POST', body: JSON.stringify({ message: 'hello' }) }) as never,
      { params: Promise.resolve({ tenantSlug: 'protection-a' }) });
    expect(response.status).toBe(401);
  }
  expect(await prisma.fdAuditLog.count() - before).toBe(25);
  console.log('BASELINE: 25 anonymous messages created 25 new security audit rows');
});

it('reproduces administrator admission after ten failed guesses', async () => {
  const request = (password: string) => new Request('http://localhost/login', { method: 'POST', body: JSON.stringify({ email: 'owner@example.invalid', password }) });
  for (let i = 0; i < 10; i++) expect((await login(request('wrong') as never)).status).toBe(401);
  expect((await login(request('valid-disposable-password') as never)).status).toBe(200);
  console.log('BASELINE: platform administrator still authenticates after ten failures; no administrator counter enforced');
});

it('reproduces the stored historical tenant disappearing with minute timestamps', async () => {
  const original = await prisma.fdTenant.findUniqueOrThrow({ where: { slug: 'protection-a' } });
  try {
    await prisma.fdTenant.update({ where: { id: original.id }, data: { config: { ...(original.config as object), pilot: { ownerVerifiedAt: '2026-08-07T10:00Z' } } } });
    expect(await getTenantBySlug('protection-a')).toBeNull();
    const response = await message(new Request('http://localhost/message', { method: 'POST', body: JSON.stringify({ message: 'hello' }) }) as never,
      { params: Promise.resolve({ tenantSlug: 'protection-a' }) });
    expect(response.status).toBe(404);
    console.log('BASELINE: valid historical minute timestamp produces RESTAURANT NOT FOUND (404)');
  } finally {
    await prisma.fdTenant.update({ where: { id: original.id }, data: { config: original.config! } });
  }
});
