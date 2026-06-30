import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NavBar from './NavBar';
import Footer from './Footer';

// Scrolls to top on every route change so deep pages start at the hero.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
