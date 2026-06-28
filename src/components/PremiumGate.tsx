import React from 'react';

interface PremiumGateProps {
  feature?: string;
  onUpgrade?: () => void;
}

export default function PremiumGate({ feature = 'this content', onUpgrade }: PremiumGateProps) {
  return (
    <div className="glass rounded-2xl overflow-hidden relative">
      {/* Blurred content hint */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-black/60 to-ink-black/95 z-10" />

      {/* Lock content */}
      <div className="relative z-20 p-6 flex flex-col items-center text-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 100%)', border: '1px solid rgba(212,175,55,0.3)' }}
        >
          <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <div>
          <p className="eyebrow mb-1">Premium</p>
          <h3 className="text-base font-bold text-paper mb-1">Unlock {feature}</h3>
          <p className="text-xs text-mist leading-relaxed">
            Upgrade to Winners Bookmark Premium for full access to advanced programs, premium content, and deeper analytics.
          </p>
        </div>

        <button
          onClick={onUpgrade}
          className="btn-gold w-full text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Upgrade to Premium
        </button>

        <p className="text-[10px] text-ghost">
          Premium subscription — cancel anytime · Scaffold only, no billing active
        </p>
      </div>
    </div>
  );
}
