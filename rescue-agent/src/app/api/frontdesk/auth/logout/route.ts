import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionActor } from '@/lib/frontdesk/auth/actor';
import { SESSION_COOKIE } from '@/lib/frontdesk/auth/session';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { revokeSession } from '@/lib/frontdesk/auth/users';

export const dynamic = 'force-dynamic';

/**
 * Sign out.
 *
 * The session is revoked SERVER-SIDE as well as the cookie being cleared.
 * Clearing the cookie alone would leave a still-valid token in whatever copied
 * it — a shared back-office browser, a proxy log — and "logged out" would be a
 * claim about the browser rather than about access.
 */
export async function POST() {
  const actor = await getSessionActor(prisma);

  if (actor) {
    await revokeSession(actor.sessionId, prisma);
    await recordAudit({
      tenantId: actor.tenantId,
      event: 'LOGOUT',
      actor: actor.role,
      outcome: 'ALLOWED',
      detail: `userId=${actor.userId}`,
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
