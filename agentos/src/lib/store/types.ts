import type { AgentId } from '@/lib/agents/registry';
import type { ActionType } from '@/lib/approvals/policy';

/** A running task untouched this long lost its executor and may be reclaimed. */
export const STALE_RUNNING_MINUTES = 10;

export type RiskLevel = 'low' | 'medium' | 'high';
export type TaskStatus = 'queued' | 'running' | 'awaiting_approval' | 'approved' | 'rejected' | 'failed';
export type Verdict = 'pass' | 'concerns' | 'fail' | 'unparseable';

export interface Task {
  id: string;
  title: string;
  objective: string;
  agentId: AgentId;
  reviewerAgentId: AgentId | null;
  riskLevel: RiskLevel;
  status: TaskStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  title: string;
  objective: string;
  agentId: AgentId;
  reviewerAgentId: AgentId | null;
  riskLevel: RiskLevel;
}

export interface Finding {
  severity: 'low' | 'medium' | 'high';
  issue: string;
  recommendation?: string;
}

export interface ReviewFindings {
  summary: string;
  items: Finding[];
}

export interface Run {
  id: string;
  taskId: string;
  agentId: AgentId;
  role: 'primary' | 'reviewer';
  mode: 'live' | 'mock';
  attempt: number;
  status: 'succeeded' | 'failed';
  provider: string;
  model: string | null;
  output: string | null;
  verdict: Verdict | null;
  findings: ReviewFindings | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  providerResponseId: string | null;
  startedAt: string;
  finishedAt: string;
}

export type NewRun = Omit<Run, 'id'>;

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  taskId: string;
  actionType: ActionType;
  summary: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface Probe {
  id: string;
  agentId: AgentId;
  ok: boolean;
  detail: string;
  model: string | null;
  latencyMs: number | null;
  probedAt: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown>;
}

export type NewAuditEntry = Omit<AuditEntry, 'id' | 'at'>;

export interface Store {
  readonly kind: 'postgres' | 'memory';

  createTask(input: NewTask, actor: string): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  listTasks(limit?: number): Promise<Task[]>;
  /**
   * Atomically move a queued or failed task to running. Returns null when the
   * task is in any other state — including running — so two requests can never
   * execute the same task concurrently. The one exception is a task stuck in
   * running past STALE_RUNNING_MINUTES: its executor was killed (a serverless
   * timeout or a crash) and it can be claimed again.
   */
  claimTask(id: string, actor: string): Promise<Task | null>;
  /** Leave the running state. Only a running task can be finished. */
  finishTask(id: string, status: 'awaiting_approval' | 'failed', lastError: string | null): Promise<Task | null>;

  addRun(run: NewRun): Promise<Run>;
  listRuns(taskId: string): Promise<Run[]>;
  listRecentRuns(limit?: number): Promise<Run[]>;

  createApproval(input: { taskId: string; actionType: ActionType; summary: string }): Promise<Approval>;
  getApproval(id: string): Promise<Approval | null>;
  listApprovals(filter?: { status?: ApprovalStatus; taskId?: string }): Promise<Approval[]>;
  /**
   * Record the founder's decision on a pending approval, atomically with its
   * audit entry and — for `accept_result` — the task's final status. Returns
   * null when the approval is not pending (already decided, or absent).
   */
  decideApproval(id: string, decision: 'approved' | 'rejected', actor: string, note: string | null): Promise<Approval | null>;

  addProbe(probe: Omit<Probe, 'id' | 'probedAt'>): Promise<Probe>;
  latestProbes(): Promise<Partial<Record<AgentId, Probe>>>;

  audit(entry: NewAuditEntry): Promise<void>;
  listAudit(filter?: { entityId?: string; limit?: number }): Promise<AuditEntry[]>;

  /** Fixed-window counter shared by every instance. */
  hitRateLimit(key: string, windowSeconds: number, max: number): Promise<{ allowed: boolean; remaining: number }>;
}
