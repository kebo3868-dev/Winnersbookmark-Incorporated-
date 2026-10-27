import { NextResponse } from 'next/server';
import { createDemoAudit } from '@/lib/audit/demo';
import { requireOperatorRequest } from '@/lib/operatorAuth';

export async function POST(request: Request) {
  const guard = requireOperatorRequest(request);
  if (!guard.ok) return guard.response;
  try {
    const { auditId } = await createDemoAudit();
    return NextResponse.json({ auditId }, { status: 201 });
  } catch (error) {
    console.error('Demo audit failed', error);
    return NextResponse.json({ error: 'AUDIT COULD NOT START' }, { status: 500 });
  }
}
