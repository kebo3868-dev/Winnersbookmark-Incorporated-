import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  { id: 'home', label: 'Home', path: '/', icon: HomeIcon },
  { id: 'training', label: 'Train', path: '/training', icon: TrainIcon },
  { id: 'nutrition', label: 'Fuel', path: '/nutrition', icon: NutritionIcon },
  { id: 'progress', label: 'Progress', path: '/progress', icon: ProgressIcon },
  { id: 'more', label: 'More', path: '/library', icon: MoreIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function TrainIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function NutritionIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = TABS.find(t => {
    if (t.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(t.path);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div
        className="w-full max-w-md"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(5,6,13,0.97) 15%)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          className="mx-3 mb-2 flex items-center justify-around rounded-2xl border border-ink-line"
          style={{
            background: 'linear-gradient(180deg, rgba(15,22,49,0.97) 0%, rgba(8,11,24,0.99) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {TABS.map(tab => {
            const isActive = activeTab?.id === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-1 px-3 py-3 flex-1 transition-all duration-200 rounded-xl ${
                  isActive ? 'text-gold' : 'text-ghost hover:text-chalk'
                }`}
              >
                <Icon active={isActive} />
                <span className="text-[10px] font-semibold tracking-wider uppercase leading-none">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gold" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
