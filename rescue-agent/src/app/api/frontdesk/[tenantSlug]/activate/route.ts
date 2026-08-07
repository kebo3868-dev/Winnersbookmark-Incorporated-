import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authorizePlatform, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { loadReadiness } from '@/lib/frontdesk/readinessFacts';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * ACTIVATION GATE.
 *
 * The one place a restaurant moves from ONBOARDING to ACTIVE. Every
 * pilot-readiness blocker is re-evaluated HERE, at the moment of the change,
 * rather than trusted from a dashboard someone looked at yesterday — a rota
 * contact can opt out, a secret can be rotated, and a checklist that was true
 * on Tuesday is not a fact on Friday.
 *
 * PLATFORM ADMIN ONLY. A restaurant owner deciding their own front desk is
 * ready is exactly the conflict of interest the gate exists to remove; the
 * blockers are visible to them on the readiness endpoint, but clearing them is
 * someone else's signature.
 *
 * The gate REFUSES rather than warns. A warning at activation time is read
 * once by someone who has already decided to go live.
 */

const bodySchema = z.object({
  /**
   * Explicit confirmation that a human read the blockers. Prevents a scripted
   * or mistaken POST from flipping a restaurant live.
   */
  confirm: z.literal(true),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const authz = authorizePlatform(await resolveActor());
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }
  if (!bodySchema.safeParse(raw).success) {
    return NextResponse.json({ error: 'CONFIRMATION REQUIRED' }, { status: 400 });
  }

  const report = await loadReadiness(tenant, prisma);

  if (!report.canActivate) {
    await recordAudit({
      tenantId: tenant.id,
      event: 'ACTIVATION_REFUSED',
      actor: authz.actor.kind,
      outcome: 'DENIED',
      detail: `blockers=${report.blockers.map((b) => b.id).join(',')}`,
    });

    return NextResponse.json(
      {
        error: 'NOT READY FOR ACTIVATION',
        blockers: report.blockers.map((b) => ({
          id: b.id,
          label: b.label,
          owner: b.owner,
          detail: b.detail,
          action: b.action,
        })),
        byOwner: {
          CODE: report.byOwner.CODE.map((b) => b.id),
          OPERATOR: report.byOwner.OPERATOR.map((b) => b.id),
          EXTERNAL: report.byOwner.EXTERNAL.map((b) => b.id),
        },
      },
      { status: 409 },
    );
  }

  // Scoped by id AND current status, so two concurrent activations cannot both
  // believe they were the one that flipped it.
  const updated = await prisma.fdTenant.updateMany({
    where: { id: tenant.id, status: 'ONBOARDING' },
    data: { status: 'ACTIVE' },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'ALREADY ACTIVE OR SUSPENDED', status: tenant.status }, { status: 409 });
  }

  await recordAudit({
    tenantId: tenant.id,
    event: 'ACTIVATED',
    actor: authz.actor.kind,
    outcome: 'ALLOWED',
    detail: `${report.checks.length} readiness checks passed`,
  });

  return NextResponse.json({ activated: true, tenantSlug: tenant.slug, status: 'ACTIVE' });
}
