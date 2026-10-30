import { AGENTS, AGENT_IDS, type AgentId } from '@/lib/agents/registry';
import { mockAllowed, providerConfig } from '@/lib/config';
import type { Probe } from '@/lib/store/types';
import type { Resolution } from './index';
import { isTrainingLicensedMetaModel } from './responses';

/**
 * Honest connection status for each agent.
 *
 * - verified          a live probe of the CURRENTLY configured model
 *                     succeeded within the last 24 hours
 * - unverified        configured, but no recent successful probe for this model
 * - error             configured, and the latest probe failed
 * - blocked           configured in a way policy forbids (training-licensed model)
 * - not_configured    credentials missing; tasks use the mock adapter if
 *                     simulation is allowed here, otherwise they are refused
 *
 * Only a probe can produce "verified". Configuration alone never does.
 */
export type ConnectionState = 'verified' | 'unverified' | 'error' | 'blocked' | 'not_configured';

export interface AgentStatus {
  agentId: AgentId;
  state: ConnectionState;
  model: string;
  detail: string;
  simulated: boolean;
  lastProbe: Probe | null;
}

const VERIFIED_FOR_MS = 24 * 60 * 60 * 1000;

export function agentStatus(
  agentId: AgentId,
  probe: Probe | null,
  env: Record<string, string | undefined> = process.env,
  nowMs: number = Date.now(),
): AgentStatus {
  const agent = AGENTS[agentId];
  const config = providerConfig(agent.provider, env);
  const base = { agentId, model: config.model, lastProbe: probe };

  if (!config.ready) {
    const simulated = mockAllowed(env);
    return {
      ...base,
      state: 'not_configured',
      simulated,
      detail: `Missing ${config.missing.join(', ')}. ${simulated ? 'Tasks run on the mock adapter and are labelled SIMULATED.' : 'Tasks for this agent are refused.'}`,
    };
  }
  if (agent.provider === 'meta' && isTrainingLicensedMetaModel(config.model)) {
    return { ...base, state: 'blocked', simulated: false, detail: `Model ${config.model} licenses Meta to train on your data. Choose a non-contributor model.` };
  }
  const probeIsForThisModel = probe !== null && probe.model === config.model;
  if (probe && probeIsForThisModel && !probe.ok) {
    return { ...base, state: 'error', simulated: false, detail: `Last check failed: ${probe.detail}` };
  }
  if (probe && probeIsForThisModel && probe.ok && nowMs - Date.parse(probe.probedAt) < VERIFIED_FOR_MS) {
    return { ...base, state: 'verified', simulated: false, detail: probe.detail };
  }
  return {
    ...base,
    state: 'unverified',
    simulated: false,
    detail: probe && !probeIsForThisModel ? 'Model changed since the last check. Run a connection check.' : 'Credentials are set but the connection has not been checked recently. Run a connection check.',
  };
}

export function allAgentStatuses(probes: Partial<Record<AgentId, Probe>>, env?: Record<string, string | undefined>, nowMs?: number): AgentStatus[] {
  return AGENT_IDS.map((id) => agentStatus(id, probes[id] ?? null, env, nowMs));
}

export const PROBE_TOKEN = 'AGENTOS_CONNECTION_OK';

export type ProbeOutcome =
  | { recorded: true; probe: Omit<Probe, 'id' | 'probedAt'> }
  | { recorded: false; reason: string };

/**
 * A connection check is one real, minimal completion through the same adapter
 * tasks use, so it proves key, endpoint, model and response parsing together.
 * Mock adapters are not probed: there is nothing to verify.
 */
export async function probeAgent(agentId: AgentId, resolution: Resolution): Promise<ProbeOutcome> {
  if (!resolution.ok) {
    if (resolution.error.kind === 'not_configured') return { recorded: false, reason: resolution.error.message };
    return { recorded: true, probe: { agentId, ok: false, detail: resolution.error.message, model: providerConfig(AGENTS[agentId].provider).model, latencyMs: null } };
  }
  const adapter = resolution.adapter;
  if (adapter.mode === 'mock') return { recorded: false, reason: `${AGENTS[agentId].name} is not configured; the mock adapter has nothing to verify.` };
  try {
    const result = await adapter.complete({
      instructions: 'This is an automated connection check. Follow the instruction exactly.',
      input: `Reply with exactly this text and nothing else: ${PROBE_TOKEN}`,
      maxOutputTokens: 1024,
    });
    const echoed = result.text.includes(PROBE_TOKEN);
    return {
      recorded: true,
      probe: {
        agentId,
        ok: true,
        model: adapter.model,
        latencyMs: result.latencyMs,
        detail: `Live response in ${result.latencyMs} ms from ${result.model ?? adapter.model}${echoed ? '' : ' (reply did not repeat the check phrase exactly)'}${result.providerResponseId ? ` · id ${result.providerResponseId}` : ''}`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return { recorded: true, probe: { agentId, ok: false, model: adapter.model, latencyMs: null, detail: message.slice(0, 500) } };
  }
}
