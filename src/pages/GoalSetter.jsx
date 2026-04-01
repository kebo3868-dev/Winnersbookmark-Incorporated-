import { useState } from 'react';
import { Target, Sparkles, ChevronRight, Check, Plus, Trash2, BookOpen } from 'lucide-react';
import { habitPlanTemplates, fourLaws } from '../data/quotes';
import { getCustomHabits, saveCustomHabits } from '../data/storage';

function matchPlanTemplate(habitText) {
  const lower = habitText.toLowerCase();
  for (const [key, template] of Object.entries(habitPlanTemplates)) {
    if (key === 'default') continue;
    if (template.keyword.some(kw => lower.includes(kw))) {
      return { ...template, key };
    }
  }
  return { ...habitPlanTemplates.default, key: 'default' };
}

function PlanResult({ habit, plan, onSave, saved }) {
  const lawColors = {
    'Make It Obvious':    'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'Make It Attractive': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    'Make It Easy':       'text-green-400 bg-green-400/10 border-green-400/20',
    'Make It Satisfying': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  };

  function getLawColor(law) {
    for (const [key, cls] of Object.entries(lawColors)) {
      if (law.includes(key)) return cls;
    }
    return 'text-wb-blue-glow bg-wb-blue/10 border-wb-blue/20';
  }

  return (
    <div className="wb-card p-6 space-y-5 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-wb-blue-glow" />
            <span className="text-wb-blue-glow text-sm font-semibold uppercase tracking-wide">
              Your Atomic Habits Plan
            </span>
          </div>
          <h2 className="text-xl font-bold text-wb-white">{plan.title}</h2>
          <p className="text-wb-muted text-sm mt-1">
            For: <span className="text-wb-white italic">"{habit}"</span>
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saved}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-400/30 cursor-default'
              : 'wb-btn-primary'
          }`}
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Plus className="w-4 h-4" /> Save Habit</>}
        </button>
      </div>

      {/* 4-week plan */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-wb-muted uppercase tracking-wider">
          4-Week Implementation Plan
        </h3>
        {plan.steps.map((step, i) => (
          <div key={i} className="flex gap-4 p-4 bg-wb-dark rounded-xl border border-wb-border/50">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-wb-blue/10 border border-wb-blue/30 flex items-center justify-center text-wb-blue-glow font-bold text-sm">
              W{step.week}
            </div>
            <div className="flex-1">
              <p className="text-wb-white text-sm leading-relaxed">{step.action}</p>
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${getLawColor(step.law)}`}>
                {step.law}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Identity reframe */}
      <div className="bg-wb-blue/10 border border-wb-blue/30 rounded-xl p-4">
        <p className="text-wb-muted text-xs font-semibold uppercase tracking-wide mb-2">
          Identity Reframe (Atomic Habits Ch. 2)
        </p>
        <p className="text-wb-white text-sm leading-relaxed">
          Don't say <span className="text-wb-muted line-through">"I want to {habit.toLowerCase()}"</span>. Say{' '}
          <span className="text-wb-blue-glow font-semibold">
            "I am the type of person who {habit.toLowerCase().replace(/^(i want to |to |start |begin )/i, '')}s."
          </span>
        </p>
        <p className="text-wb-muted text-xs mt-2">
          Every action you take is a vote for that identity.
        </p>
      </div>
    </div>
  );
}

function SavedHabitItem({ habit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-wb-dark rounded-xl border border-wb-border/50">
      <div>
        <p className="text-wb-white text-sm font-medium">{habit.text}</p>
        <p className="text-wb-muted text-xs mt-0.5">{habit.plan.title}</p>
      </div>
      <button
        onClick={() => onDelete(habit.id)}
        className="text-wb-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10"
        aria-label="Delete habit"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function GoalSetter() {
  const [input, setInput] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [generatedHabit, setGeneratedHabit] = useState('');
  const [savedHabits, setSavedHabits] = useState(() => getCustomHabits());
  const [savedThisSession, setSavedThisSession] = useState(false);

  const examples = [
    'Wake up at 5am every day',
    'Read 20 pages before bed',
    'Reduce phone screen time',
    'Drink 8 glasses of water',
    'Start a gratitude practice',
    'Exercise 4 times per week',
  ];

  function handleGenerate() {
    if (!input.trim()) return;
    const plan = matchPlanTemplate(input.trim());
    setGeneratedPlan(plan);
    setGeneratedHabit(input.trim());
    setSavedThisSession(false);
  }

  function handleSave() {
    const newHabit = {
      id: Date.now().toString(),
      text: generatedHabit,
      plan: generatedPlan,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedHabits, newHabit];
    setSavedHabits(updated);
    saveCustomHabits(updated);
    setSavedThisSession(true);
  }

  function handleDelete(id) {
    const updated = savedHabits.filter(h => h.id !== id);
    setSavedHabits(updated);
    saveCustomHabits(updated);
  }

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-wb-white">Goal Setter</h1>
        <p className="text-wb-muted mt-1">
          Tell us the habit you want to build. Get a personalized plan based on{' '}
          <span className="text-wb-blue-glow">Atomic Habits</span> by James Clear.
        </p>
      </div>

      {/* Input section */}
      <div className="wb-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-wb-blue" />
          <h2 className="text-wb-white font-semibold">What habit do you want to build?</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. Wake up at 5am every day"
            className="wb-input flex-1"
          />
          <button
            onClick={handleGenerate}
            disabled={!input.trim()}
            className="wb-btn-primary flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Generate Plan
          </button>
        </div>
        {/* Example suggestions */}
        <div className="flex flex-wrap gap-2">
          {examples.map(ex => (
            <button
              key={ex}
              onClick={() => { setInput(ex); }}
              className="text-xs bg-wb-dark border border-wb-border hover:border-wb-blue/50 text-wb-muted hover:text-wb-white px-3 py-1.5 rounded-full transition-all"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Generated plan */}
      {generatedPlan && (
        <PlanResult
          habit={generatedHabit}
          plan={generatedPlan}
          onSave={handleSave}
          saved={savedThisSession}
        />
      )}

      {/* Atomic Habits framework reminder */}
      <div className="wb-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-wb-blue" />
          <h2 className="text-wb-white font-semibold">The Four Laws of Behavior Change</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { n: 1, law: 'Make It Obvious',    color: 'blue',   icon: '👁️' },
            { n: 2, law: 'Make It Attractive', color: 'purple', icon: '✨' },
            { n: 3, law: 'Make It Easy',       color: 'green',  icon: '⚡' },
            { n: 4, law: 'Make It Satisfying', color: 'yellow', icon: '🏆' },
          ].map(({ n, law, color, icon }) => (
            <div key={n} className="flex items-center gap-3 p-3 bg-wb-dark rounded-xl border border-wb-border/50">
              <span className="text-2xl">{icon}</span>
              <div>
                <span className="text-wb-muted text-xs">Law {n}</span>
                <p className="text-wb-white text-sm font-medium">{law}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-wb-muted text-xs mt-4 italic">
          — James Clear, Atomic Habits. Every plan we generate is built on these four laws.
        </p>
      </div>

      {/* Saved habits */}
      {savedHabits.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-wb-white">Your Saved Goals</h2>
          {savedHabits.map(habit => (
            <SavedHabitItem key={habit.id} habit={habit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
