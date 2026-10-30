import type { ProviderId } from '@/lib/agents/registry';

export interface CompletionRequest {
  /** Standing instructions (system prompt). */
  instructions: string;
  /** The task input. */
  input: string;
  maxOutputTokens?: number;
}

export interface CompletionResult {
  text: string;
  /** The model the provider says served the request, when it reports one. */
  model?: string;
  providerResponseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export type ProviderErrorKind =
  | 'not_configured'
  | 'policy'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'server'
  | 'bad_request'
  | 'bad_response';

const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set(['rate_limit', 'timeout', 'network', 'server']);

export class ProviderError extends Error {
  readonly retryable: boolean;
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
    /** Server-requested wait before retrying, in milliseconds. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = RETRYABLE.has(kind);
  }
}

export interface ProviderAdapter {
  readonly provider: ProviderId;
  /** 'mock' adapters never call a provider; their output is labelled simulated everywhere. */
  readonly mode: 'live' | 'mock';
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
