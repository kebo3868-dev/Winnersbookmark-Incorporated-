import { useState } from 'react';
import { Check, Zap, Trophy, Crown, ExternalLink, Shield, Star } from 'lucide-react';
import { startTrial, getTrialDaysRemaining, isTrialActive } from '../data/storage';

// UPDATE THIS to your actual Gumroad product URL when ready
const GUMROAD_URL = 'https://gumroad.com/l/winners-bookmark-habit-tracker';

const features = {
  free: [
    'Track 4 core habits (sleep, meditation, journal, workout)',
    '30-day streak tracking',
    'Atomic Habits Library (4 laws + quotes)',
    '1 saved custom goal',
    'Basic calendar heatmap',
  ],
  pro: [
    'Unlimited custom habit tracking',
    'Full streak history + heatmaps (all time)',
    'Complete Atomic Habits Library (18+ quotes)',
    'Unlimited goal plans with 4-week roadmaps',
    'Identity reframing engine',
    'Habit milestone badges & rewards',
    'Export your data (CSV)',
    'Early access to new features',
    'Support Winners Bookmark Incorporated',
  ],
};

function FeatureRow({ text, included = true }) {
  return (
    <li className={`flex items-start gap-2.5 text-sm ${included ? 'text-wb-white' : 'text-wb-muted line-through'}`}>
      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${included ? 'text-wb-blue-glow' : 'text-wb-border'}`} />
      {text}
    </li>
  );
}

export default function Pricing({ onStartTrial }) {
  const trialActive = isTrialActive();
  const daysLeft = getTrialDaysRemaining();
  const [clicked, setClicked] = useState(false);

  function handleTrialStart() {
    startTrial();
    setClicked(true);
    if (onStartTrial) onStartTrial();
  }

  function handleGumroadClick() {
    window.open(GUMROAD_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-10 animate-slide-up">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-wb-blue/10 border border-wb-blue/30 text-wb-blue-glow text-sm px-4 py-1.5 rounded-full">
          <Zap className="w-4 h-4" />
          30-Day Free Trial — No Credit Card Required
        </div>
        <h1 className="text-4xl font-bold text-wb-white">
          Invest in Your{' '}
          <span className="text-gradient-blue">Daily Wins</span>
        </h1>
        <p className="text-wb-muted max-w-xl mx-auto">
          Winners Bookmark Incorporated is built for operators who want to build winning habits
          and stay accountable. Powered by the Atomic Habits framework.
        </p>
      </div>

      {/* Trial status banner */}
      {trialActive && (
        <div className="bg-wb-blue/10 border border-wb-blue/30 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-wb-blue/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-wb-blue-glow" />
            </div>
            <div>
              <p className="text-wb-white font-semibold text-sm">Free Trial Active</p>
              <p className="text-wb-muted text-xs">{daysLeft} days remaining</p>
            </div>
          </div>
          <div className="h-2 flex-1 min-w-32 bg-wb-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-wb-blue to-wb-blue-glow rounded-full"
              style={{ width: `${(daysLeft / 30) * 100}%` }}
            />
          </div>
          <button onClick={handleGumroadClick} className="wb-btn-primary text-sm py-2">
            Upgrade on Gumroad <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Free / Trial card */}
        <div className="wb-card p-7 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-wb-muted" />
              <span className="text-wb-muted font-semibold uppercase text-xs tracking-wider">Free Trial</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold text-wb-white">$0</span>
              <span className="text-wb-muted mb-2">/ 30 days</span>
            </div>
            <p className="text-wb-muted text-sm mt-2">
              Start building momentum. No card. No commitment.
            </p>
          </div>
          <ul className="space-y-2.5">
            {features.free.map(f => <FeatureRow key={f} text={f} />)}
          </ul>
          <button
            onClick={handleTrialStart}
            disabled={trialActive || clicked}
            className="wb-btn-secondary w-full justify-center disabled:opacity-50 disabled:cursor-default"
          >
            {trialActive || clicked ? (
              <><Check className="w-4 h-4 text-green-400" /> Trial Active</>
            ) : (
              'Start Free Trial'
            )}
          </button>
        </div>

        {/* Pro card */}
        <div className="relative wb-card p-7 space-y-6 border-wb-blue shadow-blue-glow">
          {/* Popular badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div className="bg-wb-blue text-white text-xs font-bold px-4 py-1 rounded-full shadow-blue-glow">
              BEST VALUE
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-wb-blue-glow" />
              <span className="text-wb-blue-glow font-semibold uppercase text-xs tracking-wider">Pro — Lifetime</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold text-wb-white">$27</span>
              <span className="text-wb-muted mb-2">one-time</span>
            </div>
            <p className="text-wb-muted text-sm mt-2">
              One payment. Lifetime access. Build discipline forever.
            </p>
          </div>

          <ul className="space-y-2.5">
            {features.pro.map(f => <FeatureRow key={f} text={f} />)}
          </ul>

          <div className="space-y-3">
            <button
              onClick={handleGumroadClick}
              className="wb-btn-primary w-full justify-center text-base py-3.5"
            >
              <Trophy className="w-5 h-5" />
              Get Lifetime Access — $27
              <ExternalLink className="w-4 h-4" />
            </button>
            <p className="text-wb-muted text-xs text-center">
              Powered by Gumroad • Secure checkout • Instant access
            </p>
          </div>
        </div>
      </div>

      {/* Social proof / guarantee */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
        {[
          { icon: '🔒', title: 'Secure Payment', body: 'All transactions processed securely through Gumroad.' },
          { icon: '⚡', title: 'Instant Access', body: 'Start tracking immediately after purchase. No setup required.' },
          { icon: '🔄', title: '30-Day Guarantee', body: 'Not satisfied? Contact us within 30 days for a full refund.' },
        ].map(({ icon, title, body }) => (
          <div key={title} className="wb-card p-5 text-center space-y-2">
            <span className="text-3xl">{icon}</span>
            <h3 className="text-wb-white font-semibold text-sm">{title}</h3>
            <p className="text-wb-muted text-xs leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Quote footer */}
      <div className="max-w-2xl mx-auto text-center py-4">
        <p className="text-wb-muted italic text-lg">
          "Every action you take is a vote for the type of person you wish to become."
        </p>
        <p className="text-wb-blue-glow text-sm mt-2">— James Clear, Atomic Habits</p>
      </div>
    </div>
  );
}
