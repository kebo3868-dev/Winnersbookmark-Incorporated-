import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles } from 'lucide-react';
import Logo from './Logo';
import { nav } from '../data/site';

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-ink-deep/90 backdrop-blur-md border-b border-ink-line shadow-panel'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-[72px]">
          <Link to="/" className="shrink-0" aria-label="Winners Bookmark home">
            <Logo size={36} />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-gold-light'
                      : 'text-chalk hover:text-paper'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/membership" className="btn-gold hidden sm:inline-flex !px-4 !py-2.5 text-sm">
              <Sparkles size={15} />
              Start Free Trial
            </Link>
            <button
              className="icon-btn lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden border-t border-ink-line bg-ink-deep/95 backdrop-blur-md fade-in">
          <nav className="max-w-7xl mx-auto px-4 py-3 grid gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive ? 'text-gold-light bg-gold/10' : 'text-chalk hover:bg-ink-card'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/membership" className="btn-gold mt-2 w-full">
              <Sparkles size={16} />
              Start 7-Day Free Trial
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
