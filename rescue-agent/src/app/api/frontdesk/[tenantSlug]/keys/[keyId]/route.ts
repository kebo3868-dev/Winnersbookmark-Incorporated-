import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/frontdesk/auth/admin';
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
  const admin = requireAdmin(request);
  if (!admin.ok) return admin.response;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

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
