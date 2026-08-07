import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getTenantBySlug, updateLeadStatus } from '@/lib/frontdesk/store';
import { LEAD_STATUSES } from '@/lib/frontdesk/types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  resolution: z.string().max(1000).nullable().optional(),
});

/**
 * Move a lead through the pipeline (§XV).
 *
 * The tenant comes from the path and is applied to the update itself, so a
 * correct lead id belonging to another restaurant produces a 404 rather than a
 * cross-tenant write. Authorisation is decided here on the server; the UI's
 * scoping is convenience, not control (§XIX).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; leadId: string }> },
) {
  const { tenantSlug, leadId } = await params;

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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'NOTHING TO UPDATE' }, { status: 400 });
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: 'RESTAURANT NOT FOUND' }, { status: 404 });

  const updated = await updateLeadStatus(tenant.id, leadId, parsed.data);
  if (!updated) return NextResponse.json({ error: 'LEAD NOT FOUND' }, { status: 404 });

  return NextResponse.json({ id: leadId, ...parsed.data });
}
