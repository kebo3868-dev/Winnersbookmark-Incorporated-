import { NavLink } from 'react-router-dom';
import { NAV_SECTIONS } from '../lib/commandCenterData';
import { Home, Target, BarChart3, ClipboardCheck, User } from 'lucide-react';

const mobileNav = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Goals', to: '/roadmap', icon: Target },
  { label: 'Tracker', to: '/progress', icon: BarChart3 },
  { label: 'Reviews', to: '/weekly-review', icon: ClipboardCheck },
  { label: 'Profile', to: '/profile', icon: User },
];

export default function CommandLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-wb-black text-wb-white">
      <div className="md:grid md:grid-cols-[280px_1fr]">
        <aside className="hidden md:block border-r border-wb-border bg-wb-card2 min-h-screen p-4 sticky top-0">
          <h1 className="text-lg font-bold mb-1">Keith Warren 12-Month Command Center</h1>
          <p className="text-xs text-wb-muted mb-4">Build the Man. Build the Skill. Build the Empire.</p>
          <nav className="space-y-1">
            {NAV_SECTIONS.map((item) => (
              <NavLink key={item.key} to={item.path} className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-wb-blue text-white' : 'text-wb-muted hover:text-white hover:bg-wb-border/40'}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="pb-24 md:pb-10 max-w-6xl w-full mx-auto px-4 md:px-8 py-4 md:py-7">
          <h2 className="text-2xl font-bold mb-4">{title}</h2>
          {children}
          <footer className="text-center text-xs text-wb-muted mt-8 border-t border-wb-border pt-4">Designed by Winnersbookmark Incorporated</footer>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-wb-card2 border-t border-wb-border px-2 py-2 grid grid-cols-5 z-50">
        {mobileNav.map(({ label, to, icon: Icon }) => (
          <NavLink key={label} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 rounded-md py-1 text-[11px] ${isActive ? 'text-wb-blue-light' : 'text-wb-muted'}`}>
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
