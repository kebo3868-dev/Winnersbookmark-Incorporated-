import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { failStaleAudits } from '@/lib/audit/stale';
import { requireOperatorRequest } from '@/lib/operatorAuth';

export async function GET(request: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const guard = requireOperatorRequest(request);
  if (!guard.ok) return guard.response;
  const { auditId } = await params;
  await failStaleAudits(auditId);
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, status: true, overallScore: true, coverageScore: true, failureReason: true, job: { select: { currentStage: true } } },
  });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    auditId: audit.id,
    status: audit.status,
    currentStage: audit.job?.currentStage ?? 'INITIALIZING',
    overallScore: audit.overallScore,
    coverageScore: audit.coverageScore,
    failureReason: audit.failureReason,
  });
}
