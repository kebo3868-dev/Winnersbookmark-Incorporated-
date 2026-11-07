import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe: `status` and `database`, nothing else, for anyone.
 *
 * It is exempt from the middleware so an orchestrator can reach it, and that
 * is exactly why it must never look at the operator credential. It used to
 * return a configuration block only when the operator password was right,
 * which made it an unthrottled oracle for guessing that password, outside the
 * sign-in limit (independent review of PR #80). The configuration block now
 * lives at /api/diagnostics, behind the middleware's counted gate and the
 * route's own operator check.
 */
export async function GET(_request: Request) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up' });
  } catch {
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503 });
  }
}
