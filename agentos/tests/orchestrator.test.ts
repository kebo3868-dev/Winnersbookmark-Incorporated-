import { describe, expect, it } from 'vitest';
import type { AgentId } from '@/lib/agents/registry';
import { runTask, type RunDeps } from '@/lib/orchestrator/runTask';
import { chooseReviewer, parseReview, REVIEW_MARKER } from '@/lib/orchestrator/review';
import type { Resolution } from '@/lib/providers';
import { MockAdapter } from '@/lib/providers/mock';
import { ProviderError, type ProviderAdapter } from '@/lib/providers/types';
import { MemoryStore } from '@/lib/store/memory';
import { ScriptedAdapter } from './support/fakes';

const PASS = JSON.stringify({ verdict: 'pass', summary: 'Sound plan.', findings: [] });

function deps(store: MemoryStore, adapters: Partial<Record<AgentId, ProviderAdapter | ProviderError>>, extra: Partial<RunDeps> = {}): RunDeps {
  const sleeps: number[] = [];
  return {
    store,
    actor: 'owner',
    resolve: (id): Resolution => {
      const a = adapters[id];
      if (!a) return { ok: true, adapter: new MockAdapter(id) };
      return a instanceof ProviderError ? { ok: false, error: a } : { ok: true, adapter: a };
    },
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  };
}

async function newTask(store: MemoryStore, agentId: AgentId = 'roxy', reviewer: AgentId | null = 'gemini') {
  return store.createTask({ title: 'Pizzeria growth plan', objective: 'Draft a 90-day growth plan for an independent pizzeria.', agentId, reviewerAgentId: reviewer, riskLevel: 'medium' }, 'owner');
}

describe('runTask — the founder vertical slice', () => {
  it('processes, independently checks, saves evidence and waits for approval', async () => {
    const store = new MemoryStore();
    const task = await newTask(store);
    const roxy = new ScriptedAdapter('openai', ['A real plan.']);
    const gemini = new ScriptedAdapter('gemini', [PASS]);
    const outcome = await runTask(task.id, deps(store, { roxy, gemini }));

    expect(outcome.ok).toBe(true);
    expect((await store.getTask(task.id))?.status).toBe('awaiting_approval');
    const runs = await store.listRuns(task.id);
    expect(runs.map((r) => [r.role, r.agentId, r.status, r.mode])).toEqual([
      ['primary', 'roxy', 'succeeded', 'live'],
      ['reviewer', 'gemini', 'succeeded', 'live'],
    ]);
    expect(runs[0]).toMatchObject({ output: 'A real plan.', providerResponseId: 'resp_1', model: 'scripted-model-2026', inputTokens: 10 });
    expect(runs[1]).toMatchObject({ verdict: 'pass', findings: { summary: 'Sound plan.', items: [] } });
    // The reviewer sees the objective and the output, marked as data.
    expect(gemini.requests[0].input).toContain(REVIEW_MARKER);
    expect(gemini.requests[0].input).toContain('A real plan.');
    const [approval] = await store.listApprovals({ status: 'pending' });
    expect(approval).toMatchObject({ taskId: task.id, actionType: 'accept_result' });
    expect(approval.summary).not.toContain('SIMULATED');
  });

  it('labels simulated work everywhere and a simulated review never passes', async () => {
    const store = new MemoryStore();
    const task = await newTask(store);
    const outcome = await runTask(task.id, deps(store, {}));
    expect(outcome.ok).toBe(true);
    const runs = await store.listRuns(task.id);
    expect(runs.every((r) => r.mode === 'mock' && r.provider === 'mock')).toBe(true);
    expect(runs[1].verdict).toBe('concerns');
    const [approval] = await store.listApprovals({ taskId: task.id });
    expect(approval.summary.startsWith('SIMULATED RESULT AND REVIEW')).toBe(true);
  });

  it('retries a transient failure with backoff and records every attempt', async () => {
    const store = new MemoryStore();
    const task = await newTask(store, 'roxy', null);
    const sleeps: number[] = [];
    const roxy = new ScriptedAdapter('openai', [new ProviderError('server', 'HTTP 503', 503), 'Recovered answer']);
    const outcome = await runTask(task.id, { ...deps(store, { roxy }), sleep: async (ms) => void sleeps.push(ms) });
    expect(outcome.ok).toBe(true);
    const runs = await store.listRuns(task.id);
    expect(runs.map((r) => [r.attempt, r.status])).toEqual([[1, 'failed'], [2, 'succeeded']]);
    expect(runs[0].error).toContain('HTTP 503');
    expect(sleeps).toEqual([1000]);
  });

  it('does not retry an authentication failure and marks the task failed', async () => {
    const store = new MemoryStore();
    const task = await newTask(store, 'roxy', null);
    const roxy = new ScriptedAdapter('openai', [new ProviderError('auth', 'HTTP 401', 401), 'never reached']);
    const outcome = await runTask(task.id, deps(store, { roxy }));
    expect(outcome).toMatchObject({ ok: false, reason: 'failed' });
    expect(await store.listRuns(task.id)).toHaveLength(1);
    expect((await store.getTask(task.id))?.status).toBe('failed');
    expect((await store.getTask(task.id))?.lastError).toContain('HTTP 401');
    expect(await store.listApprovals({ taskId: task.id })).toHaveLength(0);
  });

  it('stops retrying when the time budget would be exceeded', async () => {
    const store = new MemoryStore();
    const task = await newTask(store, 'roxy', null);
    const roxy = new ScriptedAdapter('openai', [new ProviderError('timeout', 'slow'), 'never reached']);
    const outcome = await runTask(task.id, { ...deps(store, { roxy }), budgetMs: 10_000 });
    expect(outcome.ok).toBe(false);
    expect(await store.listRuns(task.id)).toHaveLength(1);
  });

  it('fails the task when a required independent review cannot run', async () => {
    const store = new MemoryStore();
    const task = await newTask(store);
    const roxy = new ScriptedAdapter('openai', ['answer']);
    const outcome = await runTask(task.id, deps(store, { roxy, gemini: new ProviderError('not_configured', 'Gemini is not connected') }));
    expect(outcome).toMatchObject({ ok: false, reason: 'failed', error: expect.stringContaining('Independent review did not complete') });
    expect((await store.getTask(task.id))?.status).toBe('failed');
  });

  it('can retry a failed task, but never run one twice concurrently', async () => {
    const store = new MemoryStore();
    const task = await newTask(store, 'roxy', null);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: ProviderAdapter = { provider: 'openai', mode: 'live', model: 'm', complete: async () => (await gate, { text: 'done', latencyMs: 1 }) };
    const first = runTask(task.id, deps(store, { roxy: slow }));
    await new Promise((r) => setTimeout(r, 0));
    expect(await runTask(task.id, deps(store, { roxy: slow }))).toEqual({ ok: false, reason: 'not_runnable' });
    release();
    expect((await first).ok).toBe(true);
    expect(await runTask(task.id, deps(store, { roxy: slow }))).toEqual({ ok: false, reason: 'not_runnable' });
  });

  it('reclaims a task whose executor died mid-run', async () => {
    let now = Date.parse('2026-10-30T12:00:00Z');
    const store = new MemoryStore(() => new Date(now));
    const task = await newTask(store, 'roxy', null);
    await store.claimTask(task.id, 'owner'); // executor killed: never finishes
    expect(await store.claimTask(task.id, 'owner')).toBeNull();
    now += 11 * 60_000;
    expect((await store.claimTask(task.id, 'owner'))?.status).toBe('running');
    const audit = await store.listAudit({ entityId: task.id });
    expect(audit[0].details).toEqual({ reclaimedStale: true });
  });

  it('answers not_found for an unknown task', async () => {
    expect(await runTask('00000000-0000-0000-0000-000000000000', deps(new MemoryStore(), {}))).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('review parsing', () => {
  it('accepts a fenced JSON verdict', () => {
    expect(parseReview('```json\n{"verdict":"fail","summary":"Wrong numbers","findings":[{"severity":"high","issue":"Revenue math"}]}\n```')).toMatchObject({ verdict: 'fail', findings: [{ severity: 'high' }] });
  });

  it('downgrades a "pass" that lists a high-severity finding', () => {
    expect(parseReview(JSON.stringify({ verdict: 'pass', summary: 'ok', findings: [{ severity: 'high', issue: 'x' }] })).verdict).toBe('concerns');
  });

  it('never turns prose or malformed JSON into a pass', () => {
    expect(parseReview('Looks great to me!').verdict).toBe('unparseable');
    expect(parseReview('{"verdict":"approved","summary":"x","findings":[]}').verdict).toBe('unparseable');
  });
});

describe('reviewer selection', () => {
  it.each([
    ['roxy', 'low', 'auto', null],
    ['roxy', 'low', 'zeus', 'zeus'],
    ['roxy', 'medium', 'auto', 'gemini'],
    ['roxy', 'medium', 'none', null],
    ['roxy', 'high', 'none', 'gemini'],
    ['gemini', 'high', 'auto', 'roxy'],
    ['zeus', 'high', 'zeus', 'gemini'],
  ] as const)('%s at %s risk with %s → %s', (agent, risk, requested, expected) => {
    expect(chooseReviewer(agent, risk, requested)).toBe(expected);
  });
});
