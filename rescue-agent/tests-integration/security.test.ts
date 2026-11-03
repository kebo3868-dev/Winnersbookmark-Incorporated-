import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import { createUser } from '@/lib/frontdesk/auth/users';
import { createApiKey } from '@/lib/frontdesk/auth/store';
import { takeBudget, throttleSlot } from '@/lib/frontdesk/security/throttle';
import { POST as login } from '@/app/api/frontdesk/auth/login/route';
import { POST as message } from '@/app/api/frontdesk/[tenantSlug]/message/route';

// This suite intentionally refuses every database except the named disposable
// verification database. It is never a production-data verification command.
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/rescue_remediation') throw new Error('Disposable rescue_remediation database required');
  process.env.FRONTDESK_TRUSTED_SOURCE_HEADER = 'x-test-source';
  process.env.BASIC_AUTH_USER = 'operator';
  process.env.BASIC_AUTH_PASSWORD = 'local-verification-operator-password';
  await prisma.fdTenant.createMany({ data: ['protection-a', 'protection-b'].map(slug => ({
    id: slug, slug, name: slug, status: 'ACTIVE', demoMode: true, config: demoTenantConfig,
  })) });
  for (const tenantId of ['protection-a', 'protection-b', null]) await createUser({ tenantId,
    email: 'owner@example.invalid', password: 'valid-disposable-password', role: tenantId ? 'RESTAURANT_OWNER' : 'WBI_ADMIN' });
});
beforeEach(async () => { await prisma.fdSecurityBucket.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

const signIn = (source: string, tenantSlug?: string, password = 'wrong', email = 'owner@example.invalid') => login(new Request('http://localhost/api/frontdesk/auth/login', {
  method: 'POST', headers: { 'x-test-source': source }, body: JSON.stringify({ email, password, tenantSlug }),
}) as never);

// Fixed windows intentionally allow a fresh budget at the minute boundary.
// Start burst assertions away from that boundary to measure ONE window.
async function startMinuteBurst() {
  const remaining = 60_000 - Date.now() % 60_000;
  if (remaining < 15_000) await new Promise(resolve => setTimeout(resolve, remaining + 20));
}

it('arbitrates 100 concurrent admissions atomically at exactly seven and rolls over in place', async () => {
  const results = await Promise.all(Array.from({ length: 100 }, () => takeBudget('integration', 'same-source', 7, 3600)));
  expect(results.filter(Boolean)).toHaveLength(7);
  expect(await prisma.fdSecurityBucket.count()).toBe(1);
  expect((await prisma.fdSecurityBucket.findFirst())?.count).toBe(7);
  await prisma.fdSecurityBucket.updateMany({ data: { windowStart: 0 } });
  expect(await takeBudget('integration', 'same-source', 7, 3600)).toBe(true);
  expect((await prisma.fdSecurityBucket.findFirst())?.count).toBe(1);
  expect(await prisma.fdSecurityBucket.count()).toBe(1);
});

it('isolates tenant namespaces even with identical source/account slots', async () => {
  expect(await takeBudget('login:protection-a', 'same', 1, 3600)).toBe(true);
  expect(await takeBudget('login:protection-a', 'same', 1, 3600)).toBe(false);
  expect(await takeBudget('login:protection-b', 'same', 1, 3600)).toBe(true);
  expect(await prisma.fdSecurityBucket.count()).toBe(2);
});

it('never moves a window backwards when an older concurrent statement arrives', async () => {
  await prisma.fdSecurityBucket.create({ data: { namespace: 'integration', slot: throttleSlot('delayed'), windowStart: 9_000_000_000n, count: 1 } });
  expect(await takeBudget('integration', 'delayed', 3, 60)).toBe(true);
  expect((await prisma.fdSecurityBucket.findFirst())?.windowStart).toBe(9_000_000_000n);
});

it('limits a source rotating arbitrary login addresses without issuing sessions', async () => {
  await startMinuteBurst();
  const sessions = await prisma.fdSession.count();
  const responses = await Promise.all(Array.from({ length: 100 }, (_, i) => signIn('203.0.113.1', undefined, 'wrong', `unknown-${i}@example.invalid`)));
  expect(responses.filter(r => r.status === 401)).toHaveLength(30);
  expect(responses.filter(r => r.status === 429)).toHaveLength(70);
  expect(await prisma.fdSession.count()).toBe(sessions);
  expect(await prisma.fdSecurityBucket.count()).toBeLessThanOrEqual(31);
});

it.each([undefined, 'protection-a'])('bounds %s login guesses and permits the owner from another source', async tenantSlug => {
  const startingSessions = await prisma.fdSession.count();
  for (let i = 0; i < 10; i++) expect((await signIn('192.0.2.1', tenantSlug, 'wrong', i % 2 ? ' OWNER@EXAMPLE.INVALID ' : undefined)).status).toBe(401);
  const audits = await prisma.fdAuditLog.count();
  const response = await signIn('192.0.2.1', tenantSlug, 'valid-disposable-password');
  expect(response.status).toBe(401);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await prisma.fdSession.count()).toBe(startingSessions);
  expect(await prisma.fdAuditLog.count()).toBe(audits);
  expect((await signIn('192.0.2.2', tenantSlug, 'valid-disposable-password')).status).toBe(200);
  if (tenantSlug) expect((await signIn('192.0.2.1', 'protection-b', 'valid-disposable-password')).status).toBe(200);
});

it('bounds concurrent anonymous message writes and preserves reason/tenant coverage and legitimate messaging', async () => {
  await startMinuteBurst();
  const request = (slug: string, source = '198.51.100.1', authorization?: string) => message(new Request('http://localhost/message', {
    method: 'POST', headers: { 'x-test-source': source, ...(authorization ? { authorization } : {}), 'x-request-id': crypto.randomUUID() },
    body: JSON.stringify({ message: 'What are your opening hours?' }),
  }) as never, { params: Promise.resolve({ tenantSlug: slug }) });
  const responses = await Promise.all(Array.from({ length: 250 }, () => request('protection-a')));
  expect(responses.filter(r => r.status === 401)).toHaveLength(120);
  expect(responses.filter(r => r.status === 429)).toHaveLength(130);
  const denials = await prisma.fdAuditLog.findMany({ where: { event: 'MESSAGE_AUTH', tenantId: 'protection-a' } });
  expect(denials).toHaveLength(1);
  expect(denials[0].attempts).toBe(120);
  expect(denials[0].requestId).toBeNull();
  expect(await prisma.fdConversation.count()).toBe(0);
  const key = await createApiKey('protection-a', { name: 'verification', scopes: ['message:write'] });
  expect((await request('protection-b', '198.51.100.2', `Bearer ${key.plaintext}`)).status).toBe(401);
  const wrongTenant = await prisma.fdAuditLog.findFirst({ where: { tenantId: 'protection-b', event: 'MESSAGE_AUTH' } });
  expect(wrongTenant?.detail).toBe('WRONG_TENANT');
  expect((await request('protection-a', '198.51.100.2', `Bearer ${key.plaintext}`)).status).toBe(200);
  expect(await prisma.fdConversation.count({ where: { tenantId: 'protection-a' } })).toBe(1);
  expect(await prisma.fdConversation.count({ where: { tenantId: 'protection-b' } })).toBe(0);
});

it('cannot grow counter storage using a new window for an existing slot', async () => {
  for (let i = 0; i < 20; i++) {
    await prisma.fdSecurityBucket.updateMany({ data: { windowStart: 0 } });
    expect(await takeBudget('source:message', 'window-reuse', 120, 60)).toBe(true);
  }
  expect(await prisma.fdSecurityBucket.count()).toBe(1);
  expect((await prisma.fdSecurityBucket.findFirst())?.slot).toBe(throttleSlot('window-reuse'));
});
