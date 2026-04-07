import { getScoreColor, getScoreLabel } from '../lib/scoring';

export default function ScoreRing({ score, size = 80, strokeWidth = 6, showLabel = true }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null ? (score / 10) * circumference : 0;
  const color = score != null ? getScoreColor(score) : 'text-wb-muted';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-wb-border"
          />
          {score != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className={color}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>
            {score != null ? score : '—'}
          </span>
        </div>
      </div>
      {showLabel && score != null && (
        <span className={`text-xs font-medium ${color}`}>{getScoreLabel(score)}</span>
      )}
    </div>
  );
}
