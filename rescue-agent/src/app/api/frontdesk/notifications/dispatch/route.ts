import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/frontdesk/auth/admin';
import { runDispatchCycle } from '@/lib/frontdesk/notify/worker';

export const dynamic = 'force-dynamic';

/**
 * Manual dispatch trigger. WBI ADMIN ONLY.
 *
 * Runs exactly the same cycle as the scheduler (see notify/worker.ts) — this
 * route only differs in how the caller is authenticated. Keeping one cycle
 * means a manual run during a pilot exercises the same code the schedule does,
 * including the atomic claim, so the two cannot drift apart.
 *
 * Safe to invoke while the scheduler is also running: claiming uses
 * FOR UPDATE SKIP LOCKED, so the two take disjoint batches rather than both
 * sending the same alert.
 */
export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return admin.response;

  const result = await runDispatchCycle({ workerId: 'manual' });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, detail: result.detail },
      { status: result.reason === 'NO_PROVIDER' ? 503 : 503 },
    );
  }

  return NextResponse.json(result);
}
