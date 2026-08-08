import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { issueSession, verifyCredentials } from '@/lib/frontdesk/auth/users';
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
  // An earlier version checked a per-RESTAURANT failure ceiling here and
  // returned 401 once reached. That bounded storage, but it also let an
  // anonymous caller who knew a restaurant's slug lock out every member of
  // that restaurant's staff — correct credentials included — for the rest of
  // the hour. Locking a manager out of the dashboard during a food-safety
  // incident is a worse outcome than the table growth it prevented.
  //
  // Verification WRITES NOTHING. Session issuance is a separate call, made
  // only after every refusal below has been decided.
  const check = await verifyCredentials(tenantId, email, password, prisma);

  if (!check.ok) {
    if (tenantId) {
      // Keyed on the IMMUTABLE user id, never on the address the caller typed.
      //
      // Keying on the email fragmented the counter: the account lookup trims
      // and lowercases, so " Owner@x " and "owner@x" authenticate as the same
      // user, and an attacker could vary whitespace to get a fresh counter for
      // each variant — bypassing the lockout and creating unbounded rows. An
      // id cannot be varied.
      //
      // Failures against an address with NO account all fold onto one shared
      // subject, so the table is bounded by how many accounts the restaurant
      // actually has rather than by what a caller sends. An unknown address is
      // still counted rather than skipped, so every failed sign-in performs
      // exactly one upsert and the endpoint cannot be timed to discover which
      // accounts exist.
      //
      // The upsert-with-increment is atomic in the database, so concurrent
      // failures cannot lose a count or race.
      await recordLoginAttempt(tenantId, check.userId ?? UNKNOWN_ACCOUNT_SUBJECT, now, prisma);
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
      reason: check.reason,
      detail: 'Sign-in attempts are failing',
      credentialPresented: true,
      now,
    });
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  // The password was correct. The per-ACCOUNT lockout is checked HERE —
  // after verification, and before anything is written.
  //
  // After verification, so scrypt runs on every path and a locked account
  // cannot be identified by response time. Before session issuance, because
  // minting a session and then refusing would leave an orphan FdSession row
  // for every rejected attempt — an unbounded write, and a side effect that
  // distinguishes the correct-password path from a wrong guess.
  if (tenantId) {
    const attempts = await countLoginAttempts(tenantId, check.userId, now, prisma);
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

  // Every refusal is behind us. Only now is anything written.
  const session = await issueSession(check.userId, prisma);

  await recordAudit({
    tenantId: check.tenantId,
    event: 'LOGIN',
    actor: check.role,
    outcome: 'ALLOWED',
    detail: `userId=${check.userId}`,
  });

  const response = NextResponse.json({
    ok: true,
    role: check.role,
    tenantId: check.tenantId,
  });
  response.cookies.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(session.expiresAt, process.env.NODE_ENV === 'production'),
  );
  return response;
}
