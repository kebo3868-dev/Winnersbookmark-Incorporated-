import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, Trophy } from 'lucide-react';

const navLinks = [
  { to: '/',           label: 'Dashboard' },
  { to: '/tracker',    label: 'Tracker'   },
  { to: '/goals',      label: 'Goal Setter'},
  { to: '/library',    label: 'AH Library'},
  { to: '/pricing',    label: 'Pricing'   },
];

export default function Navbar({ trialDays }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-wb-black/90 backdrop-blur-md border-b border-wb-border">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <Trophy className="w-6 h-6 text-wb-blue group-hover:text-wb-blue-glow transition-colors" />
          <div>
            <span className="text-wb-white font-bold text-sm leading-none block">Winners Bookmark</span>
            <span className="text-wb-muted text-xs leading-none">Incorporated</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-wb-blue text-white shadow-blue-glow'
                    : 'text-wb-muted hover:text-wb-white hover:bg-wb-card'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Trial badge */}
        <div className="hidden md:flex items-center gap-3">
          {trialDays !== null && (
            <div className="bg-wb-card border border-wb-border rounded-full px-3 py-1 text-xs text-wb-muted">
              <span className="text-wb-blue-glow font-semibold">{trialDays}d</span> free trial
            </div>
          )}
          <Link to="/pricing" className="wb-btn-primary text-sm py-2 px-4">
            Get Access
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-wb-muted hover:text-wb-white p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-wb-dark border-t border-wb-border animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-wb-blue text-white'
                      : 'text-wb-muted hover:text-wb-white hover:bg-wb-card'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <div className="pt-2 pb-1">
              <Link
                to="/pricing"
                onClick={() => setOpen(false)}
                className="wb-btn-primary w-full justify-center text-sm"
              >
                Get Access — 30 Days Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
