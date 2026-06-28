import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { assignProgram, getProgramById } from '../../data/programs';
import type {
  GoalType,
  TrainingLevel,
  EquipmentType,
  WorkoutLocation,
  NutritionGoal,
} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingState {
  name: string;
  age: string;
  heightMode: 'cm' | 'ftIn';
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weightMode: 'kg' | 'lbs';
  weightValue: string;
  goal: GoalType | '';
  trainingLevel: TrainingLevel | '';
  daysPerWeek: number;
  location: WorkoutLocation | '';
  equipment: EquipmentType[];
  injuries: string;
  injuriesNone: boolean;
  nutritionGoal: NutritionGoal | '';
  bodyFocus: string[];
}

const INITIAL_STATE: OnboardingState = {
  name: '',
  age: '',
  heightMode: 'cm',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weightMode: 'kg',
  weightValue: '',
  goal: '',
  trainingLevel: '',
  daysPerWeek: 4,
  location: '',
  equipment: [],
  injuries: '',
  injuriesNone: false,
  nutritionGoal: '',
  bodyFocus: [],
};

const TOTAL_STEPS = 10;

// ─── Helper: convert height to cm ─────────────────────────────────────────────

function toCm(state: OnboardingState): number {
  if (state.heightMode === 'cm') return parseFloat(state.heightCm) || 0;
  const ft = parseFloat(state.heightFt) || 0;
  const inches = parseFloat(state.heightIn) || 0;
  return Math.round((ft * 30.48) + (inches * 2.54));
}

function toKg(state: OnboardingState): number {
  const val = parseFloat(state.weightValue) || 0;
  if (state.weightMode === 'kg') return val;
  return Math.round(val * 0.453592 * 10) / 10;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 px-5 py-4 transition-all min-h-[56px] ${
        selected
          ? 'border-gold bg-gold/10 text-paper'
          : 'border-ink-line bg-ink-card text-chalk hover:border-ink-edge hover:bg-ink-panel'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function MultiChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all min-h-[48px] ${
        selected
          ? 'border-gold bg-gold/10 text-gold'
          : 'border-ink-line bg-ink-card text-mist hover:border-ink-edge'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { completeOnboarding, user } = useAuth();
  const { setActiveProgram, updateNutritionTargets } = useApp();

  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingState>({
    ...INITIAL_STATE,
    name: user?.name ?? '',
  });
  const [stepError, setStepError] = useState('');
  const [completing, setCompleting] = useState(false);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const assignedProgramId = data.goal && data.trainingLevel && data.location
    ? assignProgram(data.goal, data.trainingLevel, data.location, data.daysPerWeek)
    : 'prog_beginner_full_body';

  const assignedProgram = getProgramById(assignedProgramId);

  // ─── Validation per step ──────────────────────────────────────────────────

  function validateStep(): string {
    switch (step) {
      case 1:
        if (!data.name.trim()) return 'Please enter your name.';
        break;
      case 2: {
        const age = parseInt(data.age, 10);
        if (!data.age || isNaN(age) || age < 13 || age > 100) return 'Enter a valid age (13–100).';
        if (data.heightMode === 'cm') {
          const h = parseFloat(data.heightCm);
          if (!data.heightCm || isNaN(h) || h < 100 || h > 250) return 'Enter a valid height.';
        } else {
          const ft = parseFloat(data.heightFt);
          if (!data.heightFt || isNaN(ft) || ft < 3 || ft > 8) return 'Enter a valid height in feet.';
        }
        const w = parseFloat(data.weightValue);
        if (!data.weightValue || isNaN(w) || w <= 0) return 'Enter a valid weight.';
        break;
      }
      case 3:
        if (!data.goal) return 'Select your primary goal.';
        break;
      case 4:
        if (!data.trainingLevel) return 'Select your training level.';
        break;
      case 6:
        if (!data.location) return 'Select where you train.';
        break;
      case 7:
        if (data.equipment.length === 0) return 'Select at least one equipment option.';
        break;
      case 9:
        if (!data.nutritionGoal) return 'Select your nutrition goal.';
        break;
      case 10:
        if (data.bodyFocus.length === 0) return 'Select at least one focus area.';
        break;
    }
    return '';
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError('');
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    }
  }

  function goBack() {
    setStepError('');
    if (step > 1) setStep(s => s - 1);
  }

  function toggleEquipment(item: EquipmentType) {
    setData(prev => ({
      ...prev,
      equipment: prev.equipment.includes(item)
        ? prev.equipment.filter(e => e !== item)
        : [...prev.equipment, item],
    }));
  }

  function toggleBodyFocus(area: string) {
    setData(prev => ({
      ...prev,
      bodyFocus: prev.bodyFocus.includes(area)
        ? prev.bodyFocus.filter(a => a !== area)
        : [...prev.bodyFocus, area],
    }));
  }

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    const weightKg = toKg(data);
    const heightCm = toCm(data);

    updateNutritionTargets(weightKg, data.nutritionGoal || 'muscle_gain', data.daysPerWeek);
    setActiveProgram(assignedProgramId);

    completeOnboarding({
      name: data.name.trim(),
      age: parseInt(data.age, 10),
      heightCm,
      weightKg,
      goal: data.goal as GoalType,
      trainingLevel: data.trainingLevel as TrainingLevel,
      trainingDaysPerWeek: data.daysPerWeek,
      equipment: data.equipment,
      workoutLocation: data.location as WorkoutLocation,
      injuries: data.injuriesNone ? 'None' : data.injuries.trim() || 'None',
      nutritionGoal: data.nutritionGoal as NutritionGoal,
      preferredDurationMin: 60,
      bodyFocusPriorities: data.bodyFocus,
      assignedProgramId,
    });

    navigate('/', { replace: true });
  }

  // ─── Progress bar ─────────────────────────────────────────────────────────

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  // ─── Step renderers ───────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── Step 1: Name ──────────────────────────────────────────────────────
      case 1:
        return (
          <div className="fade-in flex flex-col gap-6">
            <div>
              <p className="eyebrow mb-2">Step 1 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">What's your name?</h2>
              <p className="text-mist text-sm mt-1">We'll personalize your experience.</p>
            </div>
            <input
              type="text"
              autoComplete="given-name"
              value={data.name}
              onChange={e => setData(p => ({ ...p, name: e.target.value }))}
              placeholder="First name or nickname"
              className="w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-lg bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
              autoFocus
            />
            {data.name.trim() && (
              <p className="text-gold font-semibold text-base fade-in">
                Good to meet you, {data.name.trim()}.
              </p>
            )}
          </div>
        );

      // ── Step 2: Stats ─────────────────────────────────────────────────────
      case 2:
        return (
          <div className="fade-in flex flex-col gap-6">
            <div>
              <p className="eyebrow mb-2">Step 2 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Your stats</h2>
              <p className="text-mist text-sm mt-1">Used to calibrate your program and nutrition.</p>
            </div>

            {/* Age */}
            <div>
              <label className="label block mb-2">Age</label>
              <input
                type="number"
                inputMode="numeric"
                min={13}
                max={100}
                value={data.age}
                onChange={e => setData(p => ({ ...p, age: e.target.value }))}
                placeholder="e.g. 28"
                className="w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
              />
            </div>

            {/* Height */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Height</label>
                <div className="flex rounded-lg overflow-hidden border border-ink-line">
                  <button
                    type="button"
                    onClick={() => setData(p => ({ ...p, heightMode: 'cm' }))}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${data.heightMode === 'cm' ? 'bg-gold text-ink-black' : 'text-mist hover:text-chalk'}`}
                  >
                    cm
                  </button>
                  <button
                    type="button"
                    onClick={() => setData(p => ({ ...p, heightMode: 'ftIn' }))}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${data.heightMode === 'ftIn' ? 'bg-gold text-ink-black' : 'text-mist hover:text-chalk'}`}
                  >
                    ft/in
                  </button>
                </div>
              </div>
              {data.heightMode === 'cm' ? (
                <input
                  type="number"
                  inputMode="decimal"
                  value={data.heightCm}
                  onChange={e => setData(p => ({ ...p, heightCm: e.target.value }))}
                  placeholder="e.g. 178"
                  className="w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
                />
              ) : (
                <div className="flex gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={data.heightFt}
                    onChange={e => setData(p => ({ ...p, heightFt: e.target.value }))}
                    placeholder="ft"
                    className="w-1/2 glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={data.heightIn}
                    onChange={e => setData(p => ({ ...p, heightIn: e.target.value }))}
                    placeholder="in"
                    className="w-1/2 glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Weight */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Weight</label>
                <div className="flex rounded-lg overflow-hidden border border-ink-line">
                  <button
                    type="button"
                    onClick={() => setData(p => ({ ...p, weightMode: 'kg' }))}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${data.weightMode === 'kg' ? 'bg-gold text-ink-black' : 'text-mist hover:text-chalk'}`}
                  >
                    kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setData(p => ({ ...p, weightMode: 'lbs' }))}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${data.weightMode === 'lbs' ? 'bg-gold text-ink-black' : 'text-mist hover:text-chalk'}`}
                  >
                    lbs
                  </button>
                </div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={data.weightValue}
                onChange={e => setData(p => ({ ...p, weightValue: e.target.value }))}
                placeholder={data.weightMode === 'kg' ? 'e.g. 82' : 'e.g. 180'}
                className="w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
              />
            </div>
          </div>
        );

      // ── Step 3: Goal ──────────────────────────────────────────────────────
      case 3: {
        const GOALS: { value: GoalType; label: string; desc: string }[] = [
          { value: 'muscle_gain', label: 'Muscle Gain', desc: 'Build size, strength and mass.' },
          { value: 'fat_loss', label: 'Fat Loss', desc: 'Burn fat while preserving muscle.' },
          { value: 'recomposition', label: 'Body Recomposition', desc: 'Build muscle and lose fat simultaneously.' },
          { value: 'strength', label: 'Strength', desc: 'Maximize raw strength on the big lifts.' },
          { value: 'maintenance', label: 'Maintenance', desc: 'Maintain your physique and stay consistent.' },
        ];
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 3 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Your primary goal</h2>
              <p className="text-mist text-sm mt-1">This determines your program structure.</p>
            </div>
            <div className="flex flex-col gap-3">
              {GOALS.map(g => (
                <SelectCard
                  key={g.value}
                  selected={data.goal === g.value}
                  onClick={() => setData(p => ({ ...p, goal: g.value }))}
                >
                  <div className="font-bold text-base mb-0.5">{g.label}</div>
                  <div className="text-mist text-sm">{g.desc}</div>
                </SelectCard>
              ))}
            </div>
          </div>
        );
      }

      // ── Step 4: Training Level ────────────────────────────────────────────
      case 4: {
        const LEVELS: { value: TrainingLevel; label: string; desc: string; badge: string }[] = [
          { value: 'beginner', label: 'Beginner', badge: 'chip', desc: 'Less than 1 year of consistent training. Learning the fundamentals.' },
          { value: 'intermediate', label: 'Intermediate', badge: 'chip-gold', desc: '1–3 years of consistent training. Solid foundation, ready for more.' },
          { value: 'advanced', label: 'Advanced', badge: 'chip-blue', desc: '3+ years of serious training. Ready for high-volume, high-intensity work.' },
        ];
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 4 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Your training level</h2>
              <p className="text-mist text-sm mt-1">Be honest — the right program makes all the difference.</p>
            </div>
            <div className="flex flex-col gap-3">
              {LEVELS.map(l => (
                <SelectCard
                  key={l.value}
                  selected={data.trainingLevel === l.value}
                  onClick={() => setData(p => ({ ...p, trainingLevel: l.value }))}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-base">{l.label}</span>
                    <span className={l.badge}>{l.badge === 'chip' ? 'Foundation' : l.badge === 'chip-gold' ? 'Builder' : 'Elite'}</span>
                  </div>
                  <div className="text-mist text-sm">{l.desc}</div>
                </SelectCard>
              ))}
            </div>
          </div>
        );
      }

      // ── Step 5: Days per Week ─────────────────────────────────────────────
      case 5:
        return (
          <div className="fade-in flex flex-col gap-6">
            <div>
              <p className="eyebrow mb-2">Step 5 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">How many days per week?</h2>
              <p className="text-mist text-sm mt-1">Training frequency shapes your program split.</p>
            </div>
            <div className="flex flex-col gap-3">
              {[2, 3, 4, 5, 6].map(d => (
                <SelectCard
                  key={d}
                  selected={data.daysPerWeek === d}
                  onClick={() => setData(p => ({ ...p, daysPerWeek: d }))}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{d} days</span>
                    <span className="text-mist text-sm">
                      {d === 2 && 'Minimal — 2 full-body sessions'}
                      {d === 3 && 'Standard — full body or push/pull/legs'}
                      {d === 4 && 'Optimal — upper/lower split'}
                      {d === 5 && 'High frequency — PPL + extra'}
                      {d === 6 && 'Advanced — high volume split'}
                    </span>
                  </div>
                </SelectCard>
              ))}
            </div>
          </div>
        );

      // ── Step 6: Location ──────────────────────────────────────────────────
      case 6: {
        const LOCATIONS: { value: WorkoutLocation; label: string; desc: string }[] = [
          { value: 'gym', label: 'Gym', desc: 'Commercial gym with full equipment.' },
          { value: 'home', label: 'Home', desc: 'Home gym or limited equipment setup.' },
          { value: 'hybrid', label: 'Hybrid', desc: 'Mix of gym and home training.' },
        ];
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 6 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Where do you train?</h2>
              <p className="text-mist text-sm mt-1">This determines which exercises we prescribe.</p>
            </div>
            <div className="flex flex-col gap-3">
              {LOCATIONS.map(l => (
                <SelectCard
                  key={l.value}
                  selected={data.location === l.value}
                  onClick={() => setData(p => ({ ...p, location: l.value }))}
                >
                  <div className="font-bold text-base mb-0.5">{l.label}</div>
                  <div className="text-mist text-sm">{l.desc}</div>
                </SelectCard>
              ))}
            </div>
          </div>
        );
      }

      // ── Step 7: Equipment ─────────────────────────────────────────────────
      case 7: {
        const EQUIPMENT: { value: EquipmentType; label: string }[] = [
          { value: 'barbell', label: 'Barbell' },
          { value: 'dumbbell', label: 'Dumbbell' },
          { value: 'cables', label: 'Cables' },
          { value: 'machine', label: 'Machines' },
          { value: 'bodyweight', label: 'Bodyweight' },
          { value: 'resistance_band', label: 'Resistance Bands' },
          { value: 'kettlebell', label: 'Kettlebell' },
          { value: 'pull_up_bar', label: 'Pull-up Bar' },
        ];
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 7 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Available equipment</h2>
              <p className="text-mist text-sm mt-1">Select everything you have access to.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {EQUIPMENT.map(eq => (
                <MultiChip
                  key={eq.value}
                  label={eq.label}
                  selected={data.equipment.includes(eq.value)}
                  onClick={() => toggleEquipment(eq.value)}
                />
              ))}
            </div>
            {data.equipment.length > 0 && (
              <p className="text-gold text-xs font-medium fade-in">
                {data.equipment.length} selected
              </p>
            )}
          </div>
        );
      }

      // ── Step 8: Injuries ──────────────────────────────────────────────────
      case 8:
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 8 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Any injuries or limitations?</h2>
              <p className="text-mist text-sm mt-1">We'll note these for your coach to factor in.</p>
            </div>

            {/* None option */}
            <SelectCard
              selected={data.injuriesNone}
              onClick={() => setData(p => ({ ...p, injuriesNone: !p.injuriesNone, injuries: !p.injuriesNone ? '' : p.injuries }))}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${data.injuriesNone ? 'border-gold bg-gold' : 'border-ink-line'}`}>
                  {data.injuriesNone && <div className="w-2 h-2 rounded-full bg-ink-black" />}
                </div>
                <span className="font-semibold">None — I'm injury free</span>
              </div>
            </SelectCard>

            {!data.injuriesNone && (
              <textarea
                value={data.injuries}
                onChange={e => setData(p => ({ ...p, injuries: e.target.value }))}
                placeholder="Describe any injuries, pain, or areas to avoid (e.g. lower back pain, shoulder impingement...)"
                rows={4}
                className="w-full glass rounded-xl px-4 py-4 text-paper placeholder-ghost text-base bg-transparent border border-ink-line focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all resize-none"
              />
            )}
          </div>
        );

      // ── Step 9: Nutrition Goal ────────────────────────────────────────────
      case 9: {
        const NUTR_GOALS: { value: NutritionGoal; label: string; desc: string }[] = [
          { value: 'muscle_gain', label: 'Build Muscle', desc: 'Caloric surplus with high protein to fuel growth.' },
          { value: 'fat_loss', label: 'Lose Fat', desc: 'Caloric deficit while preserving lean mass.' },
          { value: 'maintenance', label: 'Maintain Weight', desc: 'Eat to performance and body weight stability.' },
          { value: 'performance', label: 'Optimize Performance', desc: 'Fuel training intensity, endurance, and recovery.' },
        ];
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 9 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Your nutrition goal</h2>
              <p className="text-mist text-sm mt-1">Sets your macro targets and meal recommendations.</p>
            </div>
            <div className="flex flex-col gap-3">
              {NUTR_GOALS.map(g => (
                <SelectCard
                  key={g.value}
                  selected={data.nutritionGoal === g.value}
                  onClick={() => setData(p => ({ ...p, nutritionGoal: g.value }))}
                >
                  <div className="font-bold text-base mb-0.5">{g.label}</div>
                  <div className="text-mist text-sm">{g.desc}</div>
                </SelectCard>
              ))}
            </div>
          </div>
        );
      }

      // ── Step 10: Focus areas ──────────────────────────────────────────────
      case 10: {
        const FOCUS_AREAS = [
          'Chest',
          'Arms',
          'Shoulders',
          'Back',
          'Core',
          'Legs',
          'Overall Athletic Build',
        ];
        return (
          <div className="fade-in flex flex-col gap-5">
            <div>
              <p className="eyebrow mb-2">Step 10 of {TOTAL_STEPS}</p>
              <h2 className="section-title text-paper">Focus areas</h2>
              <p className="text-mist text-sm mt-1">Which body parts matter most to you? Pick all that apply.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FOCUS_AREAS.map(area => (
                <MultiChip
                  key={area}
                  label={area}
                  selected={data.bodyFocus.includes(area)}
                  onClick={() => toggleBodyFocus(area)}
                />
              ))}
            </div>
            {data.bodyFocus.length > 0 && (
              <p className="text-gold text-xs font-medium fade-in">
                {data.bodyFocus.length} selected
              </p>
            )}

            {/* Program preview */}
            {assignedProgram && (
              <div className="glass-strong rounded-2xl border border-gold/20 p-5 mt-2 fade-in">
                <p className="eyebrow mb-3">Your assigned program</p>
                <p className="text-paper font-bold text-lg mb-1">{assignedProgram.name}</p>
                <p className="text-mist text-sm mb-4 leading-relaxed">{assignedProgram.description}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="chip-gold">{assignedProgram.level}</span>
                  <span className="chip">{assignedProgram.durationWeeks} weeks</span>
                  <span className="chip">{assignedProgram.daysPerWeek} days/week</span>
                  <span className="chip">{assignedProgram.location}</span>
                </div>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  }

  // ─── Final step: Plan Ready ────────────────────────────────────────────────

  const isFinalStep = step === TOTAL_STEPS;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page min-h-screen bg-ink-black flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Top bar with progress */}
        <div className="px-5 pt-12 pb-4">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-ghost text-xs tracking-widest uppercase">
              {step < TOTAL_STEPS ? `Step ${step} of ${TOTAL_STEPS}` : 'Almost done'}
            </span>
            {step > 1 && step < TOTAL_STEPS && (
              <button
                onClick={goBack}
                className="text-mist text-xs hover:text-chalk transition-colors"
                aria-label="Go to previous step"
              >
                ← Back
              </button>
            )}
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 bg-ink-line rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-electric"
              style={{ width: `${Math.max(progressPct, 4)}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 px-5 pb-6 overflow-y-auto scrollbar-hide">
          {renderStep()}

          {/* Validation error */}
          {stepError && (
            <div className="mt-4 glass border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{stepError}</p>
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="px-5 pb-10 pt-3 border-t border-ink-line">
          {isFinalStep ? (
            <div className="flex flex-col gap-3">
              {data.bodyFocus.length > 0 && (
                <div className="glass rounded-2xl border border-gold/20 p-4 mb-2 fade-in">
                  <p className="text-gold font-bold text-sm mb-1">Your Plan is Ready</p>
                  {assignedProgram && (
                    <p className="text-mist text-xs">
                      Starting you on <span className="text-chalk font-semibold">{assignedProgram.name}</span> — {assignedProgram.durationWeeks} weeks, {assignedProgram.daysPerWeek} days/week.
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  const err = validateStep();
                  if (err) { setStepError(err); return; }
                  setStepError('');
                  handleComplete();
                }}
                disabled={completing}
                className="btn-gold w-full text-base font-bold tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {completing ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-ink-black/30 border-t-ink-black animate-spin" />
                    Setting up your plan...
                  </>
                ) : (
                  "Let's Go"
                )}
              </button>
              {step > 1 && (
                <button
                  onClick={goBack}
                  className="btn-ghost w-full text-sm"
                >
                  ← Back
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  onClick={goBack}
                  className="btn-ghost flex-shrink-0 px-5"
                  aria-label="Previous step"
                >
                  ←
                </button>
              )}
              <button
                onClick={goNext}
                className="btn-gold flex-1 text-base font-bold tracking-wide"
              >
                {step === TOTAL_STEPS - 1 ? 'See My Plan' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
