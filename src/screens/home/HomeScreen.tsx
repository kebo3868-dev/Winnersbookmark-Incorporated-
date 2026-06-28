import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { getDailyQuote } from '../../data/quotes';
import { getProgramById } from '../../data/programs';
import { HABIT_ITEMS } from '../../data/testosterone';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatGoal(goal: string): string {
  return goal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      className="flex-1 min-w-0 flex flex-col items-center justify-center py-3 px-2 rounded-2xl border border-ink-line"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}
    >
      <span className="text-2xl font-black text-paper leading-none">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-mist mt-1 text-center leading-tight">{label}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="eyebrow">{children}</span>
      <div className="flex-1 h-px bg-ink-line" />
    </div>
  );
}

function ThumbnailGridCard({
  icon,
  title,
  subtitle,
  accent = 'gold',
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: 'gold' | 'electric';
  onClick: () => void;
}) {
  const accentColor = accent === 'gold' ? 'rgba(212,175,55,0.25)' : 'rgba(59,130,246,0.25)';
  const borderColor = accent === 'gold' ? 'rgba(212,175,55,0.2)' : 'rgba(59,130,246,0.2)';
  const iconBg = accent === 'gold' ? 'rgba(212,175,55,0.12)' : 'rgba(59,130,246,0.12)';
  const iconText = accent === 'gold' ? 'text-gold' : 'text-electric-glow';

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-2xl border transition-all duration-200 active:scale-[.97] text-left w-full"
      style={{
        background: `linear-gradient(145deg, rgba(15,22,49,0.95) 0%, rgba(8,11,24,0.98) 100%)`,
        borderColor,
        boxShadow: `0 0 0 1px ${borderColor}, 0 8px 24px rgba(0,0,0,0.45)`,
        minHeight: '140px',
      }}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconText}`}
        style={{ background: iconBg, border: `1px solid ${accentColor}` }}
      >
        {icon}
      </div>
      <p className="text-sm font-bold text-paper leading-snug">{title}</p>
      <p className="text-[11px] text-mist mt-1 leading-relaxed">{subtitle}</p>
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { appState, toggleHabit } = useApp();

  const [quoteVisible, setQuoteVisible] = useState(false);

  const quote = useMemo(() => getDailyQuote(), []);
  const streak = appState.progress.streak;
  const { calories, proteinG } = appState.nutritionTargets;

  const completedHabitsCount = useMemo(
    () => Object.values(appState.dailyHabits.habits).filter(Boolean).length,
    [appState.dailyHabits.habits]
  );

  const activeProgram = useMemo(
    () => (appState.activeProgramId ? getProgramById(appState.activeProgramId) : null),
    [appState.activeProgramId]
  );

  const firstWorkoutDay = useMemo(() => {
    if (!activeProgram) return null;
    return activeProgram.workoutDays.find(d => !d.isRestDay) ?? null;
  }, [activeProgram]);

  const workoutHistory = appState.progress.workoutHistory;
  const totalWorkoutsCompleted = workoutHistory.length;

  // Which week of the program are we on?
  const currentWeek = useMemo(() => {
    if (!activeProgram || totalWorkoutsCompleted === 0) return 1;
    return Math.min(
      Math.ceil(totalWorkoutsCompleted / activeProgram.daysPerWeek) + 1,
      activeProgram.durationWeeks
    );
  }, [activeProgram, totalWorkoutsCompleted]);

  const progressPercent = useMemo(() => {
    if (!activeProgram) return 0;
    return Math.round(((currentWeek - 1) / activeProgram.durationWeeks) * 100);
  }, [activeProgram, currentWeek]);

  const displayName = user?.name ? user.name.split(' ')[0] : 'Champion';

  return (
    <div className="max-w-3xl mx-auto px-4 pb-32 pt-5 fade-in">

      {/* ── TOP GREETING ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-mist text-sm font-medium tracking-wide mb-1">{getGreeting()},</p>
        <h1 className="font-display text-3xl font-bold text-paper leading-tight">
          {displayName}.
        </h1>

        {/* Streak badge */}
        <div className="mt-3 inline-flex items-center gap-2">
          {streak > 0 ? (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/40 bg-gold/10"
              style={{ boxShadow: '0 0 12px rgba(212,175,55,0.15)' }}
            >
              <span className="text-base leading-none">🔥</span>
              <span className="text-sm font-bold text-gold-light tracking-tight">
                {streak} Day Streak
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-ink-edge bg-ink-card/60">
              <span className="text-base leading-none">🔥</span>
              <span className="text-sm font-semibold text-chalk">Start Your Streak</span>
            </span>
          )}
        </div>

        {/* Daily quote */}
        <div className="mt-4 pl-3 border-l-2 border-gold/50">
          <p className="text-xs italic text-chalk/80 leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gold/60 mt-1">
            — {quote.author}
          </p>
        </div>
      </div>

      {/* ── QUICK STATS ROW ──────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-6">
        <StatPill value={calories} label="kcal target" />
        <StatPill value={`${proteinG}g`} label="protein" />
        <StatPill value={`${completedHabitsCount}/7`} label="habits today" />
      </div>

      {/* ── TODAY SECTION ────────────────────────────────────────────────── */}
      <SectionHeading>Today</SectionHeading>

      {/* TODAY'S WORKOUT CARD */}
      <div
        className="mb-4 rounded-2xl border overflow-hidden relative"
        style={{
          background: 'linear-gradient(145deg, #0c1226 0%, #080b18 100%)',
          borderColor: 'rgba(212,175,55,0.25)',
          boxShadow: '0 0 0 1px rgba(212,175,55,0.1), 0 12px 40px rgba(0,0,0,0.55)',
          minHeight: '180px',
        }}
      >
        {/* Background glow */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: 'radial-gradient(600px 300px at 80% -20%, rgba(212,175,55,0.12), transparent 70%)',
          }}
        />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="eyebrow mb-1">Today's Workout</p>
              {activeProgram && firstWorkoutDay ? (
                <>
                  <h3 className="text-lg font-bold text-paper leading-tight">{firstWorkoutDay.name}</h3>
                  <p className="text-sm text-mist mt-0.5">{activeProgram.name}</p>
                </>
              ) : (
                <h3 className="text-lg font-bold text-paper">Choose a Program</h3>
              )}
            </div>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)' }}
            >
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
          </div>

          {activeProgram && firstWorkoutDay ? (
            <>
              {/* Stats row */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="chip">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  </svg>
                  {firstWorkoutDay.estimatedDurationMin} min
                </span>
                {firstWorkoutDay.focusMuscles.slice(0, 3).map(m => (
                  <span key={m} className="chip-gold">{capitalize(m)}</span>
                ))}
              </div>
              <button
                className="btn-gold text-sm font-bold px-6"
                onClick={() => navigate('/training/workout', { state: { workoutDayId: firstWorkoutDay.id, programId: activeProgram.id } })}
              >
                Begin Workout
              </button>
            </>
          ) : (
            <button
              className="btn-gold text-sm font-bold"
              onClick={() => navigate('/training')}
            >
              Browse Programs
            </button>
          )}
        </div>
      </div>

      {/* DAILY HABITS CARD */}
      <div
        className="mb-6 rounded-2xl border overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(15,22,49,0.95) 0%, rgba(8,11,24,0.98) 100%)',
          borderColor: 'rgba(59,130,246,0.2)',
          boxShadow: '0 0 0 1px rgba(59,130,246,0.08), 0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="eyebrow mb-0.5">Daily Habits</p>
              <p className="text-xs text-mist">{completedHabitsCount} of 7 complete</p>
            </div>
            {/* Progress ring — simple fraction indicator */}
            <div className="text-right">
              <span className="text-2xl font-black text-paper">{completedHabitsCount}</span>
              <span className="text-sm text-mist">/7</span>
            </div>
          </div>

          {/* Habits list */}
          <div className="flex flex-col gap-2">
            {HABIT_ITEMS.map(habit => {
              const done = appState.dailyHabits.habits[habit.id] ?? false;
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: done ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${done ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: done ? 'linear-gradient(135deg, #f5d061, #d4af37)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${done ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    }}
                  >
                    {done && (
                      <svg className="w-3 h-3 text-ink-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-base leading-none">{habit.icon}</span>
                  <span className={`text-sm font-medium leading-none ${done ? 'text-gold-light line-through opacity-70' : 'text-chalk'}`}>
                    {habit.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── YOUR PROGRAM SECTION ─────────────────────────────────────────── */}
      <SectionHeading>Your Program</SectionHeading>

      {activeProgram ? (
        <div
          className="mb-6 rounded-2xl border overflow-hidden relative"
          style={{
            background: 'linear-gradient(145deg, #0c1226 0%, #080b18 100%)',
            borderColor: 'rgba(212,175,55,0.22)',
            boxShadow: '0 0 0 1px rgba(212,175,55,0.08), 0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="eyebrow mb-1">My Plan</p>
                <h3 className="text-base font-bold text-paper leading-tight truncate">{activeProgram.name}</h3>
                <p className="text-xs text-mist mt-0.5">
                  Week {currentWeek} of {activeProgram.durationWeeks} · {activeProgram.daysPerWeek} days/week
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="chip-gold text-[10px]">{capitalize(activeProgram.level)}</span>
                <span className="chip text-[10px]">{formatGoal(activeProgram.goal)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-mist">Program Progress</span>
                <span className="text-[11px] font-semibold text-gold">{progressPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-line overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #d4af37, #f5d061)',
                  }}
                />
              </div>
            </div>

            <button
              className="btn-ghost text-sm"
              onClick={() => navigate('/training')}
            >
              View Full Program
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mb-6 rounded-2xl border border-dashed border-ink-edge p-6 text-center"
          style={{ background: 'rgba(15,22,49,0.5)' }}
        >
          <p className="text-base font-bold text-chalk mb-1">No Active Program</p>
          <p className="text-xs text-mist mb-4 leading-relaxed">Select a program to start structured training and track your progress.</p>
          <button className="btn-gold text-sm" onClick={() => navigate('/training')}>
            Choose Your Program
          </button>
        </div>
      )}

      {/* ── THUMBNAIL GRID ───────────────────────────────────────────────── */}
      <SectionHeading>Explore</SectionHeading>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <ThumbnailGridCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          }
          title="Nutrition"
          subtitle="Eat for your goals"
          accent="gold"
          onClick={() => navigate('/nutrition')}
        />
        <ThumbnailGridCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
          title="Testosterone"
          subtitle="Lifestyle habits"
          accent="electric"
          onClick={() => navigate('/testosterone')}
        />
        <ThumbnailGridCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
          title="Progress"
          subtitle="Track your gains"
          accent="electric"
          onClick={() => navigate('/progress')}
        />
        <ThumbnailGridCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          }
          title="Exercise Library"
          subtitle="500+ exercises"
          accent="gold"
          onClick={() => navigate('/library')}
        />
        <ThumbnailGridCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          }
          title="Recovery"
          subtitle="Mobility & rest"
          accent="electric"
          onClick={() => navigate('/testosterone')}
        />
        <ThumbnailGridCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          }
          title="Coach Tips"
          subtitle={quote.text.slice(0, 40) + '…'}
          accent="gold"
          onClick={() => setQuoteVisible(v => !v)}
        />
      </div>

      {/* Quote modal overlay */}
      {quoteVisible && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: 'rgba(5,6,13,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setQuoteVisible(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-gold/30 fade-in"
            style={{ background: 'linear-gradient(180deg, #0f1631 0%, #080b18 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="eyebrow mb-4 text-center">Today's Insight</p>
            <p className="text-base font-medium text-paper leading-relaxed text-center italic mb-3">
              &ldquo;{quote.text}&rdquo;
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold text-center">— {quote.author}</p>
            <button
              className="btn-ghost w-full mt-5 text-sm"
              onClick={() => setQuoteVisible(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── MOTIVATIONAL FOOTER ──────────────────────────────────────────── */}
      <div className="rule-gold mb-6" />
      <div className="text-center pb-2">
        <p
          className="text-gradient-gold font-black tracking-[0.22em] text-sm uppercase"
        >
          WINNERS BOOKMARK
        </p>
        <p className="text-ghost text-[10px] tracking-wider mt-1">
          Designed by Winners Bookmark Incorporated
        </p>
      </div>
    </div>
  );
}
