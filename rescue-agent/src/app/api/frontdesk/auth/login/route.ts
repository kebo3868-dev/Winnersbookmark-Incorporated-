import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { login } from '@/lib/frontdesk/auth/users';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/frontdesk/auth/session';
import { countLoginAttempts, recordLoginAttempt } from '@/lib/frontdesk/messaging/store';
import {
  LOGIN_ATTEMPTS_PER_HOUR,
  TENANT_LOGIN_ATTEMPTS_PER_HOUR,
  TENANT_LOGIN_SUBJECT,
} from '@/lib/frontdesk/messaging/rateLimit';
import { noteRejection } from '@/lib/frontdesk/security/rejections';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * Sign in.
 *
 * A restaurant user signs in AT a restaurant (`tenantSlug`); a Winners
 * Bookmark administrator signs in with no slug. That is not cosmetic — the
 * user lookup is keyed on (tenantId, email), so the same address can hold
 * accounts at two restaurants without either implying the other, and a
 * restaurant user cannot be resolved against a different restaurant at all.
 *
 * Every outcome returns the same message and status. A login endpoint that
 * distinguishes "no such user" from "wrong password" is an account
 * enumeration oracle, and one that distinguishes "no such restaurant" leaks
 * the client list.
 */

const bodySchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(400),
  /** Omitted for a Winners Bookmark administrator. */
  tenantSlug: z.string().min(1).max(100).optional(),
});

const GENERIC_FAILURE = { error: 'INVALID EMAIL OR PASSWORD' };

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json(GENERIC_FAILURE, { status: 401 });

  const { email, password, tenantSlug } = parsed.data;

  let tenantId: string | null = null;
  if (tenantSlug) {
    const tenant = await getTenantBySlug(tenantSlug);
    // Unknown restaurant is reported exactly like a bad password.
    if (!tenant) return NextResponse.json(GENERIC_FAILURE, { status: 401 });
    if (tenant.status === 'SUSPENDED') return NextResponse.json(GENERIC_FAILURE, { status: 401 });
    tenantId = tenant.id;
  }

  // Brute-force bound, per (restaurant, email) per hour. Checked BEFORE the
  // password is verified so a locked account costs an attacker nothing to
  // discover and everything to bypass. The response is the same generic
  // failure, so the limit does not itself reveal that an account exists.
  const now = new Date();
  if (tenantId) {
    // TWO ceilings, because they bound different things.
    //
    // The per-email one bounds brute force against one account. On its own it
    // does not bound STORAGE: each distinct email is its own counter row, so an
    // attacker varying the address grows the table without ever tripping a
    // limit. The per-tenant ceiling below closes that, and is checked first so
    // the per-email row is never written once it is exceeded.
    const tenantAttempts = await countLoginAttempts(tenantId, TENANT_LOGIN_SUBJECT, now, prisma);
    if (tenantAttempts >= TENANT_LOGIN_ATTEMPTS_PER_HOUR) {
      await noteRejection({
        tenantId,
        category: 'FAILED_INTEGRATION',
        operation: 'auth.login',
        reason: 'TENANT_RATE_LIMITED',
        detail:
          'Sign-in attempts for this restaurant have exceeded the hourly ceiling and are being refused. ' +
          'This is what a credential-stuffing run looks like.',
        credentialPresented: true,
        now,
      });
      return NextResponse.json(GENERIC_FAILURE, { status: 401 });
    }

    const attempts = await countLoginAttempts(tenantId, email, now, prisma);
    if (attempts >= LOGIN_ATTEMPTS_PER_HOUR) {
      // Coalesced rather than one audit row per attempt: an attacker who keeps
      // hammering a locked account must not be able to grow the audit log.
      await noteRejection({
        tenantId,
        category: 'FAILED_INTEGRATION',
        operation: 'auth.login',
        reason: 'RATE_LIMITED',
        detail: 'Sign-in attempts for an account are being refused by the hourly limit',
        credentialPresented: true,
        now,
      });
      return NextResponse.json(GENERIC_FAILURE, { status: 401 });
    }
  }

  const result = await login(tenantId, email, password, prisma);

  if (!result.ok) {
    // Only FAILURES are counted, so a busy legitimate user is never locked out.
    // Both counters are upserts on a fixed key, so they are bounded by the
    // ceilings above rather than by request volume.
    if (tenantId) {
      await recordLoginAttempt(tenantId, email, now, prisma);
      await recordLoginAttempt(tenantId, TENANT_LOGIN_SUBJECT, now, prisma);
    }

    // Coalesced, NOT one audit row per attempt. This route is reachable without
    // the operator credential by design — a sign-in page cannot sit behind the
    // password it exists to obtain — so a row per failure was an unbounded
    // write primitive for anyone on the internet, including with no tenantSlug
    // at all. The operator still sees that failures are happening and how many.
    //
    // The email is still not recorded: an audit log of attempted addresses is
    // itself a list worth stealing.
    await noteRejection({
      tenantId,
      category: 'FAILED_INTEGRATION',
      operation: 'auth.login',
      reason: result.reason,
      detail: 'Sign-in attempts are failing',
      credentialPresented: true,
      now,
    });
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  await recordAudit({
    tenantId: result.tenantId,
    event: 'LOGIN',
    actor: result.role,
    outcome: 'ALLOWED',
    detail: `userId=${result.userId}`,
  });

  const response = NextResponse.json({
    ok: true,
    role: result.role,
    tenantId: result.tenantId,
  });
  response.cookies.set(
    SESSION_COOKIE,
    result.token,
    sessionCookieOptions(result.expiresAt, process.env.NODE_ENV === 'production'),
  );
  return response;
}
