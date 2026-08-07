import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { getRotaStatus, requestContactVerification } from '@/lib/frontdesk/notify/verification';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * ESCALATION ROTA STATUS AND TESTING.
 *
 * GET  → who is on the rota and which contacts have proven they receive alerts
 * POST → send a test alert to one contact and open a verification
 *
 * The test goes through the ordinary gated send path, so it proves the path a
 * real alert would take rather than a convenient shortcut around it. The
 * contact is only marked VERIFIED when a provider delivery receipt arrives —
 * see notify/verification.ts.
 */

const testSchema = z.object({
  contactKey: z.string().min(1).max(80),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const authz = authorize(await resolveActor(), tenant.id, 'tenant:read');
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  const status = await getRotaStatus(tenant.id, tenant.config, prisma);
  return NextResponse.json(status);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  // Sending a message costs money and rings a real person's phone, so this
  // needs the configuration permission rather than read access.
  const authz = authorize(await resolveActor(), tenant.id, 'config:write');
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const parsed = testSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'contactKey IS REQUIRED' }, { status: 400 });

  const result = await requestContactVerification(
    tenant.id,
    tenant.config,
    parsed.data.contactKey,
    authz.actor.kind,
    prisma,
  );

  await recordAudit({
    tenantId: tenant.id,
    event: 'ROTA_TEST_REQUESTED',
    actor: authz.actor.kind,
    outcome: result.ok ? 'ALLOWED' : 'DENIED',
    // The masked number only, never the digits.
    detail: result.ok
      ? `contact=${parsed.data.contactKey} to=${result.masked}`
      : `contact=${parsed.data.contactKey} refused=${result.reason}`,
  });

  if (!result.ok) {
    return NextResponse.json({ sent: false, reason: result.reason, detail: result.detail }, { status: 409 });
  }

  return NextResponse.json({
    sent: true,
    verificationId: result.verificationId,
    to: result.masked,
    // Said explicitly so nobody reads a queued test as a passed one.
    note: 'Queued. This contact counts as verified only once a delivery receipt confirms the message arrived.',
  });
}
