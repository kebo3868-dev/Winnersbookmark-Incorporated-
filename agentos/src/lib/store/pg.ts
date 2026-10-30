import type { Pool, PoolClient } from 'pg';
import type { AgentId } from '@/lib/agents/registry';
import { STALE_RUNNING_MINUTES } from './types';
import type { Approval, AuditEntry, NewAuditEntry, NewRun, NewTask, Probe, Run, Store, Task } from './types';

/**
 * Postgres store (Supabase in production). Every statement is parameterised.
 * Multi-row changes that must agree — a decision, its audit entry and the
 * task's status — run in one transaction.
 */
type Row = Record<string, unknown>;

const iso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value));
const isoOrNull = (value: unknown): string | null => (value == null ? null : iso(value));

function toTask(r: Row): Task {
  return {
    id: r.id as string,
    title: r.title as string,
    objective: r.objective as string,
    agentId: r.agent_id as AgentId,
    reviewerAgentId: (r.reviewer_agent_id as AgentId | null) ?? null,
    riskLevel: r.risk_level as Task['riskLevel'],
    status: r.status as Task['status'],
    lastError: (r.last_error as string | null) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function toRun(r: Row): Run {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    agentId: r.agent_id as AgentId,
    role: r.role as Run['role'],
    mode: r.mode as Run['mode'],
    attempt: r.attempt as number,
    status: r.status as Run['status'],
    provider: r.provider as string,
    model: (r.model as string | null) ?? null,
    output: (r.output as string | null) ?? null,
    verdict: (r.verdict as Run['verdict']) ?? null,
    findings: (r.findings as Run['findings']) ?? null,
    error: (r.error as string | null) ?? null,
    inputTokens: (r.input_tokens as number | null) ?? null,
    outputTokens: (r.output_tokens as number | null) ?? null,
    latencyMs: (r.latency_ms as number | null) ?? null,
    providerResponseId: (r.provider_response_id as string | null) ?? null,
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
  };
}

function toApproval(r: Row): Approval {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    actionType: r.action_type as Approval['actionType'],
    summary: r.summary as string,
    status: r.status as Approval['status'],
    decidedBy: (r.decided_by as string | null) ?? null,
    decidedAt: isoOrNull(r.decided_at),
    note: (r.note as string | null) ?? null,
    createdAt: iso(r.created_at),
  };
}

function toProbe(r: Row): Probe {
  return {
    id: r.id as string,
    agentId: r.agent_id as AgentId,
    ok: r.ok as boolean,
    detail: r.detail as string,
    model: (r.model as string | null) ?? null,
    latencyMs: (r.latency_ms as number | null) ?? null,
    probedAt: iso(r.probed_at),
  };
}

const AUDIT_SQL = 'insert into audit_log (actor, action, entity, entity_id, details) values ($1, $2, $3, $4, $5)';
const auditParams = (e: NewAuditEntry) => [e.actor, e.action, e.entity, e.entityId, JSON.stringify(e.details ?? {})];

export class PgStore implements Store {
  readonly kind = 'postgres' as const;

  constructor(private readonly pool: Pool) {}

  private async tx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createTask(input: NewTask, actor: string): Promise<Task> {
    return this.tx(async (c) => {
      const { rows } = await c.query(
        `insert into tasks (title, objective, agent_id, reviewer_agent_id, risk_level)
         values ($1, $2, $3, $4, $5) returning *`,
        [input.title, input.objective, input.agentId, input.reviewerAgentId, input.riskLevel],
      );
      const task = toTask(rows[0]);
      await c.query(AUDIT_SQL, auditParams({ actor, action: 'task.created', entity: 'task', entityId: task.id, details: { agentId: task.agentId, reviewerAgentId: task.reviewerAgentId, riskLevel: task.riskLevel } }));
      return task;
    });
  }

  async getTask(id: string): Promise<Task | null> {
    const { rows } = await this.pool.query('select * from tasks where id = $1', [id]);
    return rows[0] ? toTask(rows[0]) : null;
  }

  async listTasks(limit = 50): Promise<Task[]> {
    const { rows } = await this.pool.query('select * from tasks order by created_at desc limit $1', [limit]);
    return rows.map(toTask);
  }

  async claimTask(id: string, actor: string): Promise<Task | null> {
    return this.tx(async (c) => {
      const { rows } = await c.query(
        `update tasks set status = 'running', last_error = null, updated_at = now()
         where id = $1 and (status in ('queued', 'failed')
                            or (status = 'running' and updated_at < now() - make_interval(mins => $2)))
         returning *, (select status from tasks where id = $1) as previous_status`,
        [id, STALE_RUNNING_MINUTES],
      );
      if (!rows[0]) return null;
      await c.query(AUDIT_SQL, auditParams({ actor, action: 'task.claimed', entity: 'task', entityId: id, details: { reclaimedStale: rows[0].previous_status === 'running' } }));
      return toTask(rows[0]);
    });
  }

  async finishTask(id: string, status: 'awaiting_approval' | 'failed', lastError: string | null): Promise<Task | null> {
    const { rows } = await this.pool.query(
      `update tasks set status = $2, last_error = $3, updated_at = now()
       where id = $1 and status = 'running' returning *`,
      [id, status, lastError],
    );
    return rows[0] ? toTask(rows[0]) : null;
  }

  async addRun(run: NewRun): Promise<Run> {
    const { rows } = await this.pool.query(
      `insert into task_runs (task_id, agent_id, role, mode, attempt, status, provider, model, output, verdict, findings,
         error, input_tokens, output_tokens, latency_ms, provider_response_id, started_at, finished_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *`,
      [
        run.taskId, run.agentId, run.role, run.mode, run.attempt, run.status, run.provider, run.model, run.output, run.verdict,
        run.findings ? JSON.stringify(run.findings) : null, run.error, run.inputTokens, run.outputTokens, run.latencyMs,
        run.providerResponseId, run.startedAt, run.finishedAt,
      ],
    );
    return toRun(rows[0]);
  }

  async listRuns(taskId: string): Promise<Run[]> {
    const { rows } = await this.pool.query('select * from task_runs where task_id = $1 order by started_at, attempt', [taskId]);
    return rows.map(toRun);
  }

  async listRecentRuns(limit = 20): Promise<Run[]> {
    const { rows } = await this.pool.query('select * from task_runs order by finished_at desc limit $1', [limit]);
    return rows.map(toRun);
  }

  async createApproval(input: { taskId: string; actionType: Approval['actionType']; summary: string }): Promise<Approval> {
    // The partial unique index allows one pending row per task and action;
    // a repeat request returns the open one instead of failing.
    const { rows } = await this.pool.query(
      `insert into approvals (task_id, action_type, summary) values ($1, $2, $3)
       on conflict (task_id, action_type) where status = 'pending' do nothing returning *`,
      [input.taskId, input.actionType, input.summary],
    );
    if (rows[0]) return toApproval(rows[0]);
    const existing = await this.pool.query(
      `select * from approvals where task_id = $1 and action_type = $2 and status = 'pending'`,
      [input.taskId, input.actionType],
    );
    return toApproval(existing.rows[0]);
  }

  async getApproval(id: string): Promise<Approval | null> {
    const { rows } = await this.pool.query('select * from approvals where id = $1', [id]);
    return rows[0] ? toApproval(rows[0]) : null;
  }

  async listApprovals(filter: { status?: Approval['status']; taskId?: string } = {}): Promise<Approval[]> {
    const { rows } = await this.pool.query(
      `select * from approvals where ($1::text is null or status = $1) and ($2::uuid is null or task_id = $2)
       order by created_at desc limit 200`,
      [filter.status ?? null, filter.taskId ?? null],
    );
    return rows.map(toApproval);
  }

  async decideApproval(id: string, decision: 'approved' | 'rejected', actor: string, note: string | null): Promise<Approval | null> {
    return this.tx(async (c) => {
      const { rows } = await c.query(
        `update approvals set status = $2, decided_by = $3, decided_at = now(), note = $4
         where id = $1 and status = 'pending' returning *`,
        [id, decision, actor, note],
      );
      if (!rows[0]) return null;
      const approval = toApproval(rows[0]);
      if (approval.actionType === 'accept_result') {
        await c.query(`update tasks set status = $2, updated_at = now() where id = $1 and status = 'awaiting_approval'`, [approval.taskId, decision]);
      }
      await c.query(AUDIT_SQL, auditParams({ actor, action: `approval.${decision}`, entity: 'approval', entityId: id, details: { taskId: approval.taskId, actionType: approval.actionType, note } }));
      return approval;
    });
  }

  async addProbe(probe: Omit<Probe, 'id' | 'probedAt'>): Promise<Probe> {
    const { rows } = await this.pool.query(
      'insert into agent_probes (agent_id, ok, detail, model, latency_ms) values ($1, $2, $3, $4, $5) returning *',
      [probe.agentId, probe.ok, probe.detail, probe.model, probe.latencyMs],
    );
    return toProbe(rows[0]);
  }

  async latestProbes(): Promise<Partial<Record<AgentId, Probe>>> {
    const { rows } = await this.pool.query('select distinct on (agent_id) * from agent_probes order by agent_id, probed_at desc');
    const latest: Partial<Record<AgentId, Probe>> = {};
    for (const row of rows) latest[row.agent_id as AgentId] = toProbe(row);
    return latest;
  }

  async audit(entry: NewAuditEntry): Promise<void> {
    await this.pool.query(AUDIT_SQL, auditParams(entry));
  }

  async listAudit(filter: { entityId?: string; limit?: number } = {}): Promise<AuditEntry[]> {
    const { rows } = await this.pool.query(
      `select * from audit_log where ($1::text is null or entity_id = $1 or details->>'taskId' = $1)
       order by id desc limit $2`,
      [filter.entityId ?? null, filter.limit ?? 100],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      at: iso(r.at),
      actor: r.actor,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id ?? null,
      details: r.details ?? {},
    }));
  }

  async hitRateLimit(key: string, windowSeconds: number, max: number): Promise<{ allowed: boolean; remaining: number }> {
    const { rows } = await this.pool.query(
      `insert into rate_limits (key, window_start, hits)
       values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
       on conflict (key, window_start) do update set hits = rate_limits.hits + 1
       returning hits`,
      [key, windowSeconds],
    );
    const hits = Number(rows[0].hits);
    return { allowed: hits <= max, remaining: Math.max(0, max - hits) };
  }
}
