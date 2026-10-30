import type { ProviderConfig } from '@/lib/config';
import { requestJson, type FetchLike } from './http';
import { ProviderError, type CompletionRequest, type CompletionResult, type ProviderAdapter } from './types';

/**
 * Google Gemini API, `POST {base}/models/{model}:generateContent`, keyed by
 * the `x-goog-api-key` header (never a query parameter, so the key cannot end
 * up in an access log). Parts flagged `thought: true` are model reasoning,
 * not the answer, and are skipped.
 */
interface GeminiBody {
  responseId?: string;
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: unknown; thought?: boolean }> };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

export function extractGeminiText(body: GeminiBody): string {
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('');
}

export class GeminiAdapter implements ProviderAdapter {
  readonly provider = 'gemini' as const;
  readonly mode = 'live' as const;
  readonly model: string;

  constructor(
    private readonly config: ProviderConfig,
    private readonly fetchImpl?: FetchLike,
  ) {
    this.model = config.model;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const started = Date.now();
    const body = (await requestJson({
      url: `${this.config.baseUrl}/models/${encodeURIComponent(this.config.model)}:generateContent`,
      headers: { 'x-goog-api-key': this.config.apiKey as string },
      body: {
        systemInstruction: { parts: [{ text: request.instructions }] },
        contents: [{ role: 'user', parts: [{ text: request.input }] }],
        ...(request.maxOutputTokens ? { generationConfig: { maxOutputTokens: request.maxOutputTokens } } : {}),
      },
      timeoutMs: this.config.timeoutMs,
      secrets: [this.config.apiKey],
      fetchImpl: this.fetchImpl,
    })) as GeminiBody;

    if (body?.promptFeedback?.blockReason) {
      throw new ProviderError('policy', `Gemini blocked the prompt (${body.promptFeedback.blockReason})`);
    }
    const text = extractGeminiText(body ?? {});
    if (!text.trim()) {
      const reason = body?.candidates?.[0]?.finishReason;
      throw new ProviderError('bad_response', reason ? `No output text (finishReason ${reason})` : 'Response contained no output text');
    }
    const usage = body.usageMetadata;
    return {
      text,
      model: body.modelVersion,
      providerResponseId: body.responseId,
      inputTokens: usage?.promptTokenCount,
      // Thinking tokens are billed as output; count them so cost is not understated.
      outputTokens:
        usage?.candidatesTokenCount !== undefined || usage?.thoughtsTokenCount !== undefined
          ? (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0)
          : undefined,
      latencyMs: Date.now() - started,
    };
  }
}
