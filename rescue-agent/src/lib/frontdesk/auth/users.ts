import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from './password';
import { isWellFormedActor, type Role } from './roles';
import { createSessionToken } from './session';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * User and session persistence.
 *
 * Every lookup that could reach a user is keyed on (tenantId, email), never on
 * email alone. Two restaurants may legitimately have a user with the same
 * address, and resolving one to the other would be a cross-tenant breach
 * dressed up as a convenience.
 */

export async function createUser(
  input: { tenantId: string | null; email: string; password: string; name?: string | null; role: Role },
  db: Db = prisma,
): Promise<{ id: string }> {
  if (!isWellFormedActor({ role: input.role, tenantId: input.tenantId })) {
    throw new Error(
      input.role === 'WBI_ADMIN'
        ? 'A WBI_ADMIN must not be attached to a restaurant'
        : `Role ${input.role} requires a restaurant`,
    );
  }

  return db.fdUser.create({
    data: {
      tenantId: input.tenantId,
      email: input.email.trim().toLowerCase(),
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
      role: input.role,
    },
    select: { id: true },
  });
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; userId: string; role: Role; tenantId: string | null }
  | {
      ok: false;
      reason: 'INVALID_CREDENTIALS' | 'SUSPENDED';
      /**
       * Whether an account with this address exists at this restaurant.
       *
       * INTERNAL ONLY. The caller must never vary its RESPONSE on this — the
       * whole point of the dummy-hash verification above is that a wrong email
       * and a wrong password are indistinguishable. It exists so failure
       * counters can be keyed on real accounts rather than on attacker-chosen
       * addresses, which is what keeps that table bounded.
       */
      accountExists: boolean;
    };

/**
 * Sign in.
 *
 * A wrong email and a wrong password are indistinguishable to the caller, and
 * the password is verified even when no user was found so the response time
 * does not reveal which accounts exist.
 */
export async function login(
  tenantId: string | null,
  email: string,
  password: string,
  db: PrismaClient = prisma,
): Promise<LoginResult> {
  const normalisedEmail = email.trim().toLowerCase();
  const select = { id: true, passwordHash: true, role: true, tenantId: true, status: true } as const;

  // A Winners Bookmark administrator has tenantId NULL, and a compound unique
  // lookup cannot take null — `findUnique({ tenantId_email: { tenantId: null }})`
  // throws at runtime rather than returning no row. The previous
  // `tenantId as string` cast hid that from the compiler, so every
  // administrator sign-in attempt raised an unhandled Prisma error and
  // returned 500 on an endpoint reachable without any credential.
  //
  // `findFirst` with an explicit null is the correct query for that case. The
  // unique constraint still guarantees at most one row.
  const user = tenantId
    ? await db.fdUser.findUnique({ where: { tenantId_email: { tenantId, email: normalisedEmail } }, select })
    : await db.fdUser.findFirst({ where: { tenantId: null, email: normalisedEmail }, select });

  // Dummy verification against a real hash shape keeps the timing of "no such
  // user" close to "wrong password", so the endpoint is not an account oracle.
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk) return { ok: false, reason: 'INVALID_CREDENTIALS', accountExists: Boolean(user) };
  if (user.status !== 'ACTIVE') return { ok: false, reason: 'SUSPENDED', accountExists: true };

  const session = createSessionToken();
  await db.fdSession.create({
    data: { userId: user.id, tokenHash: session.tokenHash, expiresAt: session.expiresAt },
  });
  await db.fdUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    userId: user.id,
    role: user.role,
    tenantId: user.tenantId,
  };
}

/**
 * A structurally valid scrypt hash of a random value, used only to equalise
 * login timing. Generated once per process; it can never match a password.
 */
const DUMMY_HASH = (() => {
  const salt = randomBytes(16).toString('base64url');
  const fake = randomBytes(32).toString('base64url');
  return `scrypt$16384$8$1$${salt}$${fake}`;
})();

export async function revokeSession(sessionId: string, db: Db = prisma): Promise<void> {
  await db.fdSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Sign a user out everywhere — used when suspending an account. */
export async function revokeAllSessionsForUser(userId: string, db: Db = prisma): Promise<number> {
  const result = await db.fdSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listUsers(tenantId: string, db: Db = prisma) {
  return db.fdUser.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    // passwordHash is never selected outside verification.
    select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true },
  });
}

// --- Per-tenant webhook secrets --------------------------------------------

/**
 * Each restaurant gets its OWN inbound-webhook secret.
 *
 * Previously a single platform-wide secret verified every inbound event, which
 * meant anyone able to sign could post events naming ANY restaurant — one
 * tenant's credential effectively granting access to another's data. Scoping
 * the secret per tenant closes that.
 */
export interface IssuedWebhookSecret {
  plaintext: string;
  hash: string;
}

export function generateWebhookSecret(): IssuedWebhookSecret {
  const plaintext = `whsec_${randomBytes(32).toString('base64url')}`;
  return { plaintext, hash: hashWebhookSecret(plaintext) };
}

export function hashWebhookSecret(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export function webhookSecretMatches(presented: string, storedHash: string | null): boolean {
  if (!storedHash) return false; // no secret configured → fail closed
  const left = Buffer.from(hashWebhookSecret(presented), 'utf8');
  const right = Buffer.from(storedHash, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function setTenantWebhookSecret(
  tenantId: string,
  db: Db = prisma,
): Promise<IssuedWebhookSecret> {
  const secret = generateWebhookSecret();
  await db.fdTenant.update({ where: { id: tenantId }, data: { webhookSecretHash: secret.hash } });
  return secret;
}

export async function getTenantWebhookSecretHash(
  tenantId: string,
  db: Db = prisma,
): Promise<string | null> {
  const row = await db.fdTenant.findUnique({ where: { id: tenantId }, select: { webhookSecretHash: true } });
  return row?.webhookSecretHash ?? null;
}
