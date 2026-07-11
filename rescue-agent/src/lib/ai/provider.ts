import { z } from 'zod';

export interface StructuredAnalysisRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  analyzeStructured<T>(request: StructuredAnalysisRequest<T>): Promise<T>;
}

const MAX_SCHEMA_RETRIES = 2;

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  async analyzeStructured<T>(request: StructuredAnalysisRequest<T>): Promise<T> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.AI_MODEL || 'claude-sonnet-5';

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_SCHEMA_RETRIES; attempt++) {
      const message = await client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 2000,
        system: `${request.systemPrompt}\n\nRespond with a single JSON object only. No markdown fences, no prose.`,
        messages: [{ role: 'user', content: request.userPrompt }],
      });
      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
      try {
        const cleaned = text.trim().replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '');
        const parsed = JSON.parse(cleaned);
        const validated = request.schema.safeParse(parsed);
        if (validated.success) return validated.data;
        lastError = validated.error;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`AI structured output failed schema validation after ${MAX_SCHEMA_RETRIES + 1} attempts: ${String(lastError).slice(0, 300)}`);
  }
}

/** Returns the configured provider, or null when AI is not configured. Never fakes output. */
export function getAiProvider(): AiProvider | null {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return new AnthropicProvider();
  // Additional adapters (OpenAI, Google) plug in here without touching audit logic.
  return null;
}

export function isAiConfigured(): boolean {
  return getAiProvider() !== null;
}
