import { describe, expect, it } from 'vitest';
import { agentStatus, probeAgent, PROBE_TOKEN } from '@/lib/providers/status';
import { MockAdapter } from '@/lib/providers/mock';
import { ProviderError } from '@/lib/providers/types';
import type { Probe } from '@/lib/store/types';
import { ScriptedAdapter } from './support/fakes';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const probe = (over: Partial<Probe>): Probe => ({ id: 'p', agentId: 'roxy', ok: true, detail: 'ok', model: 'gpt-5.5', latencyMs: 100, probedAt: '2026-10-30T11:00:00Z', ...over });
const KEYED = { OPENAI_API_KEY: 'sk-x', NODE_ENV: 'development' };

describe('connection status is never better than the evidence', () => {
  it('not configured, simulated in development', () => {
    const s = agentStatus('roxy', null, { NODE_ENV: 'development' }, NOW);
    expect(s).toMatchObject({ state: 'not_configured', simulated: true });
    expect(s.detail).toContain('OPENAI_API_KEY');
  });

  it('not configured, refused in production', () => {
    expect(agentStatus('roxy', null, { NODE_ENV: 'production' }, NOW)).toMatchObject({ state: 'not_configured', simulated: false });
  });

  it('a key alone is "unverified", never "verified"', () => {
    expect(agentStatus('roxy', null, KEYED, NOW).state).toBe('unverified');
  });

  it('verified only by a recent successful probe of the configured model', () => {
    expect(agentStatus('roxy', probe({}), KEYED, NOW).state).toBe('verified');
    expect(agentStatus('roxy', probe({ probedAt: '2026-10-28T11:00:00Z' }), KEYED, NOW).state).toBe('unverified');
    expect(agentStatus('roxy', probe({ model: 'gpt-5.4' }), KEYED, NOW).state).toBe('unverified');
  });

  it('a failed probe shows as an error', () => {
    expect(agentStatus('roxy', probe({ ok: false, detail: 'HTTP 401' }), KEYED, NOW)).toMatchObject({ state: 'error', detail: expect.stringContaining('HTTP 401') });
  });

  it('a training-licensed Meta model is blocked', () => {
    expect(agentStatus('zeus', null, { META_MODEL_API_KEY: 'k', META_MODEL: 'muse-spark-1.3-contributor' }, NOW).state).toBe('blocked');
  });
});

describe('connection probe', () => {
  it('records a live success with evidence', async () => {
    const outcome = await probeAgent('roxy', { ok: true, adapter: new ScriptedAdapter('openai', [PROBE_TOKEN]) });
    expect(outcome).toMatchObject({ recorded: true, probe: { ok: true, agentId: 'roxy', model: 'scripted-model' } });
  });

  it('records a failure', async () => {
    const outcome = await probeAgent('roxy', { ok: true, adapter: new ScriptedAdapter('openai', [new ProviderError('auth', 'HTTP 401')]) });
    expect(outcome).toMatchObject({ recorded: true, probe: { ok: false, detail: 'HTTP 401' } });
  });

  it('records nothing for a mock adapter — there is nothing to verify', async () => {
    expect((await probeAgent('roxy', { ok: true, adapter: new MockAdapter('roxy') })).recorded).toBe(false);
  });
});
