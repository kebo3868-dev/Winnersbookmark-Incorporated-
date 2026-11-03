import { NextResponse, type NextRequest } from 'next/server';
import { z } from '@/lib/validation/zod';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { issueSession, verifyCredentials } from '@/lib/frontdesk/auth/users';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/frontdesk/auth/session';
import { sourceThrottle, loginAccountBudget } from '@/lib/frontdesk/security/throttle';
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
 * Credential failures return the same message and status. A login endpoint that
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
  const refused = await sourceThrottle(request, 'login');
  if (refused) return refused;

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

  // Reserve before scrypt for administrators and restaurant users alike.
  // Account budgets are paired with source: remote guesses cannot lock the
  // owner out from another source. No sessions are issued on a refused path.
  try {
    if (!await loginAccountBudget(request, tenantId, email)) {
      return NextResponse.json(GENERIC_FAILURE, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'REQUEST PROTECTION UNAVAILABLE' }, { status: 503 });
  }

  const check = await verifyCredentials(tenantId, email, password, prisma);

  if (!check.ok) {
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
