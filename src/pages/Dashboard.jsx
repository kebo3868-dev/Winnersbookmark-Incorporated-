import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getDailyCroak } from '../data/croaks';
import { getDailyAdvice } from '../data/advice';
import { todayKey, formatDate } from '../lib/dates';
import ScoreRing from '../components/ScoreRing';
import Layout from '../components/Layout';
import {
  Flame, PenSquare, Target, Skull, Lightbulb,
  ChevronRight, Bookmark, Sun, Moon
} from 'lucide-react';

export default function Dashboard() {
  const { profile, todayEntry, streak, todayScore, goals, brainstorms, systems, entries } = useApp();
  const navigate = useNavigate();
  const today = todayKey();
  const croak = getDailyCroak(today);
  const advice = getDailyAdvice(today);
  const hasMorning = todayEntry?.morning?.completed;
  const hasEvening = todayEntry?.evening?.completed;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const recentBrainstorms = brainstorms.slice(-3).reverse();
  const activeSystems = systems.filter(s => s.active).length;

  return (
    <Layout>
      <div className="page-container space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bookmark size={20} className="text-wb-blue-light" />
              <span className="text-xs font-medium text-wb-muted uppercase tracking-wider">Winner's Bookmark Daily</span>
            </div>
            <h1 className="text-xl font-bold">{greeting}, {profile?.name || 'Champion'}</h1>
            <p className="text-sm text-wb-muted">{formatDate(today)}</p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 bg-wb-gold/10 border border-wb-gold/20 px-3 py-1.5 rounded-full">
              <Flame size={16} className="text-wb-gold" />
              <span className="text-sm font-bold text-wb-gold">{streak}</span>
            </div>
          )}
        </div>

        {/* Entry Status */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="section-title">Today's Entry</span>
            <button onClick={() => navigate('/daily')} className="text-wb-blue-light text-sm font-medium flex items-center gap-1">
              Open <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/daily')}
              className={`flex-1 p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                hasMorning ? 'bg-wb-blue/10 border-wb-blue/30 text-wb-blue-light' : 'bg-wb-card border-wb-border text-wb-muted'
              }`}
            >
              <Sun size={16} />
              <span className="text-sm font-medium">Morning {hasMorning ? '✓' : ''}</span>
            </button>
            <button
              onClick={() => navigate('/daily')}
              className={`flex-1 p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                hasEvening ? 'bg-wb-blue/10 border-wb-blue/30 text-wb-blue-light' : 'bg-wb-card border-wb-border text-wb-muted'
              }`}
            >
              <Moon size={16} />
              <span className="text-sm font-medium">Evening {hasEvening ? '✓' : ''}</span>
            </button>
          </div>
        </div>

        {/* Score + 90-Day Mission */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card flex flex-col items-center justify-center py-5">
            <ScoreRing score={todayScore} size={72} />
            <span className="text-xs text-wb-muted mt-2">Alignment</span>
          </div>
          <div className="card flex flex-col justify-center">
            <span className="label">90-Day Mission</span>
            <p className="text-sm text-wb-white leading-relaxed line-clamp-3">
              {goals.ninetyDay || 'Not set yet'}
            </p>
            <button onClick={() => navigate('/goals')} className="text-xs text-wb-blue-light mt-2 flex items-center gap-1">
              View goals <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Top 3 Priorities */}
        {todayEntry?.morning?.priorities?.some(p => p) && (
          <div className="card space-y-2">
            <span className="section-title">Today's Priorities</span>
            {todayEntry.morning.priorities.filter(Boolean).map((p, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1">
                <span className="w-5 h-5 rounded-full bg-wb-blue/20 text-wb-blue-light text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                  {i + 1}
                </span>
                <span className="text-sm text-wb-white">{p}</span>
              </div>
            ))}
          </div>
        )}

        {/* Daily Croak */}
        <div className="card border-wb-border/50 space-y-2">
          <div className="flex items-center gap-2">
            <Skull size={16} className="text-wb-muted" />
            <span className="section-title">Daily Croak</span>
          </div>
          <p className="text-sm text-wb-gold italic leading-relaxed">"{croak.prompt}"</p>
          <p className="text-xs text-wb-muted">{croak.hardTruth}</p>
        </div>

        {/* Daily Advice */}
        <div className="card space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-wb-blue-light" />
            <span className="section-title">{advice.title}</span>
          </div>
          <p className="text-sm text-wb-muted leading-relaxed">{advice.lesson}</p>
          <div className="pt-1">
            <span className="text-xs text-wb-blue-light font-medium">Apply today: </span>
            <span className="text-xs text-wb-muted">{advice.howToApply}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-3">
            <span className="text-lg font-bold text-wb-white">{activeSystems}</span>
            <span className="text-xs text-wb-muted block mt-0.5">Systems</span>
          </div>
          <div className="card text-center py-3">
            <span className="text-lg font-bold text-wb-white">{brainstorms.length}</span>
            <span className="text-xs text-wb-muted block mt-0.5">Ideas</span>
          </div>
          <div className="card text-center py-3">
            <span className="text-lg font-bold text-wb-white">{Object.keys(entries).length}</span>
            <span className="text-xs text-wb-muted block mt-0.5">Entries</span>
          </div>
        </div>

        {/* Recent Brainstorms */}
        {recentBrainstorms.length > 0 && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <span className="section-title">Recent Ideas</span>
              <button onClick={() => navigate('/vault')} className="text-wb-blue-light text-sm flex items-center gap-1">
                All <ChevronRight size={14} />
              </button>
            </div>
            {recentBrainstorms.map(b => (
              <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-wb-border/50 last:border-0">
                <span className="text-sm text-wb-white">{b.title}</span>
                <span className="text-xs text-wb-muted capitalize">{b.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
