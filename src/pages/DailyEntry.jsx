import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getDailyCroak } from '../data/croaks';
import { getDailyAdvice } from '../data/advice';
import { todayKey, formatDateLong } from '../lib/dates';
import { computeAlignmentScore, SCORE_CATEGORIES } from '../lib/scoring';
import Layout from '../components/Layout';
import SliderInput from '../components/SliderInput';
import { Sun, Moon, Skull, Lightbulb, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function DailyEntry() {
  const { todayEntry, saveEntry, goals, thoughts, setThoughts } = useApp();
  const today = todayKey();
  const croak = getDailyCroak(today);
  const advice = getDailyAdvice(today);

  const [tab, setTab] = useState('morning');
  const [morningOpen, setMorningOpen] = useState({ gratitude: true, priorities: true, croak: false, advice: false });
  const [eveningOpen, setEveningOpen] = useState({ reflection: true, scores: true, thought: false });

  // Morning state
  const [morning, setMorning] = useState({
    gratitude1: '', gratitude2: '', gratitude3: '',
    personAppreciated: '', opportunity: '', whyGratitudeMatters: '',
    priorities: ['', '', ''],
    boldMove: '',
    completed: false,
  });

  // Evening state
  const [evening, setEvening] = useState({
    whatGotDone: '', whatWasAvoided: '', lessonLearned: '',
    emotionalCheckIn: '', tomorrowAdjustment: '', sentenceToFutureSelf: '',
    scores: { focus: 5, discipline: 5, courage: 5, health: 5, output: 5, alignment: 5, peace: 5 },
    alignmentScore: 5,
    completed: false,
  });

  // Thought state
  const [thought, setThought] = useState({
    feeling: '', mentalSpace: '', realIssue: '', truthAvoiding: '', decisionNeeded: '',
  });

  // Load existing entry
  useEffect(() => {
    if (todayEntry?.morning) setMorning(prev => ({ ...prev, ...todayEntry.morning }));
    if (todayEntry?.evening) setEvening(prev => ({ ...prev, ...todayEntry.evening }));
  }, [todayEntry]);

  const updateMorning = (field, value) => {
    setMorning(prev => ({ ...prev, [field]: value }));
  };

  const updatePriority = (index, value) => {
    setMorning(prev => {
      const priorities = [...prev.priorities];
      priorities[index] = value;
      return { ...prev, priorities };
    });
  };

  const updateEvening = (field, value) => {
    setEvening(prev => ({ ...prev, [field]: value }));
  };

  const updateScore = (category, value) => {
    setEvening(prev => {
      const scores = { ...prev.scores, [category]: value };
      return { ...prev, scores, alignmentScore: computeAlignmentScore(scores) };
    });
  };

  const saveMorning = () => {
    const data = { ...morning, completed: true };
    setMorning(data);
    saveEntry(today, { morning: data });
  };

  const saveEvening = () => {
    const data = { ...evening, completed: true };
    setEvening(data);
    saveEntry(today, { evening: data });

    // Save thought if any fields filled
    if (thought.feeling || thought.realIssue || thought.decisionNeeded) {
      const newThought = { ...thought, id: Date.now().toString(), date: today };
      setThoughts([...thoughts, newThought]);
    }
  };

  const Section = ({ title, icon: Icon, open, onToggle, children }) => (
    <div className="card space-y-3">
      <button onClick={onToggle} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-wb-blue-light" />}
          <span className="section-title">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-wb-muted" /> : <ChevronDown size={16} className="text-wb-muted" />}
      </button>
      {open && <div className="space-y-3 pt-1">{children}</div>}
    </div>
  );

  return (
    <Layout>
      <div className="page-container space-y-4">
        <div>
          <h1 className="page-header">Daily Entry</h1>
          <p className="text-sm text-wb-muted -mt-4 mb-4">{formatDateLong(today)}</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-wb-card rounded-xl border border-wb-border">
          <button
            onClick={() => setTab('morning')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === 'morning' ? 'bg-wb-blue text-white' : 'text-wb-muted'
            }`}
          >
            <Sun size={16} /> Morning
          </button>
          <button
            onClick={() => setTab('evening')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === 'evening' ? 'bg-wb-blue text-white' : 'text-wb-muted'
            }`}
          >
            <Moon size={16} /> Evening
          </button>
        </div>

        {/* MORNING TAB */}
        {tab === 'morning' && (
          <div className="space-y-4 slide-up">
            {/* Gratitude */}
            <Section title="Gratitude" open={morningOpen.gratitude} onToggle={() => setMorningOpen(p => ({ ...p, gratitude: !p.gratitude }))}>
              <div>
                <label className="label">3 things I'm grateful for</label>
                <input value={morning.gratitude1} onChange={e => updateMorning('gratitude1', e.target.value)} placeholder="1." className="mb-2" />
                <input value={morning.gratitude2} onChange={e => updateMorning('gratitude2', e.target.value)} placeholder="2." className="mb-2" />
                <input value={morning.gratitude3} onChange={e => updateMorning('gratitude3', e.target.value)} placeholder="3." />
              </div>
              <div>
                <label className="label">1 person I appreciate</label>
                <input value={morning.personAppreciated} onChange={e => updateMorning('personAppreciated', e.target.value)} placeholder="Who and why..." />
              </div>
              <div>
                <label className="label">1 opportunity I should not overlook</label>
                <input value={morning.opportunity} onChange={e => updateMorning('opportunity', e.target.value)} placeholder="What opportunity..." />
              </div>
              <div>
                <label className="label">Why this matters</label>
                <textarea value={morning.whyGratitudeMatters} onChange={e => updateMorning('whyGratitudeMatters', e.target.value)} placeholder="Connect gratitude to purpose..." rows={2} />
              </div>
            </Section>

            {/* Priorities */}
            <Section title="Today's Priorities" icon={null} open={morningOpen.priorities} onToggle={() => setMorningOpen(p => ({ ...p, priorities: !p.priorities }))}>
              <div>
                <label className="label">Top 3 Priorities</label>
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-wb-blue/20 text-wb-blue-light text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                    <input value={morning.priorities[i]} onChange={e => updatePriority(i, e.target.value)} placeholder={`Priority ${i + 1}`} />
                  </div>
                ))}
              </div>
              <div>
                <label className="label">One bold move today</label>
                <input value={morning.boldMove} onChange={e => updateMorning('boldMove', e.target.value)} placeholder="What courageous action will you take?" />
              </div>

              {/* Alignment reminder */}
              {goals.ninetyDay && (
                <div className="bg-wb-blue/5 border border-wb-blue/10 rounded-lg p-3">
                  <span className="text-xs text-wb-blue-light font-medium">90-Day Mission Reminder</span>
                  <p className="text-xs text-wb-muted mt-1">{goals.ninetyDay}</p>
                </div>
              )}
            </Section>

            {/* Croak */}
            <Section title="Daily Croak" icon={Skull} open={morningOpen.croak} onToggle={() => setMorningOpen(p => ({ ...p, croak: !p.croak }))}>
              <p className="text-sm text-wb-gold italic">"{croak.prompt}"</p>
              <p className="text-xs text-wb-muted"><strong>Hard truth:</strong> {croak.hardTruth}</p>
              <p className="text-xs text-wb-muted"><strong>Reflect:</strong> {croak.reflection}</p>
              <p className="text-xs text-wb-muted"><strong>Challenge:</strong> {croak.challenge}</p>
            </Section>

            {/* Advice */}
            <Section title={advice.title} icon={Lightbulb} open={morningOpen.advice} onToggle={() => setMorningOpen(p => ({ ...p, advice: !p.advice }))}>
              <p className="text-sm text-wb-muted">{advice.lesson}</p>
              <p className="text-xs text-wb-muted"><strong>Why it matters:</strong> {advice.whyItMatters}</p>
              <p className="text-xs text-wb-blue-light"><strong>Apply today:</strong> {advice.howToApply}</p>
            </Section>

            {/* Save */}
            <button onClick={saveMorning} className="btn-primary w-full">
              {morning.completed ? <><Check size={16} /> Saved — Update</> : 'Save Morning Entry'}
            </button>
          </div>
        )}

        {/* EVENING TAB */}
        {tab === 'evening' && (
          <div className="space-y-4 slide-up">
            {/* Reflection */}
            <Section title="Evening Reflection" open={eveningOpen.reflection} onToggle={() => setEveningOpen(p => ({ ...p, reflection: !p.reflection }))}>
              <div>
                <label className="label">What got done</label>
                <textarea value={evening.whatGotDone} onChange={e => updateEvening('whatGotDone', e.target.value)} placeholder="What did you accomplish?" rows={2} />
              </div>
              <div>
                <label className="label">What was avoided</label>
                <textarea value={evening.whatWasAvoided} onChange={e => updateEvening('whatWasAvoided', e.target.value)} placeholder="What did you skip or procrastinate on?" rows={2} />
              </div>
              <div>
                <label className="label">Lesson learned</label>
                <input value={evening.lessonLearned} onChange={e => updateEvening('lessonLearned', e.target.value)} placeholder="Key takeaway from today..." />
              </div>
              <div>
                <label className="label">Emotional check-in</label>
                <input value={evening.emotionalCheckIn} onChange={e => updateEvening('emotionalCheckIn', e.target.value)} placeholder="How are you feeling right now?" />
              </div>
              <div>
                <label className="label">Tomorrow's adjustment</label>
                <input value={evening.tomorrowAdjustment} onChange={e => updateEvening('tomorrowAdjustment', e.target.value)} placeholder="What will you do differently?" />
              </div>
              <div>
                <label className="label">One sentence to your future self</label>
                <input value={evening.sentenceToFutureSelf} onChange={e => updateEvening('sentenceToFutureSelf', e.target.value)} placeholder="Future you needs to hear..." />
              </div>
            </Section>

            {/* Alignment Scores */}
            <Section title="Alignment Score" open={eveningOpen.scores} onToggle={() => setEveningOpen(p => ({ ...p, scores: !p.scores }))}>
              <div className="space-y-4">
                {SCORE_CATEGORIES.map(cat => (
                  <SliderInput
                    key={cat}
                    label={cat}
                    value={evening.scores[cat]}
                    onChange={(val) => updateScore(cat, val)}
                  />
                ))}
              </div>
              <div className="text-center pt-3 border-t border-wb-border">
                <span className="text-2xl font-bold text-wb-blue-light">{evening.alignmentScore}</span>
                <span className="text-sm text-wb-muted block">Overall Alignment</span>
              </div>
            </Section>

            {/* Thought */}
            <Section title="Thought Check" open={eveningOpen.thought} onToggle={() => setEveningOpen(p => ({ ...p, thought: !p.thought }))}>
              <div>
                <label className="label">What am I feeling?</label>
                <input value={thought.feeling} onChange={e => setThought(p => ({ ...p, feeling: e.target.value }))} placeholder="Name the emotion..." />
              </div>
              <div>
                <label className="label">What's taking up mental space?</label>
                <input value={thought.mentalSpace} onChange={e => setThought(p => ({ ...p, mentalSpace: e.target.value }))} placeholder="The thing on your mind..." />
              </div>
              <div>
                <label className="label">What is the real issue?</label>
                <input value={thought.realIssue} onChange={e => setThought(p => ({ ...p, realIssue: e.target.value }))} placeholder="Beneath the surface..." />
              </div>
              <div>
                <label className="label">What truth am I avoiding?</label>
                <input value={thought.truthAvoiding} onChange={e => setThought(p => ({ ...p, truthAvoiding: e.target.value }))} placeholder="Be honest..." />
              </div>
              <div>
                <label className="label">What decision needs to be made?</label>
                <input value={thought.decisionNeeded} onChange={e => setThought(p => ({ ...p, decisionNeeded: e.target.value }))} placeholder="The decision you're postponing..." />
              </div>
            </Section>

            {/* Save */}
            <button onClick={saveEvening} className="btn-primary w-full">
              {evening.completed ? <><Check size={16} /> Saved — Update</> : 'Save Evening Entry'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
