import type { ProviderId } from '@/lib/agents/registry';
import type { ProviderConfig } from '@/lib/config';
import { requestJson, type FetchLike } from './http';
import { ProviderError, type CompletionRequest, type CompletionResult, type ProviderAdapter } from './types';

/**
 * Client for the Responses wire protocol, `POST {base}/responses`.
 *
 * Three AgentOS agents speak it, each documented by its vendor:
 * - OpenAI Responses API          https://api.openai.com/v1
 * - Meta Model API (Muse Spark)   https://api.meta.ai/v1      (OpenAI-compatible)
 * - Hermes Agent API server       http://<your-host>:8642/v1  (OpenAI-compatible)
 *
 * The request uses only fields all three document: model, instructions,
 * input, max_output_tokens. The reply text is read from `message` output
 * items' `output_text` parts, which is where the REST response carries it
 * (the SDKs' `output_text` field is a client-side convenience, honoured if a
 * server sends it). Hermes also replays already-executed tool calls in
 * `output`, and may emit `phase: "commentary"` progress messages; neither is
 * part of the answer.
 */
interface ResponsesBody {
  id?: string;
  model?: string;
  status?: string;
  output_text?: unknown;
  output?: Array<{
    type?: string;
    phase?: string;
    content?: Array<{ type?: string; text?: unknown }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
}

export function extractResponsesText(body: ResponsesBody): string {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text;
  const parts: string[] = [];
  for (const item of body.output ?? []) {
    if (item?.type !== 'message' || item.phase === 'commentary') continue;
    for (const part of item.content ?? []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') parts.push(part.text);
    }
  }
  return parts.join('');
}

export interface ResponsesAdapterOptions {
  provider: ProviderId;
  /** Base URL that `/responses` is appended to. */
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** Extra body fields one vendor documents, e.g. OpenAI's `store: false`. */
  extraBody?: Record<string, unknown>;
  fetchImpl?: FetchLike;
}

export class ResponsesAdapter implements ProviderAdapter {
  readonly mode = 'live' as const;
  readonly provider: ProviderId;
  readonly model: string;

  constructor(private readonly options: ResponsesAdapterOptions) {
    this.provider = options.provider;
    this.model = options.model;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const started = Date.now();
    const body = (await requestJson({
      url: `${this.options.baseUrl}/responses`,
      headers: { authorization: `Bearer ${this.options.apiKey}` },
      body: {
        model: this.options.model,
        instructions: request.instructions,
        input: request.input,
        ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
        ...this.options.extraBody,
      },
      timeoutMs: this.options.timeoutMs,
      secrets: [this.options.apiKey],
      fetchImpl: this.options.fetchImpl,
    })) as ResponsesBody;

    if (body?.status === 'failed') {
      throw new ProviderError('server', `Response failed: ${body.error?.message ?? 'no reason given'}`);
    }
    const text = extractResponsesText(body ?? {});
    if (!text.trim()) {
      const reason = body?.incomplete_details?.reason;
      throw new ProviderError('bad_response', reason ? `Response incomplete (${reason}) with no text` : 'Response contained no output text');
    }
    return {
      text,
      model: typeof body.model === 'string' ? body.model : undefined,
      providerResponseId: typeof body.id === 'string' ? body.id : undefined,
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
      latencyMs: Date.now() - started,
    };
  }
}

export function openAiAdapter(config: ProviderConfig, fetchImpl?: FetchLike): ResponsesAdapter {
  return new ResponsesAdapter({
    provider: 'openai',
    baseUrl: config.baseUrl,
    apiKey: config.apiKey as string,
    model: config.model,
    timeoutMs: config.timeoutMs,
    // Business data is not retained server-side for later retrieval.
    extraBody: { store: false },
    fetchImpl,
  });
}

/**
 * Meta publishes "-contributor" model IDs at a discount in exchange for the
 * right to train on prompts and completions. AgentOS carries client business
 * data, so those IDs are refused outright rather than left to configuration.
 */
export function isTrainingLicensedMetaModel(model: string): boolean {
  return /-contributor$/i.test(model.trim());
}

export function metaAdapter(config: ProviderConfig, fetchImpl?: FetchLike): ResponsesAdapter {
  if (isTrainingLicensedMetaModel(config.model)) {
    throw new ProviderError('policy', `META_MODEL "${config.model}" licenses Meta to train on your data and is blocked. Use a non-contributor model ID.`);
  }
  return new ResponsesAdapter({
    provider: 'meta',
    baseUrl: config.baseUrl,
    apiKey: config.apiKey as string,
    model: config.model,
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
}

/** HERMES_BASE_URL is the server root; accept it with or without `/v1`. */
export function hermesApiBase(root: string): string {
  return `${root.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`;
}

export function hermesAdapter(config: ProviderConfig, fetchImpl?: FetchLike): ResponsesAdapter {
  return new ResponsesAdapter({
    provider: 'hermes',
    baseUrl: hermesApiBase(config.baseUrl),
    apiKey: config.apiKey as string,
    model: config.model,
    timeoutMs: config.timeoutMs,
    // Each AgentOS task is self-contained; AgentOS keeps the record.
    extraBody: { store: false },
    fetchImpl,
  });
}
