import { randomUUID } from 'node:crypto';
import type { AgentId } from '@/lib/agents/registry';
import { STALE_RUNNING_MINUTES } from './types';
import type { Approval, AuditEntry, NewAuditEntry, NewRun, NewTask, Probe, Run, Store, Task } from './types';

/**
 * In-process store for local development and the unit suite. Data lives only
 * as long as the process; the dashboard says so whenever this store is in use,
 * and getStore() refuses it in production.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private tasks = new Map<string, Task>();
  private runs: Run[] = [];
  private approvals = new Map<string, Approval>();
  private probes: Probe[] = [];
  private auditLog: AuditEntry[] = [];
  private limits = new Map<string, number>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private stamp(): string {
    return this.now().toISOString();
  }

  async createTask(input: NewTask, actor: string): Promise<Task> {
    const at = this.stamp();
    const task: Task = { id: randomUUID(), ...input, status: 'queued', lastError: null, createdAt: at, updatedAt: at };
    this.tasks.set(task.id, task);
    await this.audit({ actor, action: 'task.created', entity: 'task', entityId: task.id, details: { agentId: task.agentId, reviewerAgentId: task.reviewerAgentId, riskLevel: task.riskLevel } });
    return { ...task };
  }

  async getTask(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async listTasks(limit = 50): Promise<Task[]> {
    return [...this.tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((t) => ({ ...t }));
  }

  async claimTask(id: string, actor: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    const stale = task.status === 'running' && this.now().getTime() - Date.parse(task.updatedAt) > STALE_RUNNING_MINUTES * 60_000;
    if (task.status !== 'queued' && task.status !== 'failed' && !stale) return null;
    Object.assign(task, { status: 'running', lastError: null, updatedAt: this.stamp() });
    await this.audit({ actor, action: 'task.claimed', entity: 'task', entityId: id, details: { reclaimedStale: stale } });
    return { ...task };
  }

  async finishTask(id: string, status: 'awaiting_approval' | 'failed', lastError: string | null): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return null;
    Object.assign(task, { status, lastError, updatedAt: this.stamp() });
    return { ...task };
  }

  async addRun(run: NewRun): Promise<Run> {
    const stored: Run = { id: randomUUID(), ...run };
    this.runs.push(stored);
    return { ...stored };
  }

  async listRuns(taskId: string): Promise<Run[]> {
    return this.runs.filter((r) => r.taskId === taskId).map((r) => ({ ...r }));
  }

  async listRecentRuns(limit = 20): Promise<Run[]> {
    return [...this.runs].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, limit).map((r) => ({ ...r }));
  }

  async createApproval(input: { taskId: string; actionType: Approval['actionType']; summary: string }): Promise<Approval> {
    const open = [...this.approvals.values()].find((a) => a.taskId === input.taskId && a.actionType === input.actionType && a.status === 'pending');
    if (open) return { ...open };
    const approval: Approval = { id: randomUUID(), ...input, status: 'pending', decidedBy: null, decidedAt: null, note: null, createdAt: this.stamp() };
    this.approvals.set(approval.id, approval);
    return { ...approval };
  }

  async getApproval(id: string): Promise<Approval | null> {
    const approval = this.approvals.get(id);
    return approval ? { ...approval } : null;
  }

  async listApprovals(filter: { status?: Approval['status']; taskId?: string } = {}): Promise<Approval[]> {
    return [...this.approvals.values()]
      .filter((a) => (!filter.status || a.status === filter.status) && (!filter.taskId || a.taskId === filter.taskId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ ...a }));
  }

  async decideApproval(id: string, decision: 'approved' | 'rejected', actor: string, note: string | null): Promise<Approval | null> {
    const approval = this.approvals.get(id);
    if (!approval || approval.status !== 'pending') return null;
    const at = this.stamp();
    Object.assign(approval, { status: decision, decidedBy: actor, decidedAt: at, note });
    if (approval.actionType === 'accept_result') {
      const task = this.tasks.get(approval.taskId);
      if (task) Object.assign(task, { status: decision, updatedAt: at });
    }
    await this.audit({ actor, action: `approval.${decision}`, entity: 'approval', entityId: id, details: { taskId: approval.taskId, actionType: approval.actionType, note } });
    return { ...approval };
  }

  async addProbe(probe: Omit<Probe, 'id' | 'probedAt'>): Promise<Probe> {
    const stored: Probe = { id: randomUUID(), probedAt: this.stamp(), ...probe };
    this.probes.push(stored);
    return { ...stored };
  }

  async latestProbes(): Promise<Partial<Record<AgentId, Probe>>> {
    const latest: Partial<Record<AgentId, Probe>> = {};
    for (const probe of this.probes) {
      const current = latest[probe.agentId];
      if (!current || probe.probedAt >= current.probedAt) latest[probe.agentId] = { ...probe };
    }
    return latest;
  }

  async audit(entry: NewAuditEntry): Promise<void> {
    this.auditLog.push({ id: this.auditLog.length + 1, at: this.stamp(), ...entry });
  }

  async listAudit(filter: { entityId?: string; limit?: number } = {}): Promise<AuditEntry[]> {
    return this.auditLog
      .filter((e) => !filter.entityId || e.entityId === filter.entityId || (e.details as { taskId?: string }).taskId === filter.entityId)
      .slice(-(filter.limit ?? 100))
      .reverse();
  }

  async hitRateLimit(key: string, windowSeconds: number, max: number): Promise<{ allowed: boolean; remaining: number }> {
    const window = Math.floor(this.now().getTime() / 1000 / windowSeconds);
    const slot = `${key}@${window}`;
    const hits = (this.limits.get(slot) ?? 0) + 1;
    this.limits.set(slot, hits);
    return { allowed: hits <= max, remaining: Math.max(0, max - hits) };
  }
}
