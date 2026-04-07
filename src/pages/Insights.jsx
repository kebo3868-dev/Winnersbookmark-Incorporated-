import { useMemo } from 'react';
import { BarChart3, AlertTriangle, TrendingUp, Calendar, Flame, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import ScoreRing from '../components/ScoreRing';
import EmptyState from '../components/EmptyState';
import { detectDrift, computeWeeklyStats } from '../lib/insights';
import { getWeekDates, formatDate, daysAgo } from '../lib/dates';
import { getScoreColor, getScoreLabel, SCORE_CATEGORIES } from '../lib/scoring';

export default function Insights() {
  const { entries, thoughts, streak, systems, brainstorms, goals } = useApp();

  const entryKeys = Object.keys(entries);
  const entryCount = entryKeys.length;

  // Not enough data
  if (entryCount < 3) {
    return (
      <Layout>
        <div className="page-container">
          <div className="page-header">
            <h1 className="text-xl font-bold">Insights</h1>
          </div>
          <EmptyState
            icon={BarChart3}
            title="Not enough data yet"
            description="Complete a few daily entries to unlock insights."
            action={null}
          />
        </div>
      </Layout>
    );
  }

  const driftAlerts = useMemo(() => detectDrift(entries, thoughts), [entries, thoughts]);
  const weeklyStats = useMemo(() => computeWeeklyStats(entries), [entries]);
  const weekDates = useMemo(() => getWeekDates(), []);

  // Find most recent entry with scores
  const recentScored = useMemo(() => {
    const sorted = Object.keys(entries).sort().reverse();
    for (const key of sorted) {
      if (entries[key]?.evening?.scores) {
        return entries[key].evening.scores;
      }
    }
    return null;
  }, [entries]);

  // Most common emotional state from recent evening entries
  const commonEmotion = useMemo(() => {
    const sorted = Object.keys(entries).sort().reverse();
    const emotions = {};
    for (const key of sorted.slice(0, 14)) {
      const checkin = entries[key]?.evening?.emotionalCheckIn;
      if (checkin) {
        emotions[checkin] = (emotions[checkin] || 0) + 1;
      }
    }
    let best = null;
    let max = 0;
    for (const [emotion, count] of Object.entries(emotions)) {
      if (count > max) {
        max = count;
        best = emotion;
      }
    }
    return best;
  }, [entries]);

  // Long-term alignment: check if daily priorities mention 90-day mission words
  const alignmentMatch = useMemo(() => {
    if (!goals?.ninetyDay) return null;
    const missionWords = goals.ninetyDay.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (missionWords.length === 0) return null;

    const sorted = Object.keys(entries).sort().reverse();
    let matchCount = 0;
    let checked = 0;
    for (const key of sorted.slice(0, 7)) {
      const priorities = entries[key]?.morning?.priorities || [];
      const combined = priorities.join(' ').toLowerCase();
      if (combined && missionWords.some(w => combined.includes(w))) {
        matchCount++;
      }
      if (combined) checked++;
    }
    if (checked === 0) return null;
    return { matchCount, checked };
  }, [entries, goals]);

  const activeSystems = systems.filter(s => s.active).length;
  const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Layout>
      <div className="page-container space-y-5">
        <div className="page-header">
          <h1 className="text-xl font-bold">Insights</h1>
          <p className="text-sm text-wb-muted">Patterns, alerts, and weekly performance</p>
        </div>

        {/* Drift Alerts */}
        {driftAlerts.length > 0 && (
          <div className="space-y-3">
            <span className="section-title">Drift Alerts</span>
            {driftAlerts.map((alert, i) => (
              <div
                key={i}
                className={`card border ${
                  alert.severity === 'high'
                    ? 'border-red-400/30'
                    : 'border-wb-gold/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={18}
                    className={alert.severity === 'high' ? 'text-red-400 flex-shrink-0 mt-0.5' : 'text-wb-gold flex-shrink-0 mt-0.5'}
                  />
                  <p className="text-sm text-wb-white leading-relaxed">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weekly Overview */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-wb-blue-light" />
            <span className="section-title">Weekly Overview</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <span className="text-lg font-bold text-wb-white">{weeklyStats.completed}</span>
              <span className="text-xs text-wb-muted block">/7 days</span>
            </div>
            <div className="text-center">
              <span className={`text-lg font-bold ${getScoreColor(weeklyStats.avgScore)}`}>{weeklyStats.avgScore || '--'}</span>
              <span className="text-xs text-wb-muted block">avg score</span>
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-wb-white">
                {weeklyStats.bestDay ? formatDate(weeklyStats.bestDay).split(',')[0] : '--'}
              </span>
              <span className="text-xs text-wb-muted block">best day</span>
            </div>
          </div>

          {/* 7-Day Bar Chart */}
          <div className="flex items-end justify-between gap-1.5 h-28 pt-2">
            {weekDates.map(date => {
              const entry = entries[date];
              const score = entry?.evening?.alignmentScore || 0;
              const heightPct = score > 0 ? (score / 10) * 100 : 4;
              const dayDate = new Date(date + 'T00:00:00');
              const dayAbbrev = DAY_ABBREVS[dayDate.getDay()];
              const colorClass = score > 0 ? getScoreColor(score).replace('text-', 'bg-') : 'bg-wb-border';

              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                    <div
                      className={`w-full max-w-[28px] rounded-t ${colorClass}`}
                      style={{ height: `${heightPct}%`, minHeight: '3px', transition: 'height 0.3s ease' }}
                    />
                  </div>
                  <span className="text-[10px] text-wb-muted">{dayAbbrev}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score Breakdown */}
        {recentScored && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-wb-blue-light" />
              <span className="section-title">Score Breakdown</span>
            </div>
            {SCORE_CATEGORIES.map(cat => {
              const score = recentScored[cat] || 0;
              const widthPct = (score / 10) * 100;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-wb-white capitalize">{cat}</span>
                    <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}</span>
                  </div>
                  <div className="w-full h-2 bg-wb-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreColor(score).replace('text-', 'bg-')}`}
                      style={{ width: `${widthPct}%`, transition: 'width 0.4s ease' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Patterns */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-wb-blue-light" />
            <span className="section-title">Patterns</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-wb-dark/50 rounded-xl p-3 text-center">
              <span className="text-lg font-bold text-wb-white">{entryCount}</span>
              <span className="text-xs text-wb-muted block mt-0.5">Total Entries</span>
            </div>
            <div className="bg-wb-dark/50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Flame size={16} className="text-wb-gold" />
                <span className="text-lg font-bold text-wb-white">{streak}</span>
              </div>
              <span className="text-xs text-wb-muted block mt-0.5">Current Streak</span>
            </div>
            <div className="bg-wb-dark/50 rounded-xl p-3 text-center">
              <span className="text-lg font-bold text-wb-white">{activeSystems}</span>
              <span className="text-xs text-wb-muted block mt-0.5">Active Systems</span>
            </div>
            <div className="bg-wb-dark/50 rounded-xl p-3 text-center">
              <span className="text-lg font-bold text-wb-white">{brainstorms.length}</span>
              <span className="text-xs text-wb-muted block mt-0.5">Brainstorm Items</span>
            </div>
          </div>
          {commonEmotion && (
            <div className="bg-wb-dark/50 rounded-xl p-3 text-center">
              <span className="label">Most Common State</span>
              <span className="text-sm font-medium text-wb-white capitalize block mt-1">{commonEmotion}</span>
            </div>
          )}
        </div>

        {/* Long-term Alignment */}
        {alignmentMatch && (
          <div className="card space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-wb-blue-light" />
              <span className="section-title">Long-term Alignment</span>
            </div>
            <p className="text-sm text-wb-muted leading-relaxed">
              {alignmentMatch.matchCount > 0
                ? `${alignmentMatch.matchCount} of your last ${alignmentMatch.checked} daily priorities connect to your 90-day mission. ${
                    alignmentMatch.matchCount >= alignmentMatch.checked * 0.6
                      ? 'Your daily actions are well-aligned with your bigger goals.'
                      : 'Consider tightening the link between what you do daily and where you want to be in 90 days.'
                  }`
                : 'None of your recent daily priorities mention themes from your 90-day mission. Are you drifting from the bigger picture?'}
            </p>
            {goals?.ninetyDay && (
              <p className="text-xs text-wb-muted/60 mt-1 italic line-clamp-2">Mission: {goals.ninetyDay}</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
