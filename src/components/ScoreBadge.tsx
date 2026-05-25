import { scoreBg } from '../utils/scoring';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
}

export default function ScoreBadge({ score, size = 'md', showBar = false }: ScoreBadgeProps) {
  const label = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  const barColor = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-gold' : 'bg-danger';

  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${textSize} ${scoreBg(score)}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${barColor}`} />
        {score} — {label}
      </div>
      {showBar && (
        <div className="w-full h-1.5 rounded-full bg-ink-line overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${score}%` }} />
        </div>
      )}
    </div>
  );
}
