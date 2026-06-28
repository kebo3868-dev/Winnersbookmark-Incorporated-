import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/welcome', { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="page flex flex-col items-center justify-between min-h-screen bg-ink-black">
      {/* Top spacer */}
      <div className="flex-1" />

      {/* Center — Logo block */}
      <div className="flex flex-col items-center gap-6 fade-in">
        {/* Geometric W / Crown mark */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-20 h-20"
          >
            <defs>
              <linearGradient id="goldGradSplash" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f5d97a" />
                <stop offset="50%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#a07c1c" />
              </linearGradient>
            </defs>
            {/* Outer hexagon frame */}
            <polygon
              points="40,4 72,22 72,58 40,76 8,58 8,22"
              stroke="url(#goldGradSplash)"
              strokeWidth="2"
              fill="none"
              opacity="0.4"
            />
            {/* Crown / W shape */}
            <polyline
              points="16,52 24,28 32,44 40,24 48,44 56,28 64,52"
              stroke="url(#goldGradSplash)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Crown base bar */}
            <line
              x1="16"
              y1="56"
              x2="64"
              y2="56"
              stroke="url(#goldGradSplash)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-gradient-gold font-black tracking-[0.25em] text-2xl uppercase leading-none">
            WINNERS BOOKMARK
          </span>
          <span className="text-paper font-bold tracking-[0.4em] text-sm uppercase leading-none">
            FITNESS
          </span>
        </div>

        {/* Rule */}
        <div className="rule-gold w-24" />

        {/* Tagline */}
        <p className="text-chalk text-sm tracking-widest uppercase text-center">
          Built for the men who decide.
        </p>

        {/* Gold loading spinner */}
        <div className="mt-4">
          <div
            className="w-8 h-8 rounded-full border-2 border-ink-line border-t-gold animate-spin"
            aria-label="Loading"
          />
        </div>
      </div>

      {/* Bottom brand credit */}
      <div className="flex-1 flex items-end pb-10">
        <p className="text-ghost text-xs tracking-wider text-center">
          Designed by Winners Bookmark Incorporated
        </p>
      </div>
    </div>
  );
}
