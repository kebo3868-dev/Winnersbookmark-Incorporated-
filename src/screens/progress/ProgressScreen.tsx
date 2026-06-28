import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import ScreenHeader from '../../components/ScreenHeader';
import type { WeightEntry, WorkoutCompletion, PREntry } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function isThisMonth(dateStr: string): boolean {
  return dateStr.startsWith(getCurrentMonthKey());
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  children: React.ReactNode;
}

function SummaryCard({ label, children }: SummaryCardProps) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col items-center justify-center gap-1 text-center">
      <div className="text-2xl font-bold leading-tight">{children}</div>
      <p className="label text-mist text-xs mt-1">{label}</p>
    </div>
  );
}

// ─── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;

  const sorted = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  const weights = sorted.map(e => e.weightKg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const MIN_H = 8;
  const MAX_H = 48;

  return (
    <div className="flex items-end gap-1 mb-4 h-14">
      {sorted.map((entry, i) => {
        const normalised = (entry.weightKg - minW) / range;
        const height = MIN_H + normalised * (MAX_H - MIN_H);
        return (
          <div
            key={entry.id ?? i}
            className="bg-gold rounded-sm w-2 shrink-0"
            style={{ height: `${height}px` }}
            title={`${entry.date}: ${entry.weightKg}kg`}
          />
        );
      })}
    </div>
  );
}

// ─── Weight Log Section ──────────────────────────────────────────────────────

interface WeightLogSectionProps {
  weightLog: WeightEntry[];
  logWeight: (weightKg: number, notes?: string) => void;
}

function WeightLogSection({ weightLog, logWeight }: WeightLogSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightNotes, setWeightNotes] = useState('');

  const sorted = [...weightLog]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) return;
    logWeight(val, weightNotes.trim() || undefined);
    setWeightInput('');
    setWeightNotes('');
    setShowForm(false);
  }

  return (
    <div className="glass rounded-xl card-pad">
      <h2 className="section-title mb-4">Body Weight</h2>

      {weightLog.length === 0 ? (
        <p className="empty">No weight entries yet. Log your first entry below.</p>
      ) : (
        <>
          <Sparkline entries={weightLog} />
          <div className="space-y-0">
            {sorted.map((entry, i) => (
              <React.Fragment key={entry.id}>
                {i > 0 && <div className="divider" />}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-mist">{formatDate(entry.date)}</span>
                    {entry.notes && (
                      <span className="text-xs text-ghost mt-0.5 italic">{entry.notes}</span>
                    )}
                  </div>
                  <span className="font-semibold text-paper">{entry.weightKg} kg</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      <div className="mt-4">
        {!showForm ? (
          <button
            className="btn-ghost text-sm"
            onClick={() => setShowForm(true)}
          >
            + Log Weight
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-3">
            <input
              className="field w-full"
              type="number"
              step="0.1"
              min="0"
              placeholder="Weight (kg)"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              required
            />
            <input
              className="field w-full"
              type="text"
              placeholder="Optional notes"
              value={weightNotes}
              onChange={e => setWeightNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-gold text-sm flex-1">
                Save Entry
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  setShowForm(false);
                  setWeightInput('');
                  setWeightNotes('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Workout History Section ─────────────────────────────────────────────────

function WorkoutHistorySection({ workoutHistory }: { workoutHistory: WorkoutCompletion[] }) {
  const sorted = [...workoutHistory]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="glass rounded-xl card-pad">
      <h2 className="section-title mb-4">Training History</h2>

      {workoutHistory.length === 0 ? (
        <p className="empty">No workouts logged yet.</p>
      ) : (
        <div className="space-y-0">
          {sorted.map((entry, i) => (
            <React.Fragment key={entry.id}>
              {i > 0 && <div className="divider" />}
              <div className="py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-paper text-sm truncate">{entry.workoutName}</span>
                    <span className="text-xs text-mist mt-0.5">{formatDate(entry.date)}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs text-ghost">{entry.durationMin} min</span>
                    <span className="text-xs text-ghost mt-0.5">{entry.completedExercises.length} exercises</span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Personal Records Section ────────────────────────────────────────────────

interface PRSectionProps {
  prs: PREntry[];
  logPR: (exerciseId: string, exerciseName: string, weightKg: number, reps: number) => void;
}

function PRSection({ prs, logPR }: PRSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [prExercise, setPrExercise] = useState('');
  const [prWeight, setPrWeight] = useState('');
  const [prReps, setPrReps] = useState('');

  const sorted = [...prs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = prExercise.trim();
    const weight = parseFloat(prWeight);
    const reps = parseInt(prReps, 10);
    if (!name || isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) return;
    // exerciseId defaults to a slugified exercise name
    const exerciseId = name.toLowerCase().replace(/\s+/g, '-');
    logPR(exerciseId, name, weight, reps);
    setPrExercise('');
    setPrWeight('');
    setPrReps('');
    setShowForm(false);
  }

  return (
    <div className="glass rounded-xl card-pad">
      <h2 className="section-title mb-4">Personal Records</h2>

      {prs.length === 0 ? (
        <p className="empty">No PRs logged yet. Hit a new record today.</p>
      ) : (
        <div className="space-y-0">
          {sorted.map((entry, i) => (
            <React.Fragment key={entry.id}>
              {i > 0 && <div className="divider" />}
              <div className="flex items-center justify-between py-2 gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-paper text-sm truncate">{entry.exerciseName}</span>
                  <span className="text-xs text-mist mt-0.5">{formatDate(entry.date)}</span>
                </div>
                <span className="text-gold font-semibold text-sm shrink-0">
                  {entry.weightKg}kg × {entry.reps} reps
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="mt-4">
        {!showForm ? (
          <button className="btn-ghost text-sm" onClick={() => setShowForm(true)}>
            + Log a PR
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-3">
            <input
              className="field w-full"
              type="text"
              placeholder="Exercise name"
              value={prExercise}
              onChange={e => setPrExercise(e.target.value)}
              required
            />
            <div className="field-row">
              <input
                className="field w-full"
                type="number"
                step="0.5"
                min="0"
                placeholder="Weight (kg)"
                value={prWeight}
                onChange={e => setPrWeight(e.target.value)}
                required
              />
              <input
                className="field w-full"
                type="number"
                min="1"
                placeholder="Reps"
                value={prReps}
                onChange={e => setPrReps(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-gold text-sm flex-1">
                Save PR
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  setShowForm(false);
                  setPrExercise('');
                  setPrWeight('');
                  setPrReps('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Transformation Photos ───────────────────────────────────────────────────

function TransformationPhotos() {
  return (
    <div className="glass rounded-xl card-pad">
      <h2 className="section-title mb-4">Transformation Photos</h2>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-24 bg-ink-panel border border-dashed border-ink-line rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer"
          >
            <span className="text-xl">📷</span>
            <span className="text-ghost text-xs">Add Photo</span>
          </div>
        ))}
      </div>
      <p className="text-ghost text-xs">
        Photo storage requires backend integration — coming in Phase 2
      </p>
    </div>
  );
}

// ─── Consistency Score ───────────────────────────────────────────────────────

function ConsistencyScore({ workoutsThisMonth }: { workoutsThisMonth: number }) {
  const planned = 12; // ~3 per week × 4 weeks
  const rawPct = Math.round((workoutsThisMonth / planned) * 100);
  const pct = Math.min(rawPct, 100);

  return (
    <div className="glass rounded-xl card-pad flex flex-col items-center gap-4">
      <h2 className="section-title self-start">Consistency Score</h2>

      {/* Progress ring */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div
          className="w-32 h-32 rounded-full absolute inset-0"
          style={{
            background: `conic-gradient(#d4af37 ${pct}%, #1a1f2e ${pct}%)`,
          }}
        />
        <div className="w-24 h-24 rounded-full bg-ink-black absolute inset-0 m-auto flex items-center justify-center z-10">
          <span className="display-title text-gold text-2xl font-bold">{pct}%</span>
        </div>
      </div>

      <p className="text-ghost text-xs text-center">
        Based on {workoutsThisMonth} of {planned} planned workouts this month
      </p>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { appState, logWeight, logPR } = useApp();
  const { progress, dailyHabits } = appState;
  const { weightLog, workoutHistory, prs, streak } = progress;

  // — Workouts this month
  const workoutsThisMonth = workoutHistory.filter(w => isThisMonth(w.date)).length;

  // — Weight change
  let weightChangeNode: React.ReactNode = <span className="text-mist">—</span>;
  if (weightLog.length >= 2) {
    const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].weightKg;
    const latest = sorted[sorted.length - 1].weightKg;
    const diff = latest - first;
    const sign = diff > 0 ? '+' : '';
    const colorClass = diff < 0 ? 'text-green-400' : 'text-gold';
    weightChangeNode = (
      <span className={colorClass}>
        {sign}{diff.toFixed(1)} kg
      </span>
    );
  }

  // — Habit score
  const habitValues = Object.values(dailyHabits.habits);
  const habitPct =
    habitValues.length > 0
      ? Math.round((habitValues.filter(Boolean).length / habitValues.length) * 100)
      : 0;

  return (
    <div className="page pb-32">
      <ScreenHeader title="Progress" subtitle="Track your gains" />

      <div className="px-4 pt-4 space-y-4 fade-in">

        {/* A) Summary Stats 2×2 Grid */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="Current Streak">
            <span className="text-gold">🔥 {streak}</span>
            <span className="text-sm text-mist font-normal"> days</span>
          </SummaryCard>

          <SummaryCard label="Workouts This Month">
            <span className="text-paper">{workoutsThisMonth}</span>
          </SummaryCard>

          <SummaryCard label="Weight Change">
            {weightChangeNode}
          </SummaryCard>

          <SummaryCard label="Today's Habits">
            <span className="text-gold">{habitPct}%</span>
          </SummaryCard>
        </div>

        {/* B) Weight Log */}
        <WeightLogSection weightLog={weightLog} logWeight={logWeight} />

        {/* C) Workout History */}
        <WorkoutHistorySection workoutHistory={workoutHistory} />

        {/* D) Personal Records */}
        <PRSection prs={prs} logPR={logPR} />

        {/* E) Transformation Photos */}
        <TransformationPhotos />

        {/* F) Consistency Score */}
        <ConsistencyScore workoutsThisMonth={workoutsThisMonth} />

      </div>
    </div>
  );
}
