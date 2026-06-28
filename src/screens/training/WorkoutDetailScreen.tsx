import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getProgramById } from '../../data/programs';
import { getExerciseById } from '../../data/exercises';
import ScreenHeader from '../../components/ScreenHeader';
import type { WorkoutDay, Program, ExerciseSet } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRestTime(sec: number): string {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60 > 0 ? `${sec % 60}s` : ''}`.trim();
  return `${sec}s`;
}

// ─── Sets Table ──────────────────────────────────────────────────────────────
function SetsTable({ sets }: { sets: ExerciseSet[] }) {
  return (
    <div className="rounded-xl overflow-hidden border border-ink-line">
      <div
        className="grid grid-cols-3 px-3 py-2 border-b border-ink-line"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-mist">Set</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-mist">Reps</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-mist">Rest</span>
      </div>
      {sets.map(set => (
        <div
          key={set.setNumber}
          className="grid grid-cols-3 px-3 py-2.5 border-b border-ink-line/50 last:border-0"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          <span className="text-sm font-bold text-paper">{set.setNumber}</span>
          <span className="text-sm font-semibold text-chalk">{set.reps}</span>
          <span className="text-xs text-mist">{formatRestTime(set.restSeconds)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Exercise Block Card ────────────────────────────────────────────────────
interface ExerciseBlockCardProps {
  exerciseId: string;
  sets: ExerciseSet[];
  index: number;
  isCompleted: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
}

function ExerciseBlockCard({
  exerciseId,
  sets,
  index,
  isCompleted,
  onToggle,
  onViewDetail,
}: ExerciseBlockCardProps) {
  const exercise = getExerciseById(exerciseId);
  const [expanded, setExpanded] = useState(false);

  if (!exercise) {
    return (
      <div className="glass p-4 rounded-2xl mb-3">
        <p className="text-sm text-mist">Exercise not found: {exerciseId}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden mb-3 transition-all duration-200"
      style={{
        background: isCompleted
          ? 'linear-gradient(180deg, rgba(16,185,129,0.06) 0%, rgba(8,11,24,0.98) 100%)'
          : 'linear-gradient(180deg, rgba(12,18,38,0.95) 0%, rgba(8,11,24,0.98) 100%)',
        borderColor: isCompleted ? 'rgba(16,185,129,0.25)' : 'rgba(28,37,71,0.9)',
      }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Index */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
            style={{
              background: isCompleted ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: isCompleted ? '#10b981' : '#cbd2e0',
            }}
          >
            {isCompleted ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              index + 1
            )}
          </div>

          {/* Name + chips */}
          <div className="flex-1 min-w-0">
            <button
              className="text-left w-full"
              onClick={onViewDetail}
            >
              <h4 className="text-sm font-bold text-paper leading-tight hover:text-gold transition-colors">
                {exercise.name}
              </h4>
            </button>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="chip-gold text-[10px]">{capitalize(exercise.muscleGroup)}</span>
              {exercise.equipment.slice(0, 2).map(eq => (
                <span key={eq} className="chip text-[10px]">{capitalize(eq.replace(/_/g, ' '))}</span>
              ))}
            </div>
          </div>

          {/* Toggle expand */}
          <button
            className="icon-btn w-8 h-8 shrink-0"
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Collapsed summary */}
        {!expanded && (
          <div className="flex items-center gap-4 pl-11">
            <span className="text-xs text-mist">{sets.length} sets</span>
            <span className="text-xs text-mist">·</span>
            <span className="text-xs text-mist">{sets[0]?.reps} reps</span>
            <span className="text-xs text-mist">·</span>
            <span className="text-xs text-mist">{formatRestTime(sets[0]?.restSeconds ?? 60)} rest</span>
          </div>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="pl-0 mt-3 slide-up">
            <SetsTable sets={sets} />
            <div className="flex gap-2 mt-3">
              <button
                className="btn-ghost flex-1 text-xs py-2"
                onClick={onViewDetail}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Demo
              </button>
            </div>
          </div>
        )}

        {/* Completion toggle */}
        <button
          onClick={onToggle}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-all duration-150 active:scale-[.98] text-xs font-semibold"
          style={{
            background: isCompleted ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: isCompleted ? '#10b981' : '#8893ad',
          }}
        >
          {isCompleted ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
              </svg>
              Mark Complete
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appState, completeWorkout } = useApp();

  // Resolve workout from navigation state or fall back to active program's first day
  const { workoutDayId, programId } = (location.state as { workoutDayId?: string; programId?: string }) ?? {};

  const resolvedProgramId = programId ?? appState.activeProgramId ?? '';
  const program: Program | undefined = getProgramById(resolvedProgramId);

  const workoutDay: WorkoutDay | undefined = useMemo(() => {
    if (!program) return undefined;
    if (workoutDayId) {
      return program.workoutDays.find(d => d.id === workoutDayId);
    }
    return program.workoutDays.find(d => !d.isRestDay);
  }, [program, workoutDayId]);

  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [completedWarmUp, setCompletedWarmUp] = useState<Set<number>>(new Set());
  const [completedCoolDown, setCompletedCoolDown] = useState<Set<number>>(new Set());
  const [workoutDone, setWorkoutDone] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Timer
  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerActive]);

  function formatElapsed(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function toggleExercise(id: string) {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCompleteWorkout() {
    if (!workoutDay || !program) return;
    const durationMin = Math.max(1, Math.round(elapsedSec / 60)) || workoutDay.estimatedDurationMin;
    completeWorkout(workoutDay.id, program.id, workoutDay.name, durationMin);
    setWorkoutDone(true);
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!workoutDay || !program) {
    return (
      <div className="fade-in">
        <ScreenHeader title="Workout" showBack />
        <div className="max-w-3xl mx-auto px-4 pt-12 pb-32 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            <svg className="w-8 h-8 text-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-chalk mb-2">No Workout Selected</h2>
          <p className="text-sm text-mist mb-6 leading-relaxed">
            Select a program and a workout day to get started.
          </p>
          <button className="btn-gold text-sm" onClick={() => navigate('/training')}>
            Browse Programs
          </button>
        </div>
      </div>
    );
  }

  const allExercisesCount = workoutDay.exerciseBlocks.length;
  const completedExercisesCount = completedExercises.size;

  return (
    <div className="fade-in">
      <ScreenHeader
        showBack
        title={workoutDay.name}
        subtitle={program.name}
        eyebrow="Workout"
      />

      <div className="max-w-3xl mx-auto px-4 pb-32 pt-5">

        {/* ── SUCCESS STATE ─────────────────────────────────────────────── */}
        {workoutDone && (
          <div
            className="mb-6 rounded-2xl border p-6 text-center slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.1) 0%, rgba(8,11,24,0.98) 100%)',
              borderColor: 'rgba(16,185,129,0.35)',
              boxShadow: '0 0 32px rgba(16,185,129,0.15)',
            }}
          >
            <div className="text-4xl mb-3">🔥</div>
            <h2 className="text-xl font-black text-paper mb-1">Workout Complete!</h2>
            <p className="text-sm text-mist mb-1">
              {workoutDay.name} · {formatElapsed(elapsedSec)} elapsed
            </p>
            <p className="text-xs text-success font-semibold mb-4">Streak updated. Keep the momentum.</p>
            <button
              className="btn-ghost text-sm"
              onClick={() => navigate('/training')}
            >
              Back to Programs
            </button>
          </div>
        )}

        {/* ── TOP CARD ──────────────────────────────────────────────────── */}
        <div
          className="mb-6 rounded-2xl border overflow-hidden relative"
          style={{
            background: 'linear-gradient(145deg, #0c1226 0%, #05060d 100%)',
            borderColor: 'rgba(212,175,55,0.3)',
            boxShadow: '0 0 0 1px rgba(212,175,55,0.1), 0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-48 h-24 pointer-events-none"
            style={{
              background: 'radial-gradient(300px 150px at 100% 0%, rgba(212,175,55,0.1), transparent 70%)',
            }}
          />
          <div className="relative p-5">
            <h2 className="text-2xl font-black text-paper leading-tight mb-1">{workoutDay.name}</h2>
            <p className="text-sm italic text-mist leading-relaxed mb-4">{workoutDay.goal}</p>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="chip">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                {workoutDay.estimatedDurationMin} min
              </span>
              <span className="chip">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                {allExercisesCount} exercises
              </span>
              {workoutDay.focusMuscles.slice(0, 3).map(m => (
                <span key={m} className="chip-gold text-[10px]">{capitalize(m)}</span>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-mist">{completedExercisesCount} / {allExercisesCount} exercises done</span>
                {timerActive && (
                  <span className="text-[11px] font-mono text-gold">{formatElapsed(elapsedSec)}</span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-ink-line overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${allExercisesCount > 0 ? (completedExercisesCount / allExercisesCount) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                  }}
                />
              </div>
            </div>

            {!workoutDone && (
              <button
                className="btn-gold w-full text-sm font-bold"
                onClick={() => {
                  if (!timerActive) setTimerActive(true);
                }}
              >
                {timerActive ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                    Timer Running — {formatElapsed(elapsedSec)}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Begin Workout
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── WARM-UP SECTION ───────────────────────────────────────────── */}
        {workoutDay.warmUp.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Warm-Up</span>
              <div className="flex-1 h-px bg-ink-line" />
              <span className="text-[10px] text-mist">{workoutDay.warmUp.length} items</span>
            </div>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'rgba(12,18,38,0.6)',
                borderColor: 'rgba(28,37,71,0.8)',
              }}
            >
              {workoutDay.warmUp.map((item, i) => {
                const done = completedWarmUp.has(i);
                return (
                  <button
                    key={i}
                    onClick={() =>
                      setCompletedWarmUp(prev => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-ink-line/50 last:border-0 transition-colors text-left"
                    style={{ background: done ? 'rgba(16,185,129,0.05)' : 'transparent' }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      }}
                    >
                      {done && (
                        <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${done ? 'text-mist line-through' : 'text-chalk'}`}>{item}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── EXERCISE BLOCKS ───────────────────────────────────────────── */}
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Exercises</span>
            <div className="flex-1 h-px bg-ink-line" />
            <span className="text-[10px] text-mist">{allExercisesCount} blocks</span>
          </div>

          {workoutDay.exerciseBlocks.map((block, i) => (
            <ExerciseBlockCard
              key={block.exerciseId + i}
              exerciseId={block.exerciseId}
              sets={block.sets}
              index={i}
              isCompleted={completedExercises.has(block.exerciseId)}
              onToggle={() => toggleExercise(block.exerciseId)}
              onViewDetail={() => navigate(`/training/exercise/${block.exerciseId}`)}
            />
          ))}
        </section>

        {/* ── COOL-DOWN SECTION ─────────────────────────────────────────── */}
        {workoutDay.coolDown.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Cool-Down</span>
              <div className="flex-1 h-px bg-ink-line" />
            </div>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'rgba(12,18,38,0.6)',
                borderColor: 'rgba(28,37,71,0.8)',
              }}
            >
              {workoutDay.coolDown.map((item, i) => {
                const done = completedCoolDown.has(i);
                return (
                  <button
                    key={i}
                    onClick={() =>
                      setCompletedCoolDown(prev => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-ink-line/50 last:border-0 transition-colors text-left"
                    style={{ background: done ? 'rgba(59,130,246,0.05)' : 'transparent' }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: done ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${done ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      }}
                    >
                      {done && (
                        <svg className="w-3 h-3 text-electric-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${done ? 'text-mist line-through' : 'text-chalk'}`}>{item}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── COMPLETE WORKOUT BUTTON ───────────────────────────────────── */}
        {!workoutDone && (
          <div
            className="rounded-2xl border p-5"
            style={{
              background: 'linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(8,11,24,0.98) 100%)',
              borderColor: 'rgba(212,175,55,0.2)',
            }}
          >
            <p className="text-xs text-mist text-center mb-4 leading-relaxed">
              Mark all exercises complete and record this session in your history.
            </p>
            <button
              className="btn-gold w-full text-sm font-bold"
              onClick={handleCompleteWorkout}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Mark Workout Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
