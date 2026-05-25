import type { ReactNode } from 'react';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import SideNav from './SideNav';
import ToastContainer from './Toast';

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-ink-line bg-ink-deep/80 backdrop-blur-sm sticky top-0 z-30">
      <button onClick={onMenuClick} className="icon-btn">
        <Menu size={18} />
      </button>
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-paper">Restaurant AI</p>
        <span className="text-mist text-sm">·</span>
        <p className="text-sm text-gold">Revenue Agent</p>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-noir">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 border-r border-ink-line bg-ink-deep/60 backdrop-blur-sm">
        <SideNav />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[240px] bg-ink-deep border-r border-ink-line shadow-panel-lg">
            <SideNav onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
            {children}
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
