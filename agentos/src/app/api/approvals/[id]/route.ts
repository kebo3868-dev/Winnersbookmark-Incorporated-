import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnerRequest } from '@/lib/auth/owner';
import { failure, jsonError, readJson, uuidSchema } from '@/lib/http/api';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const check = requireOwnerRequest(request, { mutating: true });
  if (!check.ok) return check.response;
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return jsonError(404, 'NOT FOUND');
  const body = await readJson(request, bodySchema);
  if (!body.ok) return body.response;
  try {
    const approval = await getStore().decideApproval(id, body.data.decision, check.owner.actor, body.data.note || null);
    if (!approval) return jsonError(409, 'APPROVAL IS NOT PENDING');
    return NextResponse.json({ approval });
  } catch (error) {
    return failure(error);
  }
}
