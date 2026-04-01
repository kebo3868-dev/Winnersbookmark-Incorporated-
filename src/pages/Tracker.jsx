import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import HabitCard from '../components/HabitCard';
import { StreakBadge, StreakMilestoneBar } from '../components/StreakBadge';
import QuoteCard from '../components/QuoteCard';
import { habitCategories, atomicQuotes } from '../data/quotes';
import {
  getTodayKey,
  isHabitCompleted,
  calculateStreak,
  getLongestStreak,
} from '../data/storage';

function dateKey(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function CalendarHeatmap({ habitId, completedDates, weeks = 12 }) {
  const today = new Date();
  const days = [];
  const start = addDays(today, -(weeks * 7 - 1));

  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    days.push({
      date: d,
      key: dateKey(d),
      isToday: dateKey(d) === dateKey(today),
    });
  }

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="overflow-x-auto">
      <div>
        <div className="flex gap-1 mb-1">
          {daysOfWeek.map((d, i) => (
            <div key={i} className="w-3 text-center text-wb-border text-[8px]">{d}</div>
          ))}
        </div>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${weeks}, 12px)`,
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
          }}
        >
          {days.map(({ key, isToday }) => {
            const done = completedDates.includes(key);
            return (
              <div
                key={key}
                title={key}
                className={`w-3 h-3 rounded-sm ${
                  done
                    ? 'bg-wb-blue shadow-blue-glow/50'
                    : isToday
                    ? 'bg-wb-border border border-wb-blue/50'
                    : 'bg-wb-dark border border-wb-border/30'
                }`}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-wb-muted">
          <div className="w-3 h-3 bg-wb-dark border border-wb-border/30 rounded-sm" />
          <span>Missed</span>
          <div className="w-3 h-3 bg-wb-blue rounded-sm" />
          <span>Done</span>
        </div>
      </div>
    </div>
  );
}

function HabitDetailPanel({ habit, habitData, today, onToggle }) {
  const dates = habitData[habit.id]?.completedDates || [];
  const streak = calculateStreak(dates);
  const longest = getLongestStreak(dates);
  const completedThisMonth = dates.filter(d => d.startsWith(new Date().toISOString().slice(0, 7))).length;
  const isCompleted = isHabitCompleted(habit.id, today, habitData);

  const tip = atomicQuotes.find(q => q.law !== 'General Principle') || atomicQuotes[0];

  return (
    <div className="wb-card p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{habit.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-wb-white">{habit.name}</h2>
            <p className="text-wb-muted text-sm">{habit.description}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isCompleted
              ? 'bg-wb-blue text-white shadow-blue-glow'
              : 'bg-wb-dark border border-wb-border hover:border-wb-blue text-wb-white'
          }`}
        >
          {isCompleted ? '✓ Done Today' : 'Mark Done'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-wb-dark rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-wb-white">{streak}</div>
          <div className="text-xs text-wb-muted">Current streak</div>
        </div>
        <div className="bg-wb-dark rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-wb-white">{longest}</div>
          <div className="text-xs text-wb-muted">Longest streak</div>
        </div>
        <div className="bg-wb-dark rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-wb-white">{completedThisMonth}</div>
          <div className="text-xs text-wb-muted">This month</div>
        </div>
      </div>

      {/* Milestone bar */}
      <StreakMilestoneBar streak={streak} />

      {/* Heatmap */}
      <div>
        <h3 className="text-sm font-semibold text-wb-muted mb-3">12-Week History</h3>
        <CalendarHeatmap habitId={habit.id} completedDates={dates} />
      </div>

      {/* Atomic tip */}
      <div className="bg-wb-dark border border-wb-blue/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-wb-blue-glow" />
          <span className="text-wb-blue-glow text-sm font-semibold">Atomic Tip</span>
        </div>
        <p className="text-wb-muted text-sm leading-relaxed">{habit.atomicTip}</p>
      </div>
    </div>
  );
}

export default function Tracker({ habitData, onToggleHabit }) {
  const today = getTodayKey();
  const habits = Object.values(habitCategories);
  const [selected, setSelected] = useState(habits[0]);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-wb-white">Habit Tracker</h1>
        <p className="text-wb-muted mt-1">Track daily. Measure everything. Never miss twice.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: habit list */}
        <div className="lg:col-span-2 space-y-3">
          {habits.map(habit => {
            const dates = habitData[habit.id]?.completedDates || [];
            const isActive = selected?.id === habit.id;
            return (
              <div
                key={habit.id}
                onClick={() => setSelected(habit)}
                className={`cursor-pointer transition-all duration-200 rounded-2xl border ${
                  isActive
                    ? 'border-wb-blue shadow-blue-glow'
                    : 'border-wb-border hover:border-wb-blue/40'
                }`}
              >
                <HabitCard
                  habit={habit}
                  isCompleted={isHabitCompleted(habit.id, today, habitData)}
                  streak={calculateStreak(dates)}
                  longestStreak={getLongestStreak(dates)}
                  onToggle={(e) => { e?.stopPropagation?.(); onToggleHabit(habit.id); }}
                  showDetails={false}
                />
              </div>
            );
          })}

          {/* Add custom habit CTA */}
          <div className="wb-card p-4 border-dashed">
            <p className="text-wb-muted text-sm text-center">
              Want to track a custom habit?{' '}
              <a href="/goals" className="text-wb-blue-glow hover:underline">
                Create a plan →
              </a>
            </p>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-3">
          {selected ? (
            <HabitDetailPanel
              habit={selected}
              habitData={habitData}
              today={today}
              onToggle={() => onToggleHabit(selected.id)}
            />
          ) : (
            <div className="wb-card p-8 text-center text-wb-muted">
              Select a habit to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
