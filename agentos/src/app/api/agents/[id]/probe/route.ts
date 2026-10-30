import { NextResponse } from 'next/server';
import { isAgentId } from '@/lib/agents/registry';
import { requireOwnerRequest } from '@/lib/auth/owner';
import { runsPerHourLimit } from '@/lib/config';
import { failure, jsonError } from '@/lib/http/api';
import { resolveAdapter } from '@/lib/providers';
import { probeAgent } from '@/lib/providers/status';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 150;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const check = requireOwnerRequest(request, { mutating: true });
  if (!check.ok) return check.response;
  const { id } = await context.params;
  if (!isAgentId(id)) return jsonError(404, 'NOT FOUND');
  try {
    const store = getStore();
    const limit = await store.hitRateLimit('provider-calls', 3600, runsPerHourLimit());
    if (!limit.allowed) return jsonError(429, 'HOURLY RUN LIMIT REACHED (AGENTOS_MAX_RUNS_PER_HOUR)');
    const outcome = await probeAgent(id, resolveAdapter(id));
    if (!outcome.recorded) return NextResponse.json({ recorded: false, reason: outcome.reason });
    const probe = await store.addProbe(outcome.probe);
    await store.audit({ actor: check.owner.actor, action: probe.ok ? 'agent.probe_ok' : 'agent.probe_failed', entity: 'agent', entityId: id, details: { model: probe.model, detail: probe.detail } });
    return NextResponse.json({ recorded: true, probe });
  } catch (error) {
    return failure(error);
  }
}
