import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PenSquare, Target, Cog, Lightbulb, BarChart3, BookOpen } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/daily', icon: PenSquare, label: 'Daily' },
  { path: '/goals', icon: Target, label: 'Goals' },
  { path: '/systems', icon: Cog, label: 'Systems' },
  { path: '/vault', icon: Lightbulb, label: 'Vault' },
  { path: '/reviews', icon: BookOpen, label: 'Reviews' },
  { path: '/insights', icon: BarChart3, label: 'Insights' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-wb-dark/95 backdrop-blur-lg border-t border-wb-border z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1 py-1.5">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 ${
                active
                  ? 'text-wb-blue-light'
                  : 'text-wb-muted hover:text-wb-white'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
