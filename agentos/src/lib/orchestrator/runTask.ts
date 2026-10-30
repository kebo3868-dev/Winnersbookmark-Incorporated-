import { AGENTS, type AgentId } from '@/lib/agents/registry';
import type { Resolution } from '@/lib/providers';
import { ProviderError, type CompletionRequest } from '@/lib/providers/types';
import type { Run, Store, Task } from '@/lib/store/types';
import { parseReview, reviewInput, reviewInstructions } from './review';

/**
 * TASK EXECUTION: claim → primary agent (with bounded retries) → independent
 * review by a different agent → founder approval.
 *
 * Every provider attempt, successful or not, is written as an immutable run,
 * so the task page shows exactly what happened, including retries. Nothing
 * here acts on the outside world: the result waits for an explicit
 * `accept_result` approval.
 *
 * Retries: only for transient failures (rate limit, timeout, network, 5xx),
 * with exponential backoff or the provider's Retry-After, and never past the
 * request's time budget. Authentication, policy and bad-request errors stop
 * immediately — repeating them would only spend money.
 */
export interface RunDeps {
  store: Store;
  resolve: (agentId: AgentId) => Resolution;
  actor: string;
  maxAttempts?: number;
  /** Wall-clock budget for the whole task, so a serverless invocation is not killed mid-write. */
  budgetMs?: number;
  maxOutputTokens?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type RunOutcome =
  | { ok: true; task: Task; approvalId: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_runnable' }
  | { ok: false; reason: 'failed'; task: Task | null; error: string };

const MIN_ATTEMPT_BUDGET_MS = 30_000;

function backoffMs(attempt: number, error: ProviderError): number {
  if (error.retryAfterMs !== undefined) return error.retryAfterMs;
  return Math.min(1_000 * 2 ** (attempt - 1), 8_000);
}

interface StepResult {
  run: Run | null;
  error: string | null;
}

async function executeStep(
  deps: Required<Pick<RunDeps, 'store' | 'resolve' | 'sleep' | 'now'>> & { maxAttempts: number; deadline: number },
  task: Task,
  agentId: AgentId,
  role: Run['role'],
  request: CompletionRequest,
): Promise<StepResult> {
  const agent = AGENTS[agentId];
  let lastError = 'No attempt was made';
  for (let attempt = 1; attempt <= deps.maxAttempts; attempt++) {
    const startedAt = new Date(deps.now()).toISOString();
    const resolution = deps.resolve(agentId);
    if (!resolution.ok) {
      await deps.store.addRun(failedRun(task, agentId, role, 'live', attempt, agent.provider, null, resolution.error.message, startedAt, deps.now));
      return { run: null, error: resolution.error.message };
    }
    const adapter = resolution.adapter;
    try {
      const result = await adapter.complete(request);
      const base = {
        taskId: task.id,
        agentId,
        role,
        mode: adapter.mode,
        attempt,
        status: 'succeeded' as const,
        provider: adapter.mode === 'mock' ? 'mock' : adapter.provider,
        model: result.model ?? adapter.model,
        error: null,
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        latencyMs: result.latencyMs,
        providerResponseId: result.providerResponseId ?? null,
        startedAt,
        finishedAt: new Date(deps.now()).toISOString(),
      };
      if (role === 'reviewer') {
        const review = parseReview(result.text);
        const run = await deps.store.addRun({ ...base, output: result.text, verdict: review.verdict, findings: { summary: review.summary, items: review.findings } });
        return { run, error: null };
      }
      const run = await deps.store.addRun({ ...base, output: result.text, verdict: null, findings: null });
      return { run, error: null };
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError('bad_response', 'Unexpected adapter failure');
      lastError = `${agent.name}: ${providerError.message}`;
      await deps.store.addRun(failedRun(task, agentId, role, adapter.mode, attempt, adapter.mode === 'mock' ? 'mock' : adapter.provider, adapter.model, lastError, startedAt, deps.now));
      const wait = backoffMs(attempt, providerError);
      const canRetry =
        providerError.retryable && attempt < deps.maxAttempts && deps.deadline - deps.now() - wait > MIN_ATTEMPT_BUDGET_MS;
      if (!canRetry) break;
      await deps.sleep(wait);
    }
  }
  return { run: null, error: lastError };
}

function failedRun(
  task: Task,
  agentId: AgentId,
  role: Run['role'],
  mode: Run['mode'],
  attempt: number,
  provider: string,
  model: string | null,
  error: string,
  startedAt: string,
  now: () => number,
) {
  return {
    taskId: task.id, agentId, role, mode, attempt, status: 'failed' as const, provider, model,
    output: null, verdict: null, findings: null, error, inputTokens: null, outputTokens: null,
    latencyMs: null, providerResponseId: null, startedAt, finishedAt: new Date(now()).toISOString(),
  };
}

export async function runTask(taskId: string, deps: RunDeps): Promise<RunOutcome> {
  const now = deps.now ?? Date.now;
  const ctx = {
    store: deps.store,
    resolve: deps.resolve,
    sleep: deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))),
    now,
    maxAttempts: Math.max(1, Math.min(deps.maxAttempts ?? 2, 5)),
    deadline: now() + (deps.budgetMs ?? 280_000),
  };
  const existing = await deps.store.getTask(taskId);
  if (!existing) return { ok: false, reason: 'not_found' };
  const task = await deps.store.claimTask(taskId, deps.actor);
  if (!task) return { ok: false, reason: 'not_runnable' };

  const primaryAgent = AGENTS[task.agentId];
  const primary = await executeStep(ctx, task, task.agentId, 'primary', {
    instructions: primaryAgent.instructions,
    input: `${task.objective}\n\n(Task title: ${task.title})`,
    maxOutputTokens: deps.maxOutputTokens,
  });
  if (!primary.run) return fail(deps, task, primary.error ?? 'Primary agent failed');

  let review: Run | null = null;
  if (task.reviewerAgentId) {
    const reviewer = AGENTS[task.reviewerAgentId];
    const step = await executeStep(ctx, task, task.reviewerAgentId, 'reviewer', {
      instructions: reviewInstructions(reviewer),
      input: reviewInput(task, primaryAgent, primary.run.output ?? ''),
      maxOutputTokens: deps.maxOutputTokens,
    });
    // A required check that did not happen is a failure, not a silent skip.
    if (!step.run) return fail(deps, task, `Independent review did not complete — ${step.error}`);
    review = step.run;
  }

  const simulatedResult = primary.run.mode === 'mock';
  const simulatedReview = review?.mode === 'mock';
  const simulated = simulatedResult || simulatedReview;
  const summary = [
    simulatedResult && simulatedReview ? 'SIMULATED RESULT AND REVIEW — ' : simulatedResult ? 'SIMULATED RESULT — ' : simulatedReview ? 'SIMULATED REVIEW — ' : '',
    `${primaryAgent.name} produced a result for “${task.title}”.`,
    review ? ` Independent review by ${AGENTS[review.agentId].name}: ${review.verdict}.` : ' No independent review (low risk).',
  ].join('');
  const approval = await deps.store.createApproval({ taskId: task.id, actionType: 'accept_result', summary });
  const finished = await deps.store.finishTask(task.id, 'awaiting_approval', null);
  await deps.store.audit({
    actor: deps.actor,
    action: 'task.ready_for_approval',
    entity: 'task',
    entityId: task.id,
    details: { primaryRunId: primary.run.id, reviewRunId: review?.id ?? null, verdict: review?.verdict ?? null, simulated, simulatedResult, simulatedReview: Boolean(simulatedReview), approvalId: approval.id },
  });
  return { ok: true, task: finished ?? task, approvalId: approval.id };
}

async function fail(deps: RunDeps, task: Task, error: string): Promise<RunOutcome> {
  const finished = await deps.store.finishTask(task.id, 'failed', error.slice(0, 1000));
  await deps.store.audit({ actor: deps.actor, action: 'task.failed', entity: 'task', entityId: task.id, details: { error: error.slice(0, 1000) } });
  return { ok: false, reason: 'failed', task: finished, error };
}
