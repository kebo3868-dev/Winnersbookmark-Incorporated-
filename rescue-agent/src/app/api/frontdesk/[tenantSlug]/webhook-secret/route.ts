import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit } from '@/lib/frontdesk/auth/store';
import { setTenantWebhookSecret } from '@/lib/frontdesk/auth/users';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * ISSUE THIS RESTAURANT'S INBOUND WEBHOOK SECRET
 *
 * `setTenantWebhookSecret` has existed since Milestone 6 with no caller
 * anywhere outside its own module, so the secret it generates could never
 * actually be issued.
 *
 * WHEN YOU NEED THIS, AND WHEN YOU DO NOT. The secret keys the platform's own
 * HMAC webhook scheme. Twilio does not use it — Twilio signs with the account
 * auth token — so a Twilio pilot needs nothing here, and the readiness gate no
 * longer pretends otherwise. This exists for providers that do use the
 * platform scheme, and for rotation.
 *
 * The plaintext is returned exactly once and never stored; only its SHA-256
 * digest is persisted. Calling this again rotates the secret, which
 * immediately invalidates the previous one — so a rotation must be coordinated
 * with whoever is sending the webhooks.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const authz = authorize(await resolveActor(), tenant.id, 'keys:manage');
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  const rotated = Boolean(await prisma.fdTenant.findUnique({
    where: { id: tenant.id },
    select: { webhookSecretHash: true },
  }).then((row) => row?.webhookSecretHash));

  const secret = await setTenantWebhookSecret(tenant.id, prisma);

  await recordAudit({
    tenantId: tenant.id,
    event: rotated ? 'WEBHOOK_SECRET_ROTATED' : 'WEBHOOK_SECRET_ISSUED',
    actor: authz.actor.kind,
    outcome: 'ALLOWED',
  });

  return NextResponse.json({
    plaintext: secret.plaintext,
    rotated,
    warning: rotated
      ? 'The previous secret stopped working immediately. Shown once — it cannot be retrieved again.'
      : 'Shown once. It is stored only as a digest and cannot be retrieved again.',
  });
}
