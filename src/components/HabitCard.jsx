import { Check, Flame, Lock } from 'lucide-react';
import { StreakCounter } from './StreakBadge';

export default function HabitCard({
  habit,
  isCompleted,
  streak,
  longestStreak,
  onToggle,
  disabled = false,
  showDetails = true,
}) {
  const colorMap = {
    indigo: 'border-indigo-500/50 bg-indigo-500/10',
    blue:   'border-wb-blue/50 bg-wb-blue/10',
    teal:   'border-teal-500/50 bg-teal-500/10',
    red:    'border-red-500/50 bg-red-500/10',
    purple: 'border-purple-500/50 bg-purple-500/10',
    green:  'border-green-500/50 bg-green-500/10',
    yellow: 'border-yellow-500/50 bg-yellow-500/10',
    default:'border-wb-blue/50 bg-wb-blue/10',
  };

  const completedBg = colorMap[habit.color] || colorMap.default;
  const cardClass = isCompleted
    ? `wb-card border-2 ${completedBg} transition-all duration-300`
    : 'wb-card border border-wb-border hover:border-wb-blue/40 transition-all duration-300';

  return (
    <div className={cardClass}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: emoji + info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="text-3xl mt-0.5 flex-shrink-0">{habit.emoji}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-wb-white font-semibold text-base truncate">{habit.name}</h3>
              {habit.defaultTarget && (
                <p className="text-wb-muted text-xs mt-0.5">Target: {habit.defaultTarget}</p>
              )}
              {showDetails && habit.description && (
                <p className="text-wb-muted text-xs mt-1 leading-relaxed line-clamp-2">
                  {habit.description}
                </p>
              )}
            </div>
          </div>

          {/* Right: check button */}
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${
              isCompleted
                ? 'bg-wb-blue border-wb-blue shadow-blue-glow scale-95'
                : 'bg-transparent border-wb-border hover:border-wb-blue hover:bg-wb-blue/10 active:scale-95'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {disabled ? (
              <Lock className="w-4 h-4 text-wb-muted" />
            ) : (
              <Check className={`w-5 h-5 ${isCompleted ? 'text-white' : 'text-wb-muted'}`} />
            )}
          </button>
        </div>

        {/* Streak row */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-wb-border/50">
          <StreakCounter streak={streak} label="streak" />
          {longestStreak > 0 && (
            <div className="text-xs text-wb-muted">
              Best: <span className="text-wb-white font-medium">{longestStreak}</span>
            </div>
          )}
          {isCompleted && (
            <span className="ml-auto text-xs bg-wb-blue/20 text-wb-blue-glow px-2 py-0.5 rounded-full font-medium">
              Done today ✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
