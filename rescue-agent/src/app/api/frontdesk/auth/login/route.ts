import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { login } from '@/lib/frontdesk/auth/users';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/frontdesk/auth/session';
import { countLoginAttempts, recordLoginAttempt } from '@/lib/frontdesk/messaging/store';
import { LOGIN_ATTEMPTS_PER_HOUR, UNKNOWN_ACCOUNT_SUBJECT } from '@/lib/frontdesk/messaging/rateLimit';
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

  const now = new Date();

  // THE PASSWORD IS ALWAYS VERIFIED. Nothing above this line may short-circuit
  // it.
  //
  // An earlier version of this file checked a per-RESTAURANT failure ceiling
  // here and returned 401 once it was reached. That bounded storage, but it
  // also meant an anonymous caller who knew a restaurant's slug could submit
  // sixty bad sign-ins and lock out every member of that restaurant's staff —
  // including correct credentials — for the rest of the hour. Locking a
  // manager out of the dashboard during a food-safety incident is a worse
  // outcome than the table growth it prevented, so the ceiling is gone.
  //
  // Storage is bounded a different way, below: by WHAT the counter is keyed
  // on, never by refusing to authenticate.
  const result = await login(tenantId, email, password, prisma);

  if (!result.ok) {
    if (tenantId) {
      // Failures against a real account are counted against that account.
      // Failures against an address with no account all land on one shared
      // subject, so an attacker cycling through addresses cannot create more
      // than one extra row per hour. The table is bounded by how many accounts
      // the restaurant actually has, not by what a caller sends.
      //
      // Note that an unknown address is still counted rather than skipped:
      // every failed sign-in performs exactly one upsert, so the endpoint
      // cannot be timed to learn which accounts exist.
      //
      // recordLoginAttempt is an upsert-with-increment, atomic in the
      // database, so concurrent failures cannot lose a count or race.
      await recordLoginAttempt(
        tenantId,
        result.accountExists ? email : UNKNOWN_ACCOUNT_SUBJECT,
        now,
        prisma,
      );
    }

    // Coalesced, NOT one audit row per attempt. This route is reachable
    // without the operator credential by design — a sign-in page cannot sit
    // behind the password it exists to obtain — so a row per failure was an
    // unbounded write primitive for anyone on the internet.
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

  // The password was correct. Only now does the per-ACCOUNT lockout apply.
  //
  // Checked here rather than before verification for two reasons. It keeps
  // scrypt on every path, so a locked account cannot be distinguished by
  // response time. And it confines the lockout to the one account that was
  // actually attacked — no other member of staff is affected, which is what
  // went wrong with the restaurant-wide version.
  if (tenantId) {
    const attempts = await countLoginAttempts(tenantId, email, now, prisma);
    if (attempts >= LOGIN_ATTEMPTS_PER_HOUR) {
      await noteRejection({
        tenantId,
        category: 'FAILED_INTEGRATION',
        operation: 'auth.login',
        reason: 'RATE_LIMITED',
        detail: 'Sign-in for an account is locked out by the hourly failure limit',
        credentialPresented: true,
        now,
      });
      return NextResponse.json(GENERIC_FAILURE, { status: 401 });
    }
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
