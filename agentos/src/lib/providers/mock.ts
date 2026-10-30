import type { AgentId, ProviderId } from '@/lib/agents/registry';
import { AGENTS } from '@/lib/agents/registry';
import { ProviderError, type CompletionRequest, type CompletionResult, type ProviderAdapter } from './types';

/**
 * Stand-in for an agent whose provider is not connected.
 *
 * It calls nothing. Its text opens with a banner saying so, every run it
 * produces is stored with mode = 'mock', and the UI labels it SIMULATED. A
 * simulated review never passes: it reports "concerns", because no
 * independent check took place.
 */
export const MOCK_BANNER = '[SIMULATED OUTPUT — mock adapter. No AI provider was called.]';

export interface MockFault {
  kind: ProviderError['kind'];
  message?: string;
}

export class MockAdapter implements ProviderAdapter {
  readonly mode = 'mock' as const;
  readonly model = 'mock';
  readonly provider: ProviderId;
  private calls = 0;

  constructor(
    private readonly agentId: AgentId,
    /** Faults to raise on successive calls, for exercising retry paths in tests. */
    private readonly faults: MockFault[] = [],
  ) {
    this.provider = AGENTS[agentId].provider;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const fault = this.faults[this.calls++];
    if (fault) throw new ProviderError(fault.kind, fault.message ?? `Simulated ${fault.kind} failure`);

    const agent = AGENTS[this.agentId];
    if (request.input.includes('REVIEW_PROTOCOL_V1')) {
      return {
        text: JSON.stringify({
          verdict: 'concerns',
          summary: `${MOCK_BANNER} ${agent.name} did not review this work. A simulated review is not an independent check.`,
          findings: [{ severity: 'high', issue: 'Review was simulated', recommendation: `Connect ${agent.providerLabel} and re-run before relying on this result.` }],
        }),
        latencyMs: 0,
      };
    }
    const objective = request.input.split('\n').find((line) => line.trim()) ?? '';
    return {
      text: [
        MOCK_BANNER,
        '',
        `Agent: ${agent.name} (${agent.title}) — provider ${agent.providerLabel} is not connected.`,
        `Received objective: ${objective.slice(0, 300)}`,
        '',
        'This placeholder shows where the agent\'s answer will appear once its provider is configured.',
        'It contains no analysis and must not be used for any business decision.',
      ].join('\n'),
      latencyMs: 0,
    };
  }
}
