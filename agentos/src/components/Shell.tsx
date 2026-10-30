import { getStore } from '@/lib/store';
import { TopBar } from './Nav';

/** Authenticated page frame. Callers must have passed requireOwnerPage(). */
export async function Shell({ children }: { children: React.ReactNode }) {
  const store = getStore();
  const pending = await store.listApprovals({ status: 'pending' });
  return (
    <>
      <TopBar storageKind={store.kind} pendingApprovals={pending.length} />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">{children}</main>
    </>
  );
}
