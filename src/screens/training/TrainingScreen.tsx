import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { PROGRAMS, getProgramById } from '../../data/programs';
import PremiumGate from '../../components/PremiumGate';
import ScreenHeader from '../../components/ScreenHeader';
import type { Program } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatGoal(goal: string): string {
  return goal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function levelColor(level: string): string {
  if (level === 'beginner') return 'chip-blue';
  if (level === 'advanced') return 'chip-gold';
  return 'chip';
}

// ─── Program Card ───────────────────────────────────────────────────────────

interface ProgramCardProps {
  program: Program;
  isActive: boolean;
  onSelect: () => void;
  onContinue: () => void;
}

function ProgramCard({ program, isActive, onSelect, onContinue }: ProgramCardProps) {
  const borderStyle = isActive
    ? { borderColor: 'rgba(212,175,55,0.55)', boxShadow: '0 0 0 1px rgba(212,175,55,0.2), 0 12px 40px rgba(0,0,0,0.55)' }
    : { borderColor: 'rgba(28,37,71,0.9)', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' };

  const nextWorkoutDay = program.workoutDays.find(d => !d.isRestDay);

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all duration-200"
      style={{
        background: 'linear-gradient(180deg, rgba(12,18,38,0.97) 0%, rgba(8,11,24,0.99) 100%)',
        ...borderStyle,
      }}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isActive && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)', color: '#f5d061' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />
                  Active
                </span>
              )}
              {program.isPremium && (
                <span className="chip-gold text-[10px]">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  Premium
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-paper leading-tight">{program.name}</h3>
          </div>
          {program.isPremium && !isActive && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)' }}
            >
              <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-mist leading-relaxed mb-3 line-clamp-2">{program.description}</p>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={levelColor(program.level)}>{capitalize(program.level)}</span>
          <span className="chip">{formatGoal(program.goal)}</span>
          <span className="chip">{program.daysPerWeek}d/week</span>
          <span className="chip">{program.durationWeeks}wk</span>
          <span className="chip">{capitalize(program.location)}</span>
        </div>

        {/* Active program extras */}
        {isActive && nextWorkoutDay && (
          <div
            className="flex items-center gap-2 py-2 px-3 rounded-xl mb-4"
            style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.15)' }}
          >
            <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <div>
              <p className="text-[10px] text-mist uppercase tracking-widest">Next Up</p>
              <p className="text-xs font-semibold text-chalk">{nextWorkoutDay.name}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isActive ? (
          <div className="flex gap-2">
            <button
              className="btn-gold flex-1 text-sm"
              onClick={onContinue}
            >
              Continue Program
            </button>
            <button
              className="btn-ghost text-sm px-3"
              onClick={onSelect}
            >
              Details
            </button>
          </div>
        ) : program.isPremium ? (
          <PremiumGate feature={program.name} />
        ) : (
          <button
            className="btn-ghost w-full text-sm"
            onClick={onSelect}
          >
            Start Program
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TrainingScreen() {
  const navigate = useNavigate();
  const { appState, setActiveProgram } = useApp();

  const activeProgram = useMemo(
    () => (appState.activeProgramId ? getProgramById(appState.activeProgramId) : null),
    [appState.activeProgramId]
  );

  const freePrograms = PROGRAMS.filter(p => !p.isPremium);
  const premiumPrograms = PROGRAMS.filter(p => p.isPremium);

  const firstWorkoutDay = useMemo(() => {
    if (!activeProgram) return null;
    return activeProgram.workoutDays.find(d => !d.isRestDay) ?? null;
  }, [activeProgram]);

  function handleStartProgram(programId: string) {
    setActiveProgram(programId);
    const prog = PROGRAMS.find(p => p.id === programId);
    const firstDay = prog?.workoutDays.find(d => !d.isRestDay);
    if (prog && firstDay) {
      navigate('/training/workout', { state: { workoutDayId: firstDay.id, programId: prog.id } });
    }
  }

  function handleContinue() {
    if (activeProgram && firstWorkoutDay) {
      navigate('/training/workout', {
        state: { workoutDayId: firstWorkoutDay.id, programId: activeProgram.id },
      });
    }
  }

  return (
    <div className="fade-in">
      <ScreenHeader
        eyebrow="Training"
        title="Your Programs"
        subtitle={
          activeProgram
            ? `Active: ${activeProgram.name}`
            : 'Select a program to begin structured training'
        }
      />

      <div className="max-w-3xl mx-auto px-4 pb-32 pt-5">

        {/* ── ACTIVE PROGRAM SPOTLIGHT ─────────────────────────────────── */}
        {activeProgram && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Current Program</span>
              <div className="flex-1 h-px bg-ink-line" />
            </div>

            <div
              className="rounded-2xl border overflow-hidden relative"
              style={{
                background: 'linear-gradient(145deg, #0c1226 0%, #05060d 100%)',
                borderColor: 'rgba(212,175,55,0.4)',
                boxShadow: '0 0 0 1px rgba(212,175,55,0.15), 0 16px 48px rgba(0,0,0,0.6)',
              }}
            >
              {/* Gold glow accent */}
              <div
                className="absolute top-0 right-0 w-64 h-32 pointer-events-none"
                style={{
                  background: 'radial-gradient(400px 200px at 80% 0%, rgba(212,175,55,0.12), transparent 70%)',
                }}
              />

              <div className="relative p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="eyebrow mb-1">Active Program</p>
                    <h2 className="text-xl font-black text-paper leading-tight">{activeProgram.name}</h2>
                    <p className="text-sm text-mist mt-1">{activeProgram.description.slice(0, 80)}…</p>
                  </div>
                </div>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={levelColor(activeProgram.level)}>{capitalize(activeProgram.level)}</span>
                  <span className="chip">{formatGoal(activeProgram.goal)}</span>
                  <span className="chip">{activeProgram.daysPerWeek} days/week</span>
                  <span className="chip">{activeProgram.durationWeeks} weeks</span>
                </div>

                {/* Next workout */}
                {firstWorkoutDay && (
                  <div
                    className="flex items-center gap-3 py-3 px-4 rounded-xl mb-4"
                    style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}
                  >
                    <svg className="w-5 h-5 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-mist font-semibold">Next Workout</p>
                      <p className="text-sm font-bold text-chalk">{firstWorkoutDay.name}</p>
                      <p className="text-[11px] text-mist">{firstWorkoutDay.estimatedDurationMin} min · {firstWorkoutDay.exerciseBlocks.length} exercises</p>
                    </div>
                  </div>
                )}

                <button
                  className="btn-gold w-full text-sm font-bold"
                  onClick={handleContinue}
                >
                  Continue Program
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── FREE PROGRAMS LIST ───────────────────────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">All Programs</span>
            <div className="flex-1 h-px bg-ink-line" />
          </div>

          <div className="flex flex-col gap-4">
            {freePrograms.map(program => (
              <ProgramCard
                key={program.id}
                program={program}
                isActive={appState.activeProgramId === program.id}
                onSelect={() => handleStartProgram(program.id)}
                onContinue={handleContinue}
              />
            ))}
          </div>
        </section>

        {/* ── PREMIUM PROGRAMS ─────────────────────────────────────────── */}
        {premiumPrograms.length > 0 && (
          <section className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Premium Programs</span>
              <div className="flex-1 h-px bg-ink-line" />
              <span className="chip-gold text-[10px]">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                Premium
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {premiumPrograms.map(program => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isActive={appState.activeProgramId === program.id}
                  onSelect={() => {}}
                  onContinue={handleContinue}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
