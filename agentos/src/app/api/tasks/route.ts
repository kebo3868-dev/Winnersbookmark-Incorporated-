import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AGENT_IDS } from '@/lib/agents/registry';
import { requireOwnerRequest } from '@/lib/auth/owner';
import { failure, jsonError, readJson } from '@/lib/http/api';
import { chooseReviewer } from '@/lib/orchestrator/review';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  objective: z.string().trim().min(10).max(8000),
  agentId: z.enum(AGENT_IDS),
  riskLevel: z.enum(['low', 'medium', 'high']),
  reviewer: z.union([z.enum(AGENT_IDS), z.literal('auto'), z.literal('none')]).default('auto'),
});

export async function POST(request: Request) {
  const check = requireOwnerRequest(request, { mutating: true });
  if (!check.ok) return check.response;
  const body = await readJson(request, bodySchema);
  if (!body.ok) return body.response;
  try {
    const store = getStore();
    const limit = await store.hitRateLimit('tasks:create', 3600, 120);
    if (!limit.allowed) return jsonError(429, 'TASK CREATION LIMIT REACHED — try again within the hour');
    const { title, objective, agentId, riskLevel, reviewer } = body.data;
    const task = await store.createTask({ title, objective, agentId, riskLevel, reviewerAgentId: chooseReviewer(agentId, riskLevel, reviewer) }, check.owner.actor);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
