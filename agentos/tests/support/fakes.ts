import type { FetchLike } from '@/lib/providers/http';
import { ProviderError, type CompletionRequest, type CompletionResult, type ProviderAdapter } from '@/lib/providers/types';
import type { ProviderId } from '@/lib/agents/registry';

export interface RecordedCall {
  url: string;
  init: RequestInit;
  body: Record<string, unknown> | undefined;
}

/** A fetch that replays queued responses and records every request. */
export function fakeFetch(responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> } | Error>) {
  const calls: RecordedCall[] = [];
  const impl: FetchLike = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift();
    if (!next) throw new Error('fakeFetch: no response queued');
    if (next instanceof Error) throw next;
    const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {});
    return new Response(text, { status: next.status ?? 200, headers: next.headers });
  };
  return { impl, calls };
}

/** A scripted live adapter for orchestration tests. */
export class ScriptedAdapter implements ProviderAdapter {
  readonly mode = 'live' as const;
  readonly model = 'scripted-model';
  readonly requests: CompletionRequest[] = [];

  constructor(
    readonly provider: ProviderId,
    private readonly script: Array<string | ProviderError>,
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(request);
    const step = this.script.shift();
    if (step === undefined) throw new Error('ScriptedAdapter: script exhausted');
    if (step instanceof ProviderError) throw step;
    return { text: step, model: 'scripted-model-2026', providerResponseId: `resp_${this.requests.length}`, inputTokens: 10, outputTokens: 20, latencyMs: 5 };
  }
}
