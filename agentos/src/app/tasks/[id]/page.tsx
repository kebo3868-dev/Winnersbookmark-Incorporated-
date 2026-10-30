import { notFound } from 'next/navigation';
import { AGENTS } from '@/lib/agents/registry';
import { requireOwnerPage } from '@/lib/auth/owner';
import { ACTION_LABELS } from '@/lib/approvals/policy';
import { uuidSchema } from '@/lib/http/api';
import { getStore } from '@/lib/store';
import type { Run } from '@/lib/store/types';
import { formatTime, TASK_STATUS_LABEL, TASK_STATUS_TONE, VERDICT_LABEL, VERDICT_TONE } from '@/lib/ui/format';
import { Badge, LiveBadge, SimulatedBadge } from '@/components/Badge';
import { Shell } from '@/components/Shell';
import { DecisionPanel } from '@/components/client/DecisionPanel';
import { RunButton } from '@/components/client/RunButton';

export const dynamic = 'force-dynamic';

function Evidence({ run }: { run: Run }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400">
      <dt>Provider</dt><dd className="text-slate-300">{run.provider}</dd>
      <dt>Model served</dt><dd className="break-all text-slate-300">{run.model ?? '—'}</dd>
      <dt>Response id</dt><dd className="break-all text-slate-300">{run.providerResponseId ?? '—'}</dd>
      <dt>Tokens in / out</dt><dd className="text-slate-300">{run.inputTokens ?? '—'} / {run.outputTokens ?? '—'}</dd>
      <dt>Latency</dt><dd className="text-slate-300">{run.latencyMs != null ? `${run.latencyMs} ms` : '—'}</dd>
      <dt>Finished</dt><dd className="text-slate-300">{formatTime(run.finishedAt)}</dd>
    </dl>
  );
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const store = getStore();
  const task = await store.getTask(id);
  if (!task) notFound();
  const [runs, approvals, audit] = await Promise.all([store.listRuns(id), store.listApprovals({ taskId: id }), store.listAudit({ entityId: id, limit: 50 })]);

  const primary = [...runs].reverse().find((r) => r.role === 'primary' && r.status === 'succeeded');
  const review = [...runs].reverse().find((r) => r.role === 'reviewer' && r.status === 'succeeded');
  const pending = approvals.find((a) => a.status === 'pending');
  const simulated = primary?.mode === 'mock' || review?.mode === 'mock';
  const agent = AGENTS[task.agentId];

  return (
    <Shell>
      <header className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TASK_STATUS_TONE[task.status]} testId="task-status">{TASK_STATUS_LABEL[task.status]}</Badge>
          <Badge tone="border-ink-line bg-ink-3 text-slate-300">Risk: {task.riskLevel}</Badge>
          {simulated && <SimulatedBadge />}
        </div>
        <h1 className="text-xl font-bold">{task.title}</h1>
        <p className="text-xs text-slate-400">
          Primary: {agent.name} ({agent.title}) · Reviewer: {task.reviewerAgentId ? AGENTS[task.reviewerAgentId].name : 'none'} · Created {formatTime(task.createdAt)}
        </p>
      </header>

      <section className="card mb-4">
        <h2 className="label">Objective</h2>
        <p className="whitespace-pre-wrap text-sm">{task.objective}</p>
      </section>

      {(task.status === 'queued' || task.status === 'failed') && (
        <section className="card mb-4 space-y-2">
          {task.lastError && <p className="text-sm text-red-300" data-testid="task-error">Last attempt failed: {task.lastError}</p>}
          <RunButton taskId={task.id} label={task.status === 'failed' ? 'Retry task' : `Run with ${agent.name}`} />
        </section>
      )}

      {primary && (
        <section className="card mb-4 space-y-3" data-testid="primary-output">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Result · {AGENTS[primary.agentId].name}</h2>
            {primary.mode === 'mock' ? <SimulatedBadge /> : <LiveBadge />}
          </div>
          <pre className="output">{primary.output}</pre>
          <Evidence run={primary} />
        </section>
      )}

      {review && (
        <section className="card mb-4 space-y-3" data-testid="review-output">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Independent review · {AGENTS[review.agentId].name}</h2>
            <div className="flex gap-2">
              {review.verdict && <Badge tone={VERDICT_TONE[review.verdict]} testId="review-verdict">{VERDICT_LABEL[review.verdict]}</Badge>}
              {review.mode === 'mock' ? <SimulatedBadge /> : <LiveBadge />}
            </div>
          </div>
          {review.findings && <p className="text-sm">{review.findings.summary}</p>}
          {review.findings && review.findings.items.length > 0 && (
            <ul className="space-y-2">
              {review.findings.items.map((f, i) => (
                <li key={i} className="rounded-xl border border-ink-line bg-ink-3 p-3 text-sm">
                  <span className="text-xs font-bold uppercase text-amber-300">{f.severity}</span> {f.issue}
                  {f.recommendation && <span className="block text-xs text-slate-400">→ {f.recommendation}</span>}
                </li>
              ))}
            </ul>
          )}
          {review.verdict === 'unparseable' && <pre className="output">{review.output}</pre>}
          <Evidence run={review} />
        </section>
      )}

      {pending && (
        <section className="card mb-4 space-y-3 border-gold/60" data-testid="approval-panel">
          <h2 className="text-sm font-bold text-gold">Your decision · {ACTION_LABELS[pending.actionType]}</h2>
          <p className="text-sm">{pending.summary}</p>
          <DecisionPanel approvalId={pending.id} simulatedResult={primary?.mode === 'mock'} simulatedReview={review?.mode === 'mock'} />
        </section>
      )}

      {approvals.filter((a) => a.status !== 'pending').map((a) => (
        <section key={a.id} className="card mb-4 text-sm" data-testid="decision-record">
          <span className={a.status === 'approved' ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>{a.status === 'approved' ? 'Approved' : 'Rejected'}</span>
          <span className="text-slate-400"> · {ACTION_LABELS[a.actionType]} by {a.decidedBy} at {formatTime(a.decidedAt)}</span>
          {a.note && <p className="mt-1 text-slate-300">“{a.note}”</p>}
        </section>
      ))}

      <section className="card mb-4">
        <h2 className="label">Run history ({runs.length} attempts)</h2>
        {runs.length === 0 ? <p className="text-sm text-slate-400">Not run yet.</p> : (
          <ol className="space-y-2 text-xs">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg bg-ink-3 p-2">
                <span className={run.status === 'succeeded' ? 'text-emerald-300' : 'text-red-300'}>{run.status}</span>
                {' · '}{run.role} · {AGENTS[run.agentId].name} · attempt {run.attempt} · {run.mode === 'mock' ? 'SIMULATED' : 'live'} · {formatTime(run.finishedAt)}
                {run.error && <span className="block text-red-300">{run.error}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h2 className="label">Audit trail</h2>
        <ol className="space-y-1 text-xs text-slate-400">
          {audit.map((entry) => (
            <li key={entry.id}><span className="text-slate-300">{entry.action}</span> · {entry.actor} · {formatTime(entry.at)}</li>
          ))}
        </ol>
      </section>
    </Shell>
  );
}
