import { Flame, Trophy, Star } from 'lucide-react';

const milestones = [3, 7, 14, 21, 30, 60, 90];

function getMilestoneEmoji(streak) {
  if (streak >= 90) return '👑';
  if (streak >= 60) return '🏆';
  if (streak >= 30) return '💎';
  if (streak >= 21) return '🥇';
  if (streak >= 14) return '🥈';
  if (streak >= 7)  return '🔥';
  if (streak >= 3)  return '⚡';
  return '🌱';
}

function getMilestoneLabel(streak) {
  if (streak >= 90) return 'Legend';
  if (streak >= 60) return 'Champion';
  if (streak >= 30) return 'Diamond';
  if (streak >= 21) return 'Gold';
  if (streak >= 14) return 'Silver';
  if (streak >= 7)  return 'On Fire';
  if (streak >= 3)  return 'Building';
  if (streak >= 1)  return 'Started';
  return 'Begin';
}

export function StreakBadge({ streak, size = 'md' }) {
  const emoji = getMilestoneEmoji(streak);
  const label = getMilestoneLabel(streak);

  const sizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={sizes[size]}>{emoji}</span>
      <div className="flex items-center gap-1">
        <Flame className="w-3 h-3 text-orange-400" />
        <span className="text-wb-white font-bold text-sm">{streak}</span>
        <span className="text-wb-muted text-xs">days</span>
      </div>
      <span className="text-xs text-wb-blue-glow font-medium">{label}</span>
    </div>
  );
}

export function StreakMilestoneBar({ streak }) {
  const next = milestones.find(m => m > streak) || milestones[milestones.length - 1];
  const prev = [...milestones].reverse().find(m => m <= streak) || 0;
  const progress = next === prev ? 100 : ((streak - prev) / (next - prev)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-wb-muted">
        <span>{streak} day streak</span>
        <span>Next: {next} days</span>
      </div>
      <div className="h-2 bg-wb-dark rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-wb-blue to-wb-blue-glow rounded-full transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="flex justify-between">
        {milestones.map(m => (
          <div
            key={m}
            className={`text-xs ${streak >= m ? 'text-wb-blue-glow font-semibold' : 'text-wb-border'}`}
          >
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StreakCounter({ streak, label = '', className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Flame className={`w-5 h-5 ${streak > 0 ? 'text-orange-400' : 'text-wb-border'}`} />
      <span className="font-bold text-wb-white">{streak}</span>
      {label && <span className="text-wb-muted text-sm">{label}</span>}
    </div>
  );
}
