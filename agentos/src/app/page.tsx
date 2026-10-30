import Link from 'next/link';
import { AGENTS } from '@/lib/agents/registry';
import { requireOwnerPage } from '@/lib/auth/owner';
import { allAgentStatuses } from '@/lib/providers/status';
import { getStore } from '@/lib/store';
import { CONNECTION_LABEL, CONNECTION_TONE, formatTime, TASK_STATUS_LABEL, TASK_STATUS_TONE } from '@/lib/ui/format';
import { Badge, SimulatedBadge } from '@/components/Badge';
import { Shell } from '@/components/Shell';
import { ProbeButton } from '@/components/client/ProbeButton';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireOwnerPage();
  const store = getStore();
  const [tasks, runs, probes] = await Promise.all([store.listTasks(100), store.listRecentRuns(100), store.latestProbes()]);
  const statuses = allAgentStatuses(probes);

  return (
    <Shell>
      <h1 className="mb-1 text-xl font-bold">Agent dashboard</h1>
      <p className="mb-4 text-sm text-slate-400">Connection states are shown as they are. “Verified” means a live check succeeded in the last 24 hours.</p>

      <section className="grid gap-3 sm:grid-cols-2">
        {statuses.map((status) => {
          const agent = AGENTS[status.agentId];
          const assigned = tasks.filter((t) => t.agentId === agent.id);
          const open = assigned.filter((t) => t.status === 'queued' || t.status === 'running' || t.status === 'awaiting_approval').length;
          const lastResult = runs.find((r) => r.agentId === agent.id && r.status === 'succeeded');
          const lastError = runs.find((r) => r.agentId === agent.id && r.status === 'failed');
          return (
            <article key={agent.id} className="card space-y-3" data-testid={`agent-${agent.id}`}>
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{agent.name}</h2>
                  <p className="text-xs text-slate-400">{agent.title} · {agent.providerLabel}</p>
                </div>
                <Badge tone={CONNECTION_TONE[status.state]} testId={`status-${agent.id}`}>{CONNECTION_LABEL[status.state]}</Badge>
              </header>
              <p className="text-xs text-slate-400">{agent.summary}</p>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-ink-3 p-2"><dt className="text-[10px] uppercase text-slate-500">Assigned</dt><dd className="text-base font-bold">{assigned.length}</dd></div>
                <div className="rounded-lg bg-ink-3 p-2"><dt className="text-[10px] uppercase text-slate-500">Open</dt><dd className="text-base font-bold">{open}</dd></div>
                <div className="rounded-lg bg-ink-3 p-2"><dt className="text-[10px] uppercase text-slate-500">Model</dt><dd className="truncate text-[11px] font-semibold">{status.model}</dd></div>
              </dl>
              <p className="text-xs text-slate-300">{status.detail}</p>
              <div className="space-y-1 text-xs">
                <p className="text-slate-400">
                  Last result: {lastResult ? <Link className="text-gold underline" href={`/tasks/${lastResult.taskId}`}>{formatTime(lastResult.finishedAt)}</Link> : '—'}
                  {lastResult?.mode === 'mock' && <span className="ml-2"><SimulatedBadge /></span>}
                </p>
                {lastError && <p className="text-red-300">Last error ({formatTime(lastError.finishedAt)}): {lastError.error}</p>}
              </div>
              <ProbeButton agentId={agent.id} disabled={status.state === 'not_configured'} />
            </article>
          );
        })}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent tasks</h2>
          <Link href="/tasks/new" className="text-sm font-semibold text-gold">+ New task</Link>
        </div>
        {tasks.length === 0 ? (
          <p className="card text-sm text-slate-400">No tasks yet.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.slice(0, 20).map((task) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`} className="card flex items-center justify-between gap-3 hover:border-slate-500">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{task.title}</span>
                    <span className="block text-xs text-slate-500">{AGENTS[task.agentId].name}{task.reviewerAgentId ? ` → reviewed by ${AGENTS[task.reviewerAgentId].name}` : ''} · {formatTime(task.createdAt)}</span>
                  </span>
                  <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
