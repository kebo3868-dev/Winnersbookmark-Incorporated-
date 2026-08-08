import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { parseLeadStatus } from '@/lib/leads/status';
import { isRecordNotFound } from '@/lib/leads/prismaError';

export const dynamic = 'force-dynamic';

/** Move a captured lead through the sales pipeline. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID REQUEST BODY' }, { status: 400 });
  }

  const status = parseLeadStatus((body as { status?: unknown } | null)?.status);
  if (!status) {
    return NextResponse.json({ error: 'INVALID LEAD STATUS' }, { status: 400 });
  }

  try {
    const lead = await prisma.auditLead.update({ where: { id: leadId }, data: { status } });
    return NextResponse.json({ id: lead.id, status: lead.status });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: 'LEAD NOT FOUND' }, { status: 404 });
    }
    console.error('Lead status update failed', error);
    return NextResponse.json({ error: 'LEAD STATUS COULD NOT BE UPDATED' }, { status: 500 });
  }
}

/**
 * Erase a captured lead. A hard delete, not a redaction: this exists to satisfy
 * an individual's erasure request, which the retention sweep's redaction does
 * not fully answer. The audit itself is untouched — only the personal record
 * linked to it is removed.
 *
 * Only a genuine record-not-found answers 404. An outage, timeout or pool
 * exhaustion must not be reported as "the record is absent" — on an erasure
 * endpoint that would tell the operator personal data was deleted when it is
 * still there.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  try {
    await prisma.auditLead.delete({ where: { id: leadId } });
    return NextResponse.json({ id: leadId, deleted: true });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: 'LEAD NOT FOUND' }, { status: 404 });
    }
    console.error('Lead erasure failed', error);
    return NextResponse.json({ error: 'LEAD COULD NOT BE ERASED' }, { status: 500 });
  }
}
