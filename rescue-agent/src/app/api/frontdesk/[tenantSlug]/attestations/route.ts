import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authorizePlatform, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { telecomFingerprint } from '@/lib/frontdesk/config/readiness';
import { parseTenantConfig } from '@/lib/frontdesk/config/schema';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * RECORD A PLATFORM ADMINISTRATOR'S ATTESTATION
 *
 * The two blocking gates software cannot answer: whether carrier registration
 * is complete, and whether a named human reads the failure queue. PR #48 made
 * the gates readable; nothing could write them, so `canActivate` stayed
 * unreachable through any supported surface.
 *
 * ── THREE RULES THAT KEEP THIS FROM BECOMING A RUBBER STAMP ──────────────────
 *
 * 1. THE ATTESTER IS THE AUTHENTICATED ACTOR, NOT A STRING IN THE BODY.
 *    A free-text name would let anyone certify as anyone. The identity comes
 *    from the session, so the record says who actually pressed the button.
 *
 * 2. THE TIMESTAMP IS THE SERVER'S. A caller-supplied date could back-date a
 *    certification to before the thing it certifies existed.
 *
 * 3. THE FINGERPRINT IS COMPUTED HERE, FROM THE LIVE CONFIGURATION.
 *    If the caller supplied it they could certify a telecom setup that is not
 *    the one deployed, and the staleness binding — the thing that makes a
 *    certification stop counting when the sending number changes — would be
 *    decorative.
 *
 * The platform still asserts nothing about 10DLC. It records that a named
 * administrator said so, against the exact configuration they said it about.
 */
const bodySchema = z.object({
  /** What is being certified. Both may be sent together. */
  telecom: z
    .object({
      /** Free-text note for the audit trail — never used as evidence. */
      note: z.string().max(500).optional(),
    })
    .optional(),
  failureReview: z
    .object({
      /** Who reviews the failure queue daily. A person, not a rota name. */
      owner: z.string().min(1).max(200),
    })
    .optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  // Platform administrator only. A restaurant cannot certify its own carrier
  // registration, and an attestation is a Winners Bookmark responsibility.
  const authz = authorizePlatform(await resolveActor());
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  if (!parsed.data.telecom && !parsed.data.failureReview) {
    return NextResponse.json({ error: 'NOTHING TO ATTEST' }, { status: 400 });
  }

  // Rule 1: identity from the session.
  const attester =
    authz.actor.kind === 'USER' ? `${authz.actor.email} (${authz.actor.role})` : 'Operator credential (WBI_ADMIN)';
  // Rule 2: the server's clock.
  const at = new Date().toISOString();

  const pilot: Record<string, unknown> = { ...tenant.config.pilot };

  if (parsed.data.telecom) {
    pilot.telecomAttestedAt = at;
    pilot.telecomAttestedBy = attester;
    // Rule 3: computed here, from what is actually deployed.
    pilot.telecomAttestedFingerprint = telecomFingerprint(tenant.config, process.env);
  }
  if (parsed.data.failureReview) {
    pilot.failureReviewOwner = parsed.data.failureReview.owner;
    pilot.failureReviewAttestedAt = at;
  }

  // Re-validate the whole config before writing it back. An attestation must
  // never be the change that leaves a restaurant unparseable.
  const next = parseTenantConfig({ ...tenant.config, pilot });
  if (!next.ok) {
    return NextResponse.json({ error: 'INVALID CONFIGURATION', detail: next.error }, { status: 400 });
  }

  await prisma.fdTenant.update({ where: { id: tenant.id }, data: { config: next.config as never } });

  await recordAudit({
    tenantId: tenant.id,
    event: 'ATTESTATION_RECORDED',
    actor: authz.actor.kind,
    outcome: 'ALLOWED',
    detail: [
      parsed.data.telecom ? 'telecom' : null,
      parsed.data.failureReview ? 'failureReview' : null,
    ]
      .filter(Boolean)
      .join(','),
  });

  return NextResponse.json({
    attestedBy: attester,
    attestedAt: at,
    telecomFingerprint: parsed.data.telecom ? pilot.telecomAttestedFingerprint : undefined,
    failureReviewOwner: parsed.data.failureReview ? pilot.failureReviewOwner : undefined,
    note: 'Recorded on your authority. The platform has NOT verified this with any carrier.',
  });
}
