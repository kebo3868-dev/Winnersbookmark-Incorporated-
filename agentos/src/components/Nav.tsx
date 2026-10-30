import Link from 'next/link';
import { LogoutButton } from './client/LogoutButton';

export function TopBar({ storageKind, pendingApprovals }: { storageKind: 'postgres' | 'memory'; pendingApprovals: number }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-base font-bold tracking-tight">
            <span className="text-gold">Winnersbookmark</span> AgentOS
          </Link>
          <LogoutButton />
        </div>
        {storageKind === 'memory' && (
          <div data-testid="memory-store-banner" className="border-t border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
            Development storage: data is held in memory and lost on restart. Set DATABASE_URL for Supabase.
          </div>
        )}
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 text-center text-xs font-semibold">
          <Link href="/" className="px-2 py-3 text-slate-300 hover:text-gold">Dashboard</Link>
          <Link href="/tasks/new" className="px-2 py-3 text-slate-300 hover:text-gold" data-testid="nav-new-task">New task</Link>
          <Link href="/approvals" className="px-2 py-3 text-slate-300 hover:text-gold">
            Approvals{pendingApprovals > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-ink">{pendingApprovals}</span>}
          </Link>
        </div>
      </nav>
    </>
  );
}
