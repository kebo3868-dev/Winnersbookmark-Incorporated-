import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Staff-facing draft-order action. Protected by the app-wide basic-auth
// middleware (NOT the voice tool token) — only restaurant staff act on drafts.
const bodySchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'REQUIRES_CALLBACK', 'CANCELLED']),
  staffNotes: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ draftOrderId: string }> }) {
  const { draftOrderId } = await params;

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });

  try {
    const updated = await prisma.draftOrder.update({
      where: { id: draftOrderId },
      data: { status: parsed.data.status, staffNotes: parsed.data.staffNotes ?? undefined },
    });
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch {
    return NextResponse.json({ error: 'Draft order not found.' }, { status: 404 });
  }
}
