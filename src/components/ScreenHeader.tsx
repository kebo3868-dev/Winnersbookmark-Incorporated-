import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  eyebrow?: string;
}

export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  eyebrow,
}: ScreenHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <div className="sticky top-0 z-30 pt-safe" style={{ background: 'linear-gradient(180deg, rgba(5,6,13,0.98) 0%, rgba(5,6,13,0.92) 100%)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="icon-btn shrink-0"
            aria-label="Go back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
          <h1 className="section-title truncate">{title}</h1>
          {subtitle && <p className="text-xs text-mist mt-0.5 truncate">{subtitle}</p>}
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
      <div className="rule-gold mx-4" />
    </div>
  );
}
