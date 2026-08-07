import { NextResponse, type NextRequest } from 'next/server';
import { authorize, resolveActor } from '@/lib/frontdesk/auth/actor';
import { recordAudit, revokeApiKey } from '@/lib/frontdesk/auth/store';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * Revoke a tenant credential. WBI ADMIN ONLY.
 *
 * Revocation takes effect on the next request: verifyStoredKey checks
 * `revokedAt` before anything else, so there is no cached-token window.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; keyId: string }> },
) {
  const { tenantSlug, keyId } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const authz = authorize(await resolveActor(), tenant.id, 'keys:manage');
  if (!authz.ok) return NextResponse.json({ error: 'NOT PERMITTED' }, { status: authz.status });

  // Scoped by tenant, so another restaurant's key id cannot be revoked here.
  const revoked = await revokeApiKey(tenant.id, keyId);
  if (!revoked) {
    return NextResponse.json({ error: 'KEY NOT FOUND OR ALREADY REVOKED' }, { status: 404 });
  }

  await recordAudit({
    tenantId: tenant.id,
    event: 'API_KEY_REVOKED',
    actor: 'WBI_ADMIN',
    keyId,
    outcome: 'REVOKED',
  });

  return NextResponse.json({ id: keyId, revoked: true });
}
