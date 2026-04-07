import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LIFE_AREAS } from '../data/frameworks';
import { ChevronRight, ChevronLeft, Bookmark } from 'lucide-react';

const STEPS = [
  { title: 'Welcome', subtitle: 'Let\'s set the foundation.' },
  { title: 'Your Season', subtitle: 'Where are you right now?' },
  { title: 'Your Vision', subtitle: 'Where are you going?' },
  { title: 'Your Systems', subtitle: 'What needs structure?' },
];

export default function Onboarding() {
  const { setProfile, setOnboarded, setGoals } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    season: '',
    frustrations: '',
    ninetyDayMission: '',
    twoYearTarget: '',
    fiveYearTarget: '',
    tenYearTarget: '',
    twentyYearLegacy: '',
    coreValues: '',
    systemAreas: [],
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const toggleArea = (area) => {
    setForm(prev => ({
      ...prev,
      systemAreas: prev.systemAreas.includes(area)
        ? prev.systemAreas.filter(a => a !== area)
        : [...prev.systemAreas, area]
    }));
  };

  const finish = () => {
    const profile = { ...form, createdAt: new Date().toISOString() };
    setProfile(profile);
    setGoals({
      ninetyDay: form.ninetyDayMission,
      twoYear: form.twoYearTarget,
      fiveYear: form.fiveYearTarget,
      tenYear: form.tenYearTarget,
      twentyYear: form.twentyYearLegacy,
      monthlyTarget: '',
      weeklyWin: '',
    });
    setOnboarded(true);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-wb-black flex flex-col">
      {/* Progress bar */}
      <div className="px-4 pt-4">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-wb-blue' : 'bg-wb-border'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 page-container">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="slide-up space-y-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-wb-blue/20 flex items-center justify-center">
                <Bookmark size={24} className="text-wb-blue-light" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Winner's Bookmark</h1>
                <p className="text-wb-muted text-sm">Daily</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-wb-muted leading-relaxed">
                This is not a casual diary app. It's a personal operating system designed to turn long-term goals into daily disciplined action.
              </p>
              <p className="text-wb-muted leading-relaxed">
                Thought → Decision → Action → Review → Correction → Progress
              </p>
            </div>

            <div className="space-y-3">
              <label className="label">What's your name?</label>
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Your name"
                className="w-full"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 1: Season */}
        {step === 1 && (
          <div className="slide-up space-y-6 pt-4">
            <div>
              <h2 className="page-header">Your Current Season</h2>
              <p className="text-wb-muted text-sm -mt-4 mb-6">Be honest about where you are. Clarity starts here.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Current season of life</label>
                <input
                  value={form.season}
                  onChange={(e) => update('season', e.target.value)}
                  placeholder="e.g., Building phase, recovery, transition..."
                />
              </div>
              <div>
                <label className="label">Biggest frustrations</label>
                <textarea
                  value={form.frustrations}
                  onChange={(e) => update('frustrations', e.target.value)}
                  placeholder="What's holding you back? What keeps repeating?"
                  rows={4}
                />
              </div>
              <div>
                <label className="label">Core values (comma-separated)</label>
                <input
                  value={form.coreValues}
                  onChange={(e) => update('coreValues', e.target.value)}
                  placeholder="e.g., Discipline, integrity, growth, family..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Vision */}
        {step === 2 && (
          <div className="slide-up space-y-6 pt-4">
            <div>
              <h2 className="page-header">Your Vision</h2>
              <p className="text-wb-muted text-sm -mt-4 mb-6">Connect your daily actions to your long-term vision.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">90-Day Mission</label>
                <textarea
                  value={form.ninetyDayMission}
                  onChange={(e) => update('ninetyDayMission', e.target.value)}
                  placeholder="What must be accomplished in the next 90 days?"
                  rows={2}
                />
              </div>
              <div>
                <label className="label">2-Year Target</label>
                <input
                  value={form.twoYearTarget}
                  onChange={(e) => update('twoYearTarget', e.target.value)}
                  placeholder="Where do you want to be in 2 years?"
                />
              </div>
              <div>
                <label className="label">5-Year Vision</label>
                <input
                  value={form.fiveYearTarget}
                  onChange={(e) => update('fiveYearTarget', e.target.value)}
                  placeholder="What does your life look like in 5 years?"
                />
              </div>
              <div>
                <label className="label">10-Year Identity</label>
                <input
                  value={form.tenYearTarget}
                  onChange={(e) => update('tenYearTarget', e.target.value)}
                  placeholder="Who have you become in 10 years?"
                />
              </div>
              <div>
                <label className="label">20-Year Legacy</label>
                <textarea
                  value={form.twentyYearLegacy}
                  onChange={(e) => update('twentyYearLegacy', e.target.value)}
                  placeholder="What legacy are you building?"
                  rows={2}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Systems */}
        {step === 3 && (
          <div className="slide-up space-y-6 pt-4">
            <div>
              <h2 className="page-header">Areas Needing Systems</h2>
              <p className="text-wb-muted text-sm -mt-4 mb-6">Select the areas where you need structure most.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {LIFE_AREAS.map(area => (
                <button
                  key={area}
                  onClick={() => toggleArea(area)}
                  className={`p-3 rounded-xl text-sm font-medium text-left transition-all border ${
                    form.systemAreas.includes(area)
                      ? 'bg-wb-blue/15 border-wb-blue text-wb-blue-light'
                      : 'bg-wb-card border-wb-border text-wb-muted hover:border-wb-blue/30'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-4 pb-8 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-shrink-0">
            <ChevronLeft size={18} />
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="btn-primary flex-1"
            disabled={step === 0 && !form.name.trim()}
          >
            Continue <ChevronRight size={18} />
          </button>
        ) : (
          <button onClick={finish} className="btn-primary flex-1">
            Start Your Journey <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
