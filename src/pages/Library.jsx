import { useState } from 'react';
import { BookOpen, Quote as QuoteIcon, Search, ChevronDown, ChevronUp } from 'lucide-react';
import QuoteCard from '../components/QuoteCard';
import { atomicQuotes, fourLaws } from '../data/quotes';

function LawCard({ law }) {
  const [open, setOpen] = useState(false);

  const gradients = {
    1: 'from-blue-600/20 to-blue-400/5 border-blue-500/30',
    2: 'from-purple-600/20 to-purple-400/5 border-purple-500/30',
    3: 'from-green-600/20 to-green-400/5 border-green-500/30',
    4: 'from-yellow-600/20 to-yellow-400/5 border-yellow-500/30',
  };

  const accentColors = {
    1: 'text-blue-400',
    2: 'text-purple-400',
    3: 'text-green-400',
    4: 'text-yellow-400',
  };

  return (
    <div className={`wb-card bg-gradient-to-br ${gradients[law.number]} transition-all duration-300`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="text-4xl">{law.icon}</span>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${accentColors[law.number]}`}>
                Law {law.number}
              </div>
              <h3 className="text-wb-white font-bold text-lg">{law.law}</h3>
              <p className="text-wb-muted text-xs mt-0.5">Inverse: {law.inverse}</p>
            </div>
          </div>
          {open
            ? <ChevronUp className="w-5 h-5 text-wb-muted flex-shrink-0 mt-1" />
            : <ChevronDown className="w-5 h-5 text-wb-muted flex-shrink-0 mt-1" />
          }
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 animate-fade-in border-t border-wb-border/30 pt-4">
          <p className="text-wb-muted text-sm leading-relaxed">{law.description}</p>
          <div>
            <h4 className={`text-sm font-semibold mb-2 ${accentColors[law.number]}`}>Key Tactics</h4>
            <ul className="space-y-2">
              {law.tactics.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-wb-muted">
                  <span className={`mt-1 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${accentColors[law.number]} border-current`}>
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function BookSummarySection() {
  const chapters = [
    {
      title: "The Surprising Power of Atomic Habits",
      insight: "A 1% improvement every day results in a 37x improvement over a year. Small habits compound just like money in a savings account.",
    },
    {
      title: "How Your Habits Shape Your Identity",
      insight: "The most effective way to change your habits is to focus not on what you want to achieve, but on who you wish to become. Identity-based habits start with deciding the type of person you want to be.",
    },
    {
      title: "The Habit Loop",
      insight: "Every habit follows a four-step feedback loop: cue → craving → response → reward. Understanding this loop lets you engineer new habits deliberately.",
    },
    {
      title: "Implementation Intentions",
      insight: "The formula is: 'I will [BEHAVIOR] at [TIME] in [LOCATION].' People who make a specific plan for when and where they will perform a new habit are significantly more likely to follow through.",
    },
    {
      title: "Habit Stacking",
      insight: "The formula is: 'After I [CURRENT HABIT], I will [NEW HABIT].' Link new behaviors to habits you already perform reliably.",
    },
    {
      title: "The Two-Minute Rule",
      insight: "When you start a new habit, it should take less than two minutes to do. Scale down any habit until it's easy. A habit must be established before it can be improved.",
    },
    {
      title: "The Cardinal Rule of Behavior Change",
      insight: "What is immediately rewarded is repeated. What is immediately punished is avoided. Give yourself an immediate, small reward for completing a habit.",
    },
    {
      title: "Never Miss Twice",
      insight: "Missing once is an accident. Missing twice is the start of a new (bad) habit. The first mistake is never the one that ruins you. It's the spiral that follows.",
    },
  ];

  return (
    <div className="space-y-3">
      {chapters.map((c, i) => (
        <div key={i} className="wb-card p-5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-wb-blue/10 border border-wb-blue/30 flex items-center justify-center text-wb-blue-glow text-xs font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div>
              <h3 className="text-wb-white font-semibold text-sm">{c.title}</h3>
              <p className="text-wb-muted text-sm mt-1 leading-relaxed">{c.insight}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Library() {
  const [tab, setTab] = useState('laws');
  const [search, setSearch] = useState('');

  const filteredQuotes = atomicQuotes.filter(q =>
    !search || q.quote.toLowerCase().includes(search.toLowerCase()) ||
    q.law.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { id: 'laws',    label: 'The Four Laws' },
    { id: 'quotes',  label: 'Quotes'        },
    { id: 'summary', label: 'Book Summary'  },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-wb-white">Atomic Habits Library</h1>
          <p className="text-wb-muted mt-1">
            Principles, quotes, and tactics from{' '}
            <span className="text-wb-blue-glow italic">Atomic Habits</span> by James Clear
          </p>
        </div>
        <div className="flex items-center gap-2 bg-wb-card border border-wb-border rounded-xl px-4 py-2 text-wb-muted text-sm">
          <BookOpen className="w-4 h-4 text-wb-blue" />
          <span>James Clear, 2018</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-wb-dark p-1 rounded-xl border border-wb-border w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? 'bg-wb-blue text-white shadow-blue-glow'
                : 'text-wb-muted hover:text-wb-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'laws' && (
        <div className="space-y-4">
          <p className="text-wb-muted text-sm">
            The Four Laws of Behavior Change — the complete framework for building good habits and breaking bad ones.
          </p>
          {fourLaws.map(law => (
            <LawCard key={law.number} law={law} />
          ))}
        </div>
      )}

      {tab === 'quotes' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wb-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quotes..."
              className="wb-input pl-10"
            />
          </div>
          {filteredQuotes.length === 0 && (
            <p className="text-wb-muted text-center py-8">No quotes match "{search}"</p>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {filteredQuotes.map(q => (
              <QuoteCard key={q.id} {...q} />
            ))}
          </div>
        </div>
      )}

      {tab === 'summary' && (
        <div className="space-y-4">
          <p className="text-wb-muted text-sm">
            Key insights from each chapter — your reference guide for building winning habits.
          </p>
          <BookSummarySection />
        </div>
      )}
    </div>
  );
}
