import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { label: 'Personalized Training', chip: 'chip-gold' },
  { label: 'Expert Nutrition', chip: 'chip-gold' },
  { label: 'Testosterone Habits', chip: 'chip-blue' },
  { label: 'Progress Tracking', chip: 'chip-blue' },
];

export default function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="page min-h-screen bg-ink-black flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Hero section */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">

          {/* Gold mark */}
          <div className="mb-8 fade-in">
            <svg
              viewBox="0 0 60 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16 mx-auto"
            >
              <defs>
                <linearGradient id="goldGradWelcome" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f5d97a" />
                  <stop offset="50%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#a07c1c" />
                </linearGradient>
              </defs>
              <polyline
                points="8,44 16,20 24,36 30,16 36,36 44,20 52,44"
                stroke="url(#goldGradWelcome)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <line
                x1="8"
                y1="48"
                x2="52"
                y2="48"
                stroke="url(#goldGradWelcome)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Brand name */}
          <div className="text-center mb-2 slide-up">
            <div className="text-gradient-gold font-black tracking-[0.2em] text-3xl uppercase leading-tight">
              WINNERS BOOKMARK
            </div>
            <div className="text-paper font-black tracking-[0.5em] text-4xl uppercase mt-1">
              FITNESS
            </div>
          </div>

          {/* Rule */}
          <div className="rule-gold w-20 my-6" />

          {/* Tagline */}
          <p className="hero-title text-center text-paper leading-snug mb-3 slide-up" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Elite coaching. Masculine physique.<br />Consistent results.
          </p>

          {/* Sub-copy */}
          <p className="text-mist text-sm text-center leading-relaxed mb-10 max-w-xs slide-up">
            The complete fitness system built for men who take their training seriously.
          </p>

          {/* CTAs */}
          <div className="w-full flex flex-col gap-3 mb-12">
            <button
              className="btn-gold w-full text-base font-bold tracking-wide"
              onClick={() => navigate('/signup')}
            >
              Create Account
            </button>
            <button
              className="btn-ghost w-full text-base font-semibold tracking-wide"
              onClick={() => navigate('/signin')}
            >
              Sign In
            </button>
          </div>

          {/* What's Inside */}
          <div className="w-full">
            <p className="eyebrow text-center mb-4">What's Inside</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {FEATURES.map((f) => (
                <span key={f.label} className={f.chip}>
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="py-6 text-center">
          <p className="text-ghost text-xs tracking-wider">
            Designed by Winners Bookmark Incorporated
          </p>
        </div>
      </div>
    </div>
  );
}
