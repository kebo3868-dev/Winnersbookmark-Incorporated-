import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, Layers, Sparkles } from 'lucide-react';

const ITEMS = [
  { to: '/',             label: 'Studio',   icon: LayoutDashboard, end: true },
  { to: '/projects',     label: 'Projects', icon: FolderKanban },
  { to: '/templates',    label: 'Spark',    icon: Sparkles },
  { to: '/master',       label: 'Prompts',  icon: Layers },
  { to: '/settings',     label: 'Settings', icon: Users },
];

export default function BottomNav() {
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-ink-line bg-ink-black/85 backdrop-blur-md safe-bottom">
      <div className="max-w-3xl mx-auto px-2 py-1.5 grid grid-cols-5 gap-1">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 rounded-lg text-[10.5px] font-medium ${
                isActive ? 'text-gold-light' : 'text-mist'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8}
                  className={isActive ? 'drop-shadow-[0_0_8px_rgba(212,175,55,0.55)]' : ''} />
                <span className="mt-0.5">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
