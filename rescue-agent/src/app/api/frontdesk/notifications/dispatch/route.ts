import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/frontdesk/auth/admin';
import { dispatchBatch } from '@/lib/frontdesk/notify/dispatch';
import { getSmsProvider, SmsProviderNotConfigured } from '@/lib/frontdesk/notify/provider';
import { claimDueNotifications, recordFailure, updateNotification } from '@/lib/frontdesk/notify/store';

export const dynamic = 'force-dynamic';

/**
 * Drain the notification queue. WBI ADMIN ONLY.
 *
 * A platform worker rather than a tenant operation: it processes every
 * restaurant's due notifications, each row carrying its own tenantId which
 * scopes the writes that follow.
 *
 * In a deployment this is driven on a schedule. It is exposed as a route so
 * the pipeline can be driven deterministically in staging and by hand during
 * a pilot — no scheduler is configured here, because that is a deployment
 * decision, not a code one.
 */
export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return admin.response;

  let provider;
  try {
    provider = await getSmsProvider();
  } catch (error) {
    // A misconfigured provider is an operator-visible failure, not a 500 that
    // disappears into a log nobody reads.
    const detail = error instanceof SmsProviderNotConfigured ? error.message : 'SMS provider could not be loaded';
    await recordFailure({
      tenantId: null,
      category: 'FAILED_INTEGRATION',
      operation: 'notifications.dispatch',
      detail,
      lastError: detail,
    });
    return NextResponse.json({ error: detail }, { status: 503 });
  }

  if (!provider) {
    return NextResponse.json(
      {
        error: 'NO SMS PROVIDER CONFIGURED',
        detail: 'Set SMS_PROVIDER to enable outbound alerts. Escalations remain visible on the dashboard.',
      },
      { status: 503 },
    );
  }

  const now = new Date();
  const due = await claimDueNotifications(now, 25, prisma);

  const summary = await dispatchBatch(due, provider, {
    updateNotification: (id, update) => updateNotification(id, update, prisma),
    recordFailure: (failure) => recordFailure(failure, prisma),
    now: () => new Date(),
  });

  return NextResponse.json({
    ...summary,
    provider: provider.name,
    // Stated on every response so a staging run can never be mistaken for real
    // delivery when someone reads the output later.
    simulated: provider.simulated,
  });
}
