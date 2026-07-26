import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { parseLeadStatus } from '@/lib/leads/status';

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
  } catch {
    // Prisma throws P2025 when the row does not exist.
    return NextResponse.json({ error: 'LEAD NOT FOUND' }, { status: 404 });
  }
}

/**
 * Erase a captured lead. A hard delete, not a redaction: this exists to satisfy
 * an individual's erasure request, which the retention sweep's redaction does
 * not fully answer. The audit itself is untouched — only the personal record
 * linked to it is removed.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  try {
    await prisma.auditLead.delete({ where: { id: leadId } });
    return NextResponse.json({ id: leadId, deleted: true });
  } catch {
    return NextResponse.json({ error: 'LEAD NOT FOUND' }, { status: 404 });
  }
}
