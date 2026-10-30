import { describe, expect, it } from 'vitest';
import { providerConfig } from '@/lib/config';
import { GeminiAdapter } from '@/lib/providers/gemini';
import { redact } from '@/lib/providers/http';
import { resolveAdapter } from '@/lib/providers';
import { MockAdapter, MOCK_BANNER } from '@/lib/providers/mock';
import { extractResponsesText, hermesAdapter, hermesApiBase, metaAdapter, openAiAdapter } from '@/lib/providers/responses';
import { ProviderError } from '@/lib/providers/types';
import { fakeFetch } from './support/fakes';

const req = { instructions: 'be useful', input: 'Plan a menu audit', maxOutputTokens: 500 };

describe('Responses protocol (OpenAI, Meta Muse, Hermes)', () => {
  it('sends the documented request shape to OpenAI with a bearer key and store:false', async () => {
    const { impl, calls } = fakeFetch([{ body: { id: 'resp_1', model: 'gpt-5.5-2026-04-23', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hello' }] }], usage: { input_tokens: 7, output_tokens: 3 } } }]);
    const adapter = openAiAdapter(providerConfig('openai', { OPENAI_API_KEY: 'sk-test-abcdefghijkl' }), impl);
    const result = await adapter.complete(req);
    expect(calls[0].url).toBe('https://api.openai.com/v1/responses');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk-test-abcdefghijkl');
    expect(calls[0].body).toEqual({ model: 'gpt-5.5', instructions: 'be useful', input: 'Plan a menu audit', max_output_tokens: 500, store: false });
    expect(result).toMatchObject({ text: 'Hello', model: 'gpt-5.5-2026-04-23', providerResponseId: 'resp_1', inputTokens: 7, outputTokens: 3 });
  });

  it('reads only final message text: skips reasoning, replayed tool calls and commentary', () => {
    const text = extractResponsesText({
      output: [
        { type: 'reasoning', content: [{ type: 'output_text', text: 'SECRET THOUGHTS' }] },
        { type: 'function_call' },
        { type: 'function_call_output' },
        { type: 'message', phase: 'commentary', content: [{ type: 'output_text', text: 'Searching…' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'Part 1. ' }, { type: 'output_text', text: 'Part 2.' }] },
      ],
    });
    expect(text).toBe('Part 1. Part 2.');
  });

  it('targets the Meta Model API and refuses training-licensed contributor models', async () => {
    const { impl, calls } = fakeFetch([{ body: { output_text: 'Muse says hi' } }]);
    const adapter = metaAdapter(providerConfig('meta', { META_MODEL_API_KEY: 'meta-key-123456' }), impl);
    await adapter.complete(req);
    expect(calls[0].url).toBe('https://api.meta.ai/v1/responses');
    expect(calls[0].body?.model).toBe('muse-spark-1.3');
    expect(() => metaAdapter(providerConfig('meta', { META_MODEL_API_KEY: 'k', META_MODEL: 'muse-spark-1.3-contributor' }))).toThrow(/train on your data/);
  });

  it('targets the Hermes API server under /v1 whether or not the base URL includes it', async () => {
    expect(hermesApiBase('http://10.0.0.5:8642')).toBe('http://10.0.0.5:8642/v1');
    expect(hermesApiBase('http://10.0.0.5:8642/v1/')).toBe('http://10.0.0.5:8642/v1');
    const { impl, calls } = fakeFetch([{ body: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'researched' }] }] } }]);
    const adapter = hermesAdapter(providerConfig('hermes', { HERMES_BASE_URL: 'https://hermes.internal:8642', HERMES_API_KEY: 'hermes-key-0123456789' }), impl);
    await adapter.complete(req);
    expect(calls[0].url).toBe('https://hermes.internal:8642/v1/responses');
    expect(calls[0].body?.model).toBe('hermes-agent');
  });

  it('treats an empty or failed response as an error, never as an empty answer', async () => {
    const empty = openAiAdapter(providerConfig('openai', { OPENAI_API_KEY: 'k' }), fakeFetch([{ body: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] } }]).impl);
    await expect(empty.complete(req)).rejects.toMatchObject({ kind: 'bad_response', message: expect.stringContaining('max_output_tokens') });
    const failed = openAiAdapter(providerConfig('openai', { OPENAI_API_KEY: 'k' }), fakeFetch([{ body: { status: 'failed', error: { message: 'overloaded' } } }]).impl);
    await expect(failed.complete(req)).rejects.toMatchObject({ kind: 'server', retryable: true });
  });
});

describe('HTTP error mapping', () => {
  const config = providerConfig('openai', { OPENAI_API_KEY: 'sk-live-SECRETSECRETSECRET' });

  it.each([
    [401, 'auth', false],
    [403, 'auth', false],
    [400, 'bad_request', false],
    [404, 'bad_request', false],
    [429, 'rate_limit', true],
    [500, 'server', true],
    [503, 'server', true],
  ])('HTTP %i → %s (retryable %s)', async (status, kind, retryable) => {
    const adapter = openAiAdapter(config, fakeFetch([{ status, body: { error: { message: 'nope' } } }]).impl);
    await expect(adapter.complete(req)).rejects.toMatchObject({ kind, retryable, status });
  });

  it('honours Retry-After', async () => {
    const adapter = openAiAdapter(config, fakeFetch([{ status: 429, headers: { 'retry-after': '3' }, body: {} }]).impl);
    await expect(adapter.complete(req)).rejects.toMatchObject({ retryAfterMs: 3000 });
  });

  it('maps timeouts and network failures to retryable errors', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    await expect(openAiAdapter(config, fakeFetch([timeout]).impl).complete(req)).rejects.toMatchObject({ kind: 'timeout', retryable: true });
    await expect(openAiAdapter(config, fakeFetch([new Error('ECONNREFUSED')]).impl).complete(req)).rejects.toMatchObject({ kind: 'network', retryable: true });
  });

  it('never puts the API key into a stored error message', async () => {
    const adapter = openAiAdapter(config, fakeFetch([{ status: 401, body: 'Incorrect API key provided: sk-live-SECRETSECRETSECRET' }]).impl);
    const error = (await adapter.complete(req).catch((e) => e)) as ProviderError;
    expect(error.message).not.toContain('SECRETSECRET');
    expect(error.message).toContain('[redacted]');
    expect(redact('key AIzaSyA1234567890abcdefghijklmno here', [])).toBe('key [redacted] here');
  });
});

describe('Gemini generateContent', () => {
  const config = providerConfig('gemini', { GEMINI_API_KEY: 'AIzaTESTKEY000000000000000' });

  it('sends the key in a header, never in the URL, and skips thought parts', async () => {
    const { impl, calls } = fakeFetch([
      {
        body: {
          responseId: 'g-1',
          modelVersion: 'gemini-flash-latest',
          candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'Verified answer' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 4, thoughtsTokenCount: 6 },
        },
      },
    ]);
    const result = await new GeminiAdapter(config, impl).complete(req);
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(calls[0].url).not.toContain('key=');
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaTESTKEY000000000000000');
    expect(calls[0].body).toMatchObject({ systemInstruction: { parts: [{ text: 'be useful' }] }, contents: [{ role: 'user', parts: [{ text: 'Plan a menu audit' }] }] });
    expect(result).toMatchObject({ text: 'Verified answer', inputTokens: 11, outputTokens: 10, providerResponseId: 'g-1' });
  });

  it('reports a blocked prompt as a policy error', async () => {
    const adapter = new GeminiAdapter(config, fakeFetch([{ body: { promptFeedback: { blockReason: 'SAFETY' } } }]).impl);
    await expect(adapter.complete(req)).rejects.toMatchObject({ kind: 'policy', retryable: false });
  });
});

describe('adapter resolution', () => {
  it('uses the labelled mock adapter for an unconfigured agent in development', async () => {
    const resolution = resolveAdapter('zeus', { NODE_ENV: 'development' });
    expect(resolution.ok && resolution.adapter.mode).toBe('mock');
    const text = (await new MockAdapter('zeus').complete(req)).text;
    expect(text.startsWith(MOCK_BANNER)).toBe(true);
  });

  it('refuses instead of simulating in production unless explicitly allowed', () => {
    const refused = resolveAdapter('roxy', { NODE_ENV: 'production' });
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.kind).toBe('not_configured');
    const optedIn = resolveAdapter('roxy', { NODE_ENV: 'production', AGENTOS_ALLOW_MOCK: 'true' });
    expect(optedIn.ok && optedIn.adapter.mode).toBe('mock');
  });

  it('uses the live adapter once credentials exist, and a policy refusal beats the mock', () => {
    const live = resolveAdapter('gemini', { NODE_ENV: 'development', GEMINI_API_KEY: 'k' });
    expect(live.ok && live.adapter.mode).toBe('live');
    const blocked = resolveAdapter('zeus', { NODE_ENV: 'development', META_MODEL_API_KEY: 'k', META_MODEL: 'muse-spark-1.2-contributor' });
    expect(!blocked.ok && blocked.error.kind).toBe('policy');
  });

  it('requires both URL and key for Hermes', () => {
    expect(providerConfig('hermes', { HERMES_API_KEY: 'k' }).missing).toEqual(['HERMES_BASE_URL']);
    expect(providerConfig('hermes', { HERMES_BASE_URL: 'http://h:8642' }).missing).toEqual(['HERMES_API_KEY']);
  });
});
