import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runTask } from '@/lib/orchestrator/runTask';
import { MockAdapter } from '@/lib/providers/mock';
import { PgStore } from '@/lib/store/pg';

/**
 * Integration test against a real Postgres. Runs only when
 * AGENTOS_TEST_DATABASE_URL names a DISPOSABLE database: it drops and
 * recreates the public schema. CI provides one; locally it skips.
 */
const url = process.env.AGENTOS_TEST_DATABASE_URL;
const migration = readFileSync(path.resolve(__dirname, '../supabase/migrations/20261030000000_agentos_core.sql'), 'utf8');

describe.skipIf(!url)('PgStore against Postgres', () => {
  let pool: Pool;
  let store: PgStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    await pool.query('drop schema if exists public cascade; create schema public;');
    await pool.query(migration);
    store = new PgStore(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('runs the full vertical slice and persists evidence', async () => {
    const task = await store.createTask({ title: 'Menu pricing review', objective: 'Review menu pricing for a 40-seat bistro.', agentId: 'roxy', reviewerAgentId: 'gemini', riskLevel: 'medium' }, 'owner');
    const outcome = await runTask(task.id, { store, actor: 'owner', resolve: (id) => ({ ok: true, adapter: new MockAdapter(id) }), sleep: async () => undefined });
    expect(outcome.ok).toBe(true);
    const runs = await store.listRuns(task.id);
    expect(runs.map((r) => r.role)).toEqual(['primary', 'reviewer']);
    expect(runs[1].findings?.summary).toContain('SIMULATED');
    const [approval] = await store.listApprovals({ taskId: task.id, status: 'pending' });
    const decided = await store.decideApproval(approval.id, 'approved', 'owner', 'ok');
    expect(decided?.decidedAt).toBeTruthy();
    expect((await store.getTask(task.id))?.status).toBe('approved');
    expect(await store.decideApproval(approval.id, 'rejected', 'owner', null)).toBeNull();
    const actions = (await store.listAudit({ entityId: task.id })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['task.created', 'task.claimed', 'task.ready_for_approval', 'approval.approved']));
  });

  it('lets exactly one of many concurrent claims win', async () => {
    const task = await store.createTask({ title: 'Race', objective: 'Concurrency check objective.', agentId: 'zeus', reviewerAgentId: null, riskLevel: 'low' }, 'owner');
    const claims = await Promise.all(Array.from({ length: 8 }, () => store.claimTask(task.id, 'owner')));
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('reclaims a stale running task and records that it did', async () => {
    const task = await store.createTask({ title: 'Stale', objective: 'Stale executor objective.', agentId: 'zeus', reviewerAgentId: null, riskLevel: 'low' }, 'owner');
    await store.claimTask(task.id, 'owner');
    expect(await store.claimTask(task.id, 'owner')).toBeNull();
    await pool.query(`update tasks set updated_at = now() - interval '11 minutes' where id = $1`, [task.id]);
    expect((await store.claimTask(task.id, 'owner'))?.status).toBe('running');
    expect((await store.listAudit({ entityId: task.id }))[0].details).toEqual({ reclaimedStale: true });
  });

  it('keeps evidence and the audit log immutable', async () => {
    await expect(pool.query(`update task_runs set mode = 'live'`)).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from audit_log')).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from tasks')).rejects.toThrow(/foreign key/);
  });

  it('enforces independence and attribution in the schema itself', async () => {
    await expect(pool.query(`insert into tasks (title, objective, agent_id, reviewer_agent_id) values ('Self', 'grading my own work', 'roxy', 'roxy')`)).rejects.toThrow(/reviewer_is_independent/);
    const task = await store.createTask({ title: 'Attrib', objective: 'Attribution objective.', agentId: 'roxy', reviewerAgentId: null, riskLevel: 'low' }, 'owner');
    await expect(pool.query(`insert into approvals (task_id, action_type, summary, status) values ($1, 'spend_money', 'x', 'approved')`, [task.id])).rejects.toThrow(/decision_is_attributed/);
  });

  it('counts rate-limit hits across calls', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await store.hitRateLimit('test:key', 3600, 3));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  });

  it('returns the most recent probe per agent', async () => {
    await store.addProbe({ agentId: 'gemini', ok: false, detail: 'first', model: 'm', latencyMs: null });
    await new Promise((r) => setTimeout(r, 5));
    await store.addProbe({ agentId: 'gemini', ok: true, detail: 'second', model: 'm', latencyMs: 9 });
    expect((await store.latestProbes()).gemini?.detail).toBe('second');
  });
});
