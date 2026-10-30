import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { authConfig, SESSION_COOKIE, verifySession } from '@/lib/auth/session';
import { LoginForm } from '@/components/client/LoginForm';

// PUBLIC PAGE: the sign-in form. Shows nothing but the form.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/');
  const configured = authConfig().ok;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold"><span className="text-gold">Winnersbookmark</span> AgentOS</h1>
      <p className="mb-6 text-sm text-slate-400">Private founder console.</p>
      {configured ? (
        <div className="card"><LoginForm /></div>
      ) : (
        <div className="card text-sm text-amber-200">Access is not configured on this deployment. See docs/ENVIRONMENT.md.</div>
      )}
    </main>
  );
}
