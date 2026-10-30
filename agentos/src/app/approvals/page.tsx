import Link from 'next/link';
import { requireOwnerPage } from '@/lib/auth/owner';
import { ACTION_LABELS } from '@/lib/approvals/policy';
import { getStore } from '@/lib/store';
import { formatTime } from '@/lib/ui/format';
import { Shell } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  await requireOwnerPage();
  const store = getStore();
  const [pending, all] = await Promise.all([store.listApprovals({ status: 'pending' }), store.listApprovals()]);
  const decided = all.filter((a) => a.status !== 'pending').slice(0, 20);
  return (
    <Shell>
      <h1 className="mb-1 text-xl font-bold">Approvals</h1>
      <p className="mb-4 text-sm text-slate-400">Nothing leaves AgentOS, spends money, publishes, changes production or commits you without a decision recorded here.</p>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Waiting for you ({pending.length})</h2>
      {pending.length === 0 ? <p className="card mb-6 text-sm text-slate-400">Nothing waiting.</p> : (
        <ul className="mb-6 space-y-2">
          {pending.map((a) => (
            <li key={a.id}>
              <Link href={`/tasks/${a.taskId}`} className="card block hover:border-slate-500" data-testid="pending-approval">
                <span className="block text-xs font-bold uppercase text-gold">{ACTION_LABELS[a.actionType]}</span>
                <span className="block text-sm">{a.summary}</span>
                <span className="block text-xs text-slate-500">{formatTime(a.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Recently decided</h2>
      {decided.length === 0 ? <p className="card text-sm text-slate-400">No decisions yet.</p> : (
        <ul className="space-y-2">
          {decided.map((a) => (
            <li key={a.id}>
              <Link href={`/tasks/${a.taskId}`} className="card block text-sm hover:border-slate-500">
                <span className={a.status === 'approved' ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>{a.status === 'approved' ? 'Approved' : 'Rejected'}</span>
                <span className="text-slate-400"> · {ACTION_LABELS[a.actionType]} · {formatTime(a.decidedAt)}</span>
                <span className="block">{a.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
