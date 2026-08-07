import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { containsSecretValue } from '@/lib/frontdesk/config/secrets';
import { loadReadiness } from '@/lib/frontdesk/readinessFacts';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * Pilot-readiness report for one restaurant.
 *
 * Read-only and deliberately blunt: it lists what is not ready, who can fix
 * each item, and what the concrete next action is. The point is that nobody
 * has to guess whether a restaurant can safely go live — including the person
 * who most wants the answer to be yes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const authz = authorize(await resolveActor(), tenant.id, 'tenant:read');
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  const report = await loadReadiness(tenant, prisma);

  const payload = {
    tenantSlug: tenant.slug,
    canActivate: report.canActivate,
    status: tenant.status,
    checks: report.checks,
    blockers: report.blockers,
    byOwner: report.byOwner,
  };

  // The report names secrets and states their state; it must never carry a
  // value. Asserted here as well as in tests, because this is the response
  // that gets screenshotted and pasted into a chat window.
  const serialised = JSON.stringify(payload);
  if (containsSecretValue(serialised)) {
    console.error('[frontdesk] readiness payload contained a secret value; refusing to serve it');
    return NextResponse.json({ error: 'READINESS REPORT SUPPRESSED' }, { status: 500 });
  }

  await recordAudit({
    tenantId: tenant.id,
    event: 'READINESS_VIEWED',
    actor: authz.actor.kind,
    outcome: 'ALLOWED',
    detail: `canActivate=${report.canActivate} blockers=${report.blockers.length}`,
  });

  return NextResponse.json(payload);
}
