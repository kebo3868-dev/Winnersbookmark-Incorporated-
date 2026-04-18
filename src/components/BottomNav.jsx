import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, BarChart3, RefreshCcw, Target } from 'lucide-react';

const NAV = [
  { path: '/',              icon: LayoutDashboard, label: 'Home' },
  { path: '/accounts',      icon: Wallet,          label: 'Money' },
  { path: '/budget',        icon: BarChart3,        label: 'Budget' },
  { path: '/subscriptions', icon: RefreshCcw,       label: 'Recurring' },
  { path: '/goals',         icon: Target,           label: 'Goals' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-wb-dark/95 backdrop-blur-lg border-t border-wb-border z-50 safe-area-pb">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1 py-2">
        {NAV.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0 ${
                active ? 'text-wb-blue-light' : 'text-wb-muted hover:text-wb-white'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-wb-blue/15' : ''}`}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-wb-blue-light' : ''}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
