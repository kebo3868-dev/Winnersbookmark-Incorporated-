import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import ScreenHeader from '../../components/ScreenHeader';
import { TESTO_CARDS, HABIT_ITEMS, TESTO_DISCLAIMER } from '../../data/testosterone';

export default function TestosteroneScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { appState, toggleHabit } = useApp();
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const habits = appState.dailyHabits?.habits ?? {};
  const completedCount = HABIT_ITEMS.filter(item => habits[item.id] === true).length;
  const total = HABIT_ITEMS.length;
  const progressPct = Math.round((completedCount / total) * 100);

  return (
    <div className="page pb-32">
      <ScreenHeader
        title="Testosterone"
        subtitle="Performance Education"
      />

      <div className="px-4 pt-4 space-y-4 fade-in">

        {/* ── DISMISSABLE DISCLAIMER ── */}
        {showDisclaimer && (
          <div className="glass card-pad border-l-4 border-gold rounded-xl slide-up">
            <p className="eyebrow text-gold mb-1">Disclaimer</p>
            <p className="text-xs text-mist leading-relaxed mb-3">
              This content is for general wellness education only. It does not constitute medical
              advice, diagnosis, or treatment. Consult a qualified healthcare professional for any
              health concerns.
            </p>
            <button
              className="btn-gold text-xs py-1.5 px-4"
              onClick={() => setShowDisclaimer(false)}
            >
              Understand
            </button>
          </div>
        )}

        {/* ── A) INTRO CARD ── */}
        <div className="glass card-pad rounded-xl">
          <p className="eyebrow mb-1">Testosterone Habits</p>
          <h2 className="display-title mb-2">Support Your Performance</h2>
          <p className="text-chalk text-sm leading-relaxed mb-3">
            Evidence-based lifestyle habits that support a healthy hormonal environment.
          </p>
          <span className="label text-ghost text-xs">
            Lifestyle education only — not medical advice
          </span>
        </div>

        {/* ── B) HABIT TRACKER CARD ── */}
        <div className="glass card-pad rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-paper font-bold text-base">Daily Performance Checklist</h3>
            <span className="chip-gold text-xs font-bold">
              {completedCount} / {total} Today
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-ink-line rounded-full mb-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #D4AF37 0%, #F5D76E 100%)',
              }}
            />
          </div>

          {/* Habit list */}
          <ul className="space-y-1">
            {HABIT_ITEMS.map(item => {
              const checked = habits[item.id] === true;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => toggleHabit(item.id)}
                    className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all active:scale-[0.98] ${
                      checked
                        ? 'bg-ink-panel border border-gold/30'
                        : 'bg-ink-card border border-ink-line'
                    }`}
                  >
                    <span className="text-lg leading-none w-7 text-center shrink-0">
                      {item.icon}
                    </span>
                    <span
                      className={`flex-1 text-sm font-medium text-left ${
                        checked ? 'text-gold' : 'text-ghost'
                      }`}
                    >
                      {item.label}
                    </span>
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                        checked
                          ? 'border-gold bg-gold/20'
                          : 'border-ink-line bg-transparent'
                      }`}
                    >
                      {checked && (
                        <svg
                          className="w-3 h-3 text-gold"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── C) EDUCATION CARDS GRID ── */}
        <div>
          <h3 className="section-title mb-3">Performance Education</h3>
          <div className="grid grid-cols-2 gap-3">
            {TESTO_CARDS.map(card => (
              <button
                key={card.id}
                onClick={() => navigate(`/testosterone/detail/${card.id}`)}
                className="glass rounded-xl overflow-hidden border border-ink-line active:border-gold transition-colors text-left group"
              >
                {/* Thumbnail */}
                <div
                  className="h-24 flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, #0D1117 0%, #161B27 50%, #1A2236 100%)',
                  }}
                >
                  <span className="eyebrow text-gold/70 text-[10px] tracking-widest px-2 text-center leading-snug">
                    {card.category}
                  </span>
                </div>
                {/* Body */}
                <div className="p-3">
                  <p className="text-paper font-semibold text-xs leading-tight mb-1.5 line-clamp-2">
                    {card.title}
                  </p>
                  <span className="chip text-[10px] mb-1.5 inline-block">{card.category}</span>
                  <p className="text-ghost text-[11px] leading-snug line-clamp-2">{card.excerpt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── D) QUICK WINS ── */}
        <div className="glass card-pad rounded-xl">
          <h3 className="section-title mb-3">This Week's Focus</h3>
          <ul className="space-y-3">
            {[
              "Aim for 7–9 hours of sleep tonight",
              "Get 10 minutes of sunlight tomorrow morning",
              "Hit your protein target today",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-gold text-base leading-tight mt-0.5 shrink-0">•</span>
                <span className="text-chalk text-sm leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer disclaimer */}
        <p className="text-center text-ghost text-[11px] pb-2 px-2 leading-relaxed">
          {TESTO_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
