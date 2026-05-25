import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'gold' | 'blue' | 'green' | 'red' | 'default';
  sub?: string;
}

const colorMap = {
  gold: { icon: 'text-gold', border: 'border-gold/20', bg: 'bg-gold/5' },
  blue: { icon: 'text-electric', border: 'border-electric/20', bg: 'bg-electric/5' },
  green: { icon: 'text-success', border: 'border-success/20', bg: 'bg-success/5' },
  red: { icon: 'text-danger', border: 'border-danger/20', bg: 'bg-danger/5' },
  default: { icon: 'text-mist', border: 'border-ink-line', bg: 'bg-ink-card/30' },
};

export default function StatCard({ label, value, icon: Icon, color = 'default', sub }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`glass ${c.border} p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-paper leading-none">{value}</p>
        <p className="text-[11px] text-mist mt-1 uppercase tracking-wider">{label}</p>
        {sub && <p className="text-[11px] text-chalk/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
