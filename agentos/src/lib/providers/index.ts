import 'server-only';
import { AGENTS, type AgentId } from '@/lib/agents/registry';
import { mockAllowed, providerConfig } from '@/lib/config';
import { GeminiAdapter } from './gemini';
import type { FetchLike } from './http';
import { MockAdapter } from './mock';
import { hermesAdapter, metaAdapter, openAiAdapter } from './responses';
import { ProviderError, type ProviderAdapter } from './types';

export type Resolution =
  | { ok: true; adapter: ProviderAdapter }
  | { ok: false; error: ProviderError };

/**
 * The adapter that will serve an agent right now.
 *
 * Configured → live adapter. Not configured → the mock adapter when mocks are
 * allowed (development, or explicit opt-in), otherwise a refusal. A
 * configuration that violates policy (a training-licensed Meta model) is a
 * refusal even when mocks are allowed: the founder asked for a live agent and
 * must see why it was not used.
 */
export function resolveAdapter(
  agentId: AgentId,
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: FetchLike,
): Resolution {
  const agent = AGENTS[agentId];
  const config = providerConfig(agent.provider, env);
  if (!config.ready) {
    if (mockAllowed(env)) return { ok: true, adapter: new MockAdapter(agentId) };
    return {
      ok: false,
      error: new ProviderError('not_configured', `${agent.name} is not connected: set ${config.missing.join(', ')}. Simulated output is disabled on this deployment.`),
    };
  }
  try {
    switch (agent.provider) {
      case 'openai':
        return { ok: true, adapter: openAiAdapter(config, fetchImpl) };
      case 'meta':
        return { ok: true, adapter: metaAdapter(config, fetchImpl) };
      case 'hermes':
        return { ok: true, adapter: hermesAdapter(config, fetchImpl) };
      case 'gemini':
        return { ok: true, adapter: new GeminiAdapter(config, fetchImpl) };
    }
  } catch (error) {
    if (error instanceof ProviderError) return { ok: false, error };
    throw error;
  }
}
