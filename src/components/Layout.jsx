import { useState } from 'react';
import TopBar from './TopBar';
import SideNav from './SideNav';
import BottomNav from './BottomNav';
import Footer from './Footer';

export default function Layout({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onMenu={() => setNavOpen(true)} />
      <div className="flex-1 w-full max-w-6xl mx-auto sm:px-6 px-0 flex">
        <SideNav open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="flex-1 min-w-0 fade-in">{children}</main>
      </div>
      <Footer />
      <BottomNav />
    </div>
  );
}
