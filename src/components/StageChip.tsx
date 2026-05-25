import type { CRMStage } from '../types';

const stageColors: Record<string, string> = {
  'New Lead': 'bg-electric/10 border-electric/30 text-electric-glow',
  'Researched': 'bg-gold/10 border-gold/30 text-gold-light',
  'Bottleneck Audit Created': 'bg-gold/15 border-gold/40 text-gold-light',
  'Email Drafted': 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  'Email Approved': 'bg-purple-500/15 border-purple-500/40 text-purple-200',
  'Email Sent': 'bg-blue-400/10 border-blue-400/30 text-blue-300',
  'Follow-Up 1': 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  'Follow-Up 2': 'bg-orange-500/15 border-orange-500/40 text-orange-200',
  'Discovery Call Booked': 'bg-teal-500/10 border-teal-500/30 text-teal-300',
  'Proposal Sent': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
  'Trial Offered': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  'Trial Started': 'bg-yellow-500/15 border-yellow-500/40 text-yellow-200',
  'Closed Won': 'bg-success/10 border-success/30 text-success',
  'Closed Lost': 'bg-danger/10 border-danger/30 text-danger',
  'Do Not Contact': 'bg-ink-card border-ink-edge text-ghost',
};

export default function StageChip({ stage }: { stage: CRMStage }) {
  const cls = stageColors[stage] || 'bg-ink-card border-ink-line text-chalk';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cls}`}>
      {stage}
    </span>
  );
}
