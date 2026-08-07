import type { PrismaClient } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';
import { can, isWellFormedActor, mayActOnTenant, type Permission, type Role } from './roles';
import {
  SESSION_COOKIE,
  hashSessionToken,
  isPlausibleToken,
  verifySession,
} from './session';

/**
 * WHO IS MAKING THIS REQUEST, AND WHAT MAY THEY TOUCH?
 *
 * Every dashboard page and every tenant-scoped route resolves an actor here
 * and then asks two questions, never one:
 *
 *   1. Does this actor hold the permission?      → can(role, permission)
 *   2. For THIS restaurant?                      → mayActOnTenant(actor, id)
 *
 * A permission check alone would pass for every restaurant, which is the
 * classic multi-tenant hole. Both are enforced together by `authorize()`
 * below, so a caller cannot accidentally check only the first.
 */

export interface SignedInActor {
  kind: 'USER';
  userId: string;
  sessionId: string;
  email: string;
  role: Role;
  /** NULL only for WBI_ADMIN. */
  tenantId: string | null;
}

/** The legacy operator credential, kept so existing internal tooling works. */
export interface LegacyAdminActor {
  kind: 'LEGACY_ADMIN';
  role: 'WBI_ADMIN';
  tenantId: null;
}

export type Actor = SignedInActor | LegacyAdminActor;

/**
 * Resolve the signed-in user from the session cookie.
 *
 * Returns null for anything that does not resolve to an ACTIVE user with a
 * live session — an expired session, a revoked one, a suspended user, or a
 * malformed row are all simply "not signed in". A suspended user must lose
 * access immediately rather than on next login.
 */
export async function getSessionActor(db: PrismaClient = prisma): Promise<SignedInActor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!isPlausibleToken(token)) return null;

  const session = await db.fdSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { id: true, email: true, role: true, tenantId: true, status: true } },
    },
  });

  const verdict = verifySession(session, new Date());
  if (!verdict.valid || !session?.user) return null;
  if (session.user.status !== 'ACTIVE') return null;

  const actor: SignedInActor = {
    kind: 'USER',
    userId: session.user.id,
    sessionId: session.id,
    email: session.user.email,
    role: session.user.role,
    tenantId: session.user.tenantId,
  };

  // A malformed row — a restaurant role with no tenant, or an admin with one —
  // is refused rather than interpreted generously.
  if (!isWellFormedActor(actor)) return null;

  // Best-effort activity stamp; never allowed to fail the request.
  db.fdSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return actor;
}

export type AuthzResult =
  | { ok: true; actor: Actor }
  | { ok: false; status: 401 | 403; reason: 'NOT_SIGNED_IN' | 'FORBIDDEN_ROLE' | 'WRONG_TENANT' };

/**
 * The single authorization entry point for tenant-scoped surfaces.
 *
 * Both checks, always, in one call — there is no way to use this and check
 * only the permission.
 */
export function authorize(
  actor: Actor | null,
  targetTenantId: string,
  permission: Permission,
): AuthzResult {
  if (!actor) return { ok: false, status: 401, reason: 'NOT_SIGNED_IN' };

  if (!mayActOnTenant(actor, targetTenantId)) {
    // 404-equivalent at the route layer: a restaurant user probing another
    // restaurant's URL must not be able to tell a real slug from a fake one.
    return { ok: false, status: 403, reason: 'WRONG_TENANT' };
  }

  if (!can(actor.role, permission)) {
    return { ok: false, status: 403, reason: 'FORBIDDEN_ROLE' };
  }

  return { ok: true, actor };
}

/** Platform-wide actions (creating restaurants, listing every tenant). */
export function authorizePlatform(actor: Actor | null): AuthzResult {
  if (!actor) return { ok: false, status: 401, reason: 'NOT_SIGNED_IN' };
  if (!can(actor.role, 'platform:admin')) return { ok: false, status: 403, reason: 'FORBIDDEN_ROLE' };
  return { ok: true, actor };
}

/**
 * Resolve the acting principal: a signed-in user, or the legacy operator
 * credential.
 *
 * The Basic Auth credential predates user accounts and still gates the whole
 * app. It is retained as a WBI_ADMIN actor so internal tooling and the staging
 * harness keep working, but it is deliberately the FALLBACK — a real session
 * always wins, so a signed-in restaurant user browsing an app that also has
 * Basic Auth configured is judged as that restaurant user, never silently
 * upgraded to an administrator.
 */
export async function resolveActor(db: PrismaClient = prisma): Promise<Actor | null> {
  const session = await getSessionActor(db);
  if (session) return session;

  const env = process.env;
  const mode = resolveAuthMode({
    BASIC_AUTH_USER: env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: env.BASIC_AUTH_PASSWORD,
    NODE_ENV: env.NODE_ENV,
  });

  // Local development with no credentials configured: the app-wide middleware
  // is already open, so refusing here would make the app unusable offline.
  if (mode === 'open') return { kind: 'LEGACY_ADMIN', role: 'WBI_ADMIN', tenantId: null };
  if (mode === 'misconfigured') return null;

  const store = await headers();
  const ok = checkBasicAuth(
    store.get('authorization'),
    env.BASIC_AUTH_USER as string,
    env.BASIC_AUTH_PASSWORD as string,
  );
  return ok ? { kind: 'LEGACY_ADMIN', role: 'WBI_ADMIN', tenantId: null } : null;
}
