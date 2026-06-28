import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import PremiumGate from '../../components/PremiumGate';
import { TESTO_CARDS, TESTO_DISCLAIMER } from '../../data/testosterone';

export default function TestosteroneDetailScreen() {
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const { user } = useAuth();

  const card = TESTO_CARDS.find(c => c.id === cardId);

  // ── NOT FOUND ──
  if (!card) {
    return (
      <div className="page">
        <ScreenHeader title="Not Found" showBack />
        <div className="px-4 pt-8 flex flex-col items-center gap-4 text-center fade-in">
          <div className="empty">
            <p className="text-paper font-semibold mb-1">Content not found</p>
            <p className="text-ghost text-sm">
              This article could not be located. Please go back and try again.
            </p>
          </div>
          <button className="btn-gold" onClick={() => navigate('/testosterone')}>
            Back to Testosterone
          </button>
        </div>
      </div>
    );
  }

  // ── PREMIUM GATE CHECK ──
  const isLocked = card.isPremium && !user?.isPremium;

  // Category-based gradient
  const categoryGradients: Record<string, string> = {
    Recovery: 'linear-gradient(135deg, #0A1628 0%, #112244 50%, #0D1E3A 100%)',
    Training: 'linear-gradient(135deg, #0A1A0A 0%, #112211 50%, #0D220D 100%)',
    'Body Composition': 'linear-gradient(135deg, #1A0A28 0%, #2A1040 50%, #1A0A28 100%)',
    Lifestyle: 'linear-gradient(135deg, #1A1A0A 0%, #2A2A10 50%, #1A1A0A 100%)',
    Nutrition: 'linear-gradient(135deg, #1A0A0A 0%, #2A1010 50%, #1A0A0A 100%)',
  };
  const thumbnailBg =
    categoryGradients[card.category] ??
    'linear-gradient(135deg, #0D1117 0%, #161B27 50%, #1A2236 100%)';

  return (
    <div className="page pb-32 fade-in">
      <ScreenHeader
        title={card.title}
        showBack
        eyebrow={card.category}
      />

      {/* ── LARGE THUMBNAIL ── */}
      <div
        className="h-48 w-full flex flex-col items-center justify-center px-6 text-center"
        style={{ background: thumbnailBg }}
      >
        <p className="eyebrow text-gold/60 mb-2 tracking-widest">{card.category}</p>
        <h2 className="text-paper font-bold text-xl leading-snug line-clamp-3">{card.title}</h2>
      </div>

      <div className="px-4 pt-4 space-y-6">

        {/* ── PREMIUM GATE ── */}
        {isLocked && (
          <PremiumGate feature={`"${card.title}"`} />
        )}

        {/* Content hidden when locked */}
        {!isLocked && (
          <>
            {/* ── DISCLAIMER BAR ── */}
            <div className="border-l-4 border-gold bg-ink-panel rounded-r-lg p-3">
              <p className="text-xs text-ghost leading-relaxed">{TESTO_DISCLAIMER}</p>
            </div>

            {/* ── EXCERPT ── */}
            <p className="italic text-chalk text-lg leading-relaxed">{card.excerpt}</p>

            {/* ── KEY POINTS ── */}
            <div>
              <p className="label mb-2">Key Points</p>
              <div className="rule-gold mb-4" />
              <ul className="space-y-2.5">
                {card.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-gold shrink-0 mt-1.5" />
                    <span className="text-chalk text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── DEEP DIVE ── */}
            <div>
              <p className="label mb-2">Deep Dive</p>
              <div className="rule-gold mb-4" />
              {card.content.map((paragraph, i) => (
                <p key={i} className="text-chalk mb-4 leading-relaxed text-sm">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* ── CTA CARD ── */}
            <div className="glass card-pad rounded-xl flex flex-col items-center text-center gap-4">
              <p className="section-title">Apply What You've Learned</p>
              <p className="text-ghost text-sm leading-relaxed max-w-xs">
                Track your daily performance habits and build consistency over time.
              </p>
              <button
                className="btn-gold w-full"
                onClick={() => navigate('/testosterone')}
              >
                Back to Habit Tracker
              </button>
            </div>

            {/* ── DIVIDER ── */}
            <div className="divider" />

            {/* ── FOOTER ── */}
            <p className="text-center text-ghost text-sm pb-4">
              Designed by Winners Bookmark Incorporated
            </p>
          </>
        )}

        {/* Show back button even when locked */}
        {isLocked && (
          <button
            className="btn-ghost w-full"
            onClick={() => navigate('/testosterone')}
          >
            Back to Testosterone
          </button>
        )}
      </div>
    </div>
  );
}
