import { NextResponse } from 'next/server';
import { requireOwnerRequest } from '@/lib/auth/owner';
import { runsPerHourLimit } from '@/lib/config';
import { failure, jsonError, uuidSchema } from '@/lib/http/api';
import { runTask } from '@/lib/orchestrator/runTask';
import { resolveAdapter } from '@/lib/providers';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
// Agent calls can take minutes. The orchestrator keeps its own budget below this.
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const check = requireOwnerRequest(request, { mutating: true });
  if (!check.ok) return check.response;
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return jsonError(404, 'NOT FOUND');
  try {
    const store = getStore();
    // Spend control: every run may call paid providers.
    const limit = await store.hitRateLimit('provider-calls', 3600, runsPerHourLimit());
    if (!limit.allowed) return jsonError(429, 'HOURLY RUN LIMIT REACHED (AGENTOS_MAX_RUNS_PER_HOUR)');
    const outcome = await runTask(id, {
      store,
      resolve: (agentId) => resolveAdapter(agentId),
      actor: check.owner.actor,
      maxOutputTokens: Number(process.env.AGENTOS_MAX_OUTPUT_TOKENS) || 8000,
    });
    if (outcome.ok) return NextResponse.json({ task: outcome.task, approvalId: outcome.approvalId });
    if (outcome.reason === 'not_found') return jsonError(404, 'NOT FOUND');
    if (outcome.reason === 'not_runnable') return jsonError(409, 'TASK IS NOT RUNNABLE IN ITS CURRENT STATE');
    return NextResponse.json({ task: outcome.task, error: outcome.error }, { status: 502 });
  } catch (error) {
    return failure(error);
  }
}
