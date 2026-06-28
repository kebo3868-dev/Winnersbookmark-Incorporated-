import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getExerciseById } from '../../data/exercises';
import ScreenHeader from '../../components/ScreenHeader';
import VideoPlaceholder from '../../components/VideoPlaceholder';
import type { ExerciseSet } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatEquipment(eq: string): string {
  return capitalize(eq.replace(/_/g, ' '));
}

function formatRestTime(sec: number): string {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60 > 0 ? `${sec % 60}s` : ''}`.trim();
  return `${sec}s`;
}

function difficultyColor(level: string): string {
  if (level === 'beginner') return 'chip-blue';
  if (level === 'advanced') return 'chip-gold';
  return 'chip';
}

// ─── Accordion Section ───────────────────────────────────────────────────────
function AccordionSection({
  title,
  accent,
  defaultOpen,
  children,
}: {
  title: string;
  accent?: 'gold' | 'electric' | 'success' | 'danger' | 'none';
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const borderAccent: Record<string, string> = {
    gold: 'rgba(212,175,55,0.3)',
    electric: 'rgba(59,130,246,0.3)',
    success: 'rgba(16,185,129,0.3)',
    danger: 'rgba(239,68,68,0.3)',
    none: 'rgba(28,37,71,0.8)',
  };

  const headerAccent: Record<string, string> = {
    gold: 'rgba(212,175,55,0.06)',
    electric: 'rgba(59,130,246,0.06)',
    success: 'rgba(16,185,129,0.06)',
    danger: 'rgba(239,68,68,0.06)',
    none: 'rgba(255,255,255,0.02)',
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden mb-3"
      style={{
        background: 'linear-gradient(180deg, rgba(12,18,38,0.95) 0%, rgba(8,11,24,0.98) 100%)',
        borderColor: borderAccent[accent ?? 'none'],
      }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left"
        style={{ background: open ? headerAccent[accent ?? 'none'] : 'transparent' }}
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-sm font-bold text-paper">{title}</span>
        <svg
          className={`w-4 h-4 text-mist transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-ink-line/40 pt-3 slide-up">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── PR Modal ────────────────────────────────────────────────────────────────
interface PRModalProps {
  exerciseName: string;
  exerciseId: string;
  onClose: () => void;
  onLog: (exerciseId: string, exerciseName: string, weightKg: number, reps: number) => void;
}

function PRModal({ exerciseName, exerciseId, onClose, onLog }: PRModalProps) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit() {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || w <= 0) {
      setError('Enter a valid weight.');
      return;
    }
    if (isNaN(r) || r <= 0) {
      setError('Enter a valid rep count.');
      return;
    }
    onLog(exerciseId, exerciseName, w, r);
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(5,6,13,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border overflow-hidden fade-in"
        style={{
          background: 'linear-gradient(180deg, #0f1631 0%, #080b18 100%)',
          borderColor: 'rgba(212,175,55,0.3)',
          boxShadow: '0 0 32px rgba(212,175,55,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🏆</div>
              <h3 className="text-lg font-bold text-paper mb-1">PR Logged!</h3>
              <p className="text-sm text-mist mb-4">
                {exerciseName} — {weight}kg × {reps} reps
              </p>
              <button className="btn-gold w-full text-sm" onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <p className="eyebrow mb-1">Log Personal Record</p>
              <h3 className="text-base font-bold text-paper mb-4">{exerciseName}</h3>

              {error && (
                <div className="mb-3 px-3 py-2 rounded-lg border border-danger/40 bg-danger/10">
                  <p className="text-xs text-danger">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 mb-5">
                <div>
                  <label className="label">Weight (kg)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={weight}
                    min="0"
                    onChange={e => { setWeight(e.target.value); setError(''); }}
                  />
                </div>
                <div>
                  <label className="label">Reps</label>
                  <input
                    type="number"
                    placeholder="e.g. 5"
                    value={reps}
                    min="1"
                    onChange={e => { setReps(e.target.value); setError(''); }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button className="btn-ghost flex-1 text-sm" onClick={onClose}>Cancel</button>
                <button className="btn-gold flex-1 text-sm" onClick={handleSubmit}>Log PR</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
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
        >
          <span className="text-sm font-bold text-paper">{set.setNumber}</span>
          <span className="text-sm font-semibold text-chalk">{set.reps}</span>
          <span className="text-xs text-mist">{formatRestTime(set.restSeconds)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 2500);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl border border-gold/30 shadow-gold fade-in"
      style={{ background: 'rgba(15,22,49,0.97)', backdropFilter: 'blur(12px)' }}
    >
      <p className="text-sm font-semibold text-gold-light whitespace-nowrap">{message}</p>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ExerciseDetailScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { addRecentlyViewed, logPR } = useApp();

  const [showPRModal, setShowPRModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const exercise = exerciseId ? getExerciseById(exerciseId) : undefined;

  // Track recently viewed
  useEffect(() => {
    if (exercise?.id) {
      addRecentlyViewed(exercise.id);
    }
  }, [exercise?.id, addRecentlyViewed]);

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!exercise) {
    return (
      <div className="fade-in">
        <ScreenHeader title="Exercise" showBack />
        <div className="max-w-3xl mx-auto px-4 pt-12 pb-32 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <svg className="w-8 h-8 text-danger/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-chalk mb-2">Exercise Not Found</h2>
          <p className="text-sm text-mist mb-6 leading-relaxed">
            This exercise could not be found. It may have been removed or the link is invalid.
          </p>
          <button className="btn-ghost text-sm" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <ScreenHeader
        showBack
        title={exercise.name}
        eyebrow={capitalize(exercise.muscleGroup)}
      />

      <div className="max-w-3xl mx-auto px-4 pb-32 pt-5">

        {/* ── VIDEO DEMO ───────────────────────────────────────────────────── */}
        <div className="mb-5">
          <VideoPlaceholder
            exerciseName={exercise.name}
            videoUrl={exercise.videoUrl}
            thumbnailUrl={exercise.thumbnailUrl}
            durationSec={exercise.videoDurationSec}
          />
        </div>

        {/* ── KEY INFO ROW ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Target muscle */}
          <span className="chip-gold">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            {capitalize(exercise.muscleGroup)}
          </span>
          {/* Secondary muscles */}
          {exercise.secondaryMuscles.map(m => (
            <span key={m} className="chip-blue text-[10px]">{m}</span>
          ))}
          {/* Equipment */}
          {exercise.equipment.map(eq => (
            <span key={eq} className="chip text-[10px]">{formatEquipment(eq)}</span>
          ))}
          {/* Difficulty */}
          <span className={difficultyColor(exercise.difficulty)}>
            {capitalize(exercise.difficulty)}
          </span>
        </div>

        {/* ── FORM INSTRUCTIONS ────────────────────────────────────────────── */}
        <AccordionSection title="Form Instructions" accent="gold" defaultOpen>
          <ol className="flex flex-col gap-3">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                  style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#f5d061' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm text-chalk leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </AccordionSection>

        {/* ── COMMON MISTAKES ───────────────────────────────────────────────── */}
        <AccordionSection title="Common Mistakes" accent="danger">
          <ul className="flex flex-col gap-2.5">
            {exercise.commonMistakes.map((mistake, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span className="text-base shrink-0 leading-none mt-0.5">❌</span>
                <p className="text-sm text-chalk leading-relaxed">{mistake}</p>
              </li>
            ))}
          </ul>
        </AccordionSection>

        {/* ── BREATHING ────────────────────────────────────────────────────── */}
        <AccordionSection title="Breathing" accent="electric">
          <p className="text-sm text-chalk leading-relaxed">{exercise.breathingCues}</p>
        </AccordionSection>

        {/* ── TEMPO ────────────────────────────────────────────────────────── */}
        {exercise.tempo && (
          <AccordionSection title="Tempo" accent="electric">
            <div
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <svg className="w-4 h-4 text-electric-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span className="text-sm font-mono font-semibold text-electric-glow">{exercise.tempo}</span>
            </div>
          </AccordionSection>
        )}

        {/* ── BEGINNER MODIFICATION ─────────────────────────────────────────── */}
        <AccordionSection title="Beginner Modification" accent="success">
          <div className="flex gap-2.5 items-start">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </span>
            <p className="text-sm text-chalk leading-relaxed">{exercise.beginnerMod}</p>
          </div>
        </AccordionSection>

        {/* ── ADVANCED PROGRESSION ─────────────────────────────────────────── */}
        <AccordionSection title="Advanced Progression" accent="gold">
          <div className="flex gap-2.5 items-start">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.35)' }}
            >
              <svg className="w-3 h-3 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </span>
            <p className="text-sm text-chalk leading-relaxed">{exercise.advancedProg}</p>
          </div>
        </AccordionSection>

        {/* ── RECOMMENDED SETS TABLE ────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Recommended Sets</span>
            <div className="flex-1 h-px bg-ink-line" />
          </div>
          <SetsTable sets={exercise.defaultSets} />
        </div>

        {/* ── BOTTOM ACTIONS ────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{
            background: 'linear-gradient(180deg, rgba(212,175,55,0.04) 0%, rgba(8,11,24,0.98) 100%)',
            borderColor: 'rgba(212,175,55,0.18)',
          }}
        >
          <button
            className="btn-gold w-full text-sm font-bold"
            onClick={() => setToast('Added to custom workout')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add to Workout
          </button>
          <button
            className="btn-ghost w-full text-sm"
            onClick={() => setShowPRModal(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.25 9.71 2 12 2c2.291 0 4.545.25 6.75.721v1.515M12 10.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
            </svg>
            Log PR for this Exercise
          </button>
        </div>

        {/* Tags */}
        {exercise.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5">
            {exercise.tags.map(tag => (
              <span key={tag} className="chip text-[10px]">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── PR MODAL ──────────────────────────────────────────────────────── */}
      {showPRModal && (
        <PRModal
          exerciseName={exercise.name}
          exerciseId={exercise.id}
          onClose={() => setShowPRModal(false)}
          onLog={(id, name, w, r) => {
            logPR(id, name, w, r);
            setShowPRModal(false);
          }}
        />
      )}

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
