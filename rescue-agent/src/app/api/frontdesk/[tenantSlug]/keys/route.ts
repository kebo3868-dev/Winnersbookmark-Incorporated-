import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ALL_SCOPES, parseScopes } from '@/lib/frontdesk/auth/apiKey';
import { createApiKey, listApiKeys, recordAudit } from '@/lib/frontdesk/auth/store';
import { requireAdmin } from '@/lib/frontdesk/auth/admin';
import { getTenantBySlug } from '@/lib/frontdesk/store';

export const dynamic = 'force-dynamic';

/**
 * Tenant credential management. WBI ADMIN ONLY.
 *
 * A tenant key must never be able to mint another tenant key — that would turn
 * a single leaked website credential into permanent, self-renewing access.
 * Issuing and revoking is therefore reserved for Winners Bookmark operators
 * (§XXV: restaurant users do not get global admin functions).
 */

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string()).min(1),
  /** Optional expiry. An expiring key is preferred for third-party integrations. */
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const admin = requireAdmin(request);
  if (!admin.ok) return admin.response;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  // Digests are never selected, so this response cannot leak key material.
  return NextResponse.json({ keys: await listApiKeys(tenant.id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const admin = requireAdmin(request);
  if (!admin.ok) return admin.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const scopes = parseScopes(parsed.data.scopes);
  if (!scopes) {
    return NextResponse.json(
      { error: `UNKNOWN SCOPE. Valid scopes: ${ALL_SCOPES.join(', ')}` },
      { status: 400 },
    );
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const issued = await createApiKey(tenant.id, {
    name: parsed.data.name,
    scopes,
    expiresAt,
    createdBy: 'WBI_ADMIN',
  });

  await recordAudit({
    tenantId: tenant.id,
    event: 'API_KEY_CREATED',
    actor: 'WBI_ADMIN',
    keyId: issued.id,
    outcome: 'CREATED',
    detail: `name=${issued.name} scopes=${scopes.join('|')}`,
  });

  return NextResponse.json(
    {
      ...issued,
      // Stated explicitly because there is no way to recover it later.
      warning: 'Copy this key now — it is stored only as a hash and cannot be shown again.',
    },
    { status: 201 },
  );
}
