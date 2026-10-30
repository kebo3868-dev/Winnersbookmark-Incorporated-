import type { ConnectionState } from '@/lib/providers/status';
import type { TaskStatus, Verdict } from '@/lib/store/types';

/** Server-rendered timestamps in UTC, so markup is identical on every render. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  queued: 'bg-slate-500/15 text-slate-200 border-slate-500/40',
  running: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  awaiting_approval: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  approved: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  rejected: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
  failed: 'bg-red-500/15 text-red-200 border-red-500/40',
};

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  verified: 'Connected · verified',
  unverified: 'Configured · not verified',
  error: 'Connection error',
  blocked: 'Blocked by policy',
  not_configured: 'Not connected',
};

export const CONNECTION_TONE: Record<ConnectionState, string> = {
  verified: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  unverified: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  error: 'bg-red-500/15 text-red-200 border-red-500/40',
  blocked: 'bg-red-500/15 text-red-200 border-red-500/40',
  not_configured: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  pass: 'Pass',
  concerns: 'Concerns',
  fail: 'Fail',
  unparseable: 'Unreadable verdict',
};

export const VERDICT_TONE: Record<Verdict, string> = {
  pass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  concerns: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  fail: 'bg-red-500/15 text-red-200 border-red-500/40',
  unparseable: 'bg-red-500/15 text-red-200 border-red-500/40',
};
