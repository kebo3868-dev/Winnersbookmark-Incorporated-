'use client';

import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/frontdesk/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: String(fields.get('tenantSlug') ?? '').trim(),
          email: String(fields.get('email') ?? '').trim(),
          password: String(fields.get('password') ?? ''),
        }),
      });
      if (!response.ok) {
        setError(response.status === 401
          ? 'Unable to sign in. Check your restaurant slug, email, and password.'
          : 'Sign in is temporarily unavailable. Please try again.');
        return;
      }
      // A full navigation discards any anonymous RSC/router cache. A fixed
      // destination also avoids accepting an attacker-controlled return URL.
      window.location.assign('/frontdesk');
    } catch {
      setError('Sign in is temporarily unavailable. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={signIn} className="space-y-4" aria-busy={pending}>
      <div>
        <label htmlFor="tenantSlug" className="label block mb-2">Restaurant slug</label>
        <input id="tenantSlug" name="tenantSlug" type="text" required maxLength={100}
          autoCapitalize="none" spellCheck={false} className="input w-full" />
      </div>
      <div>
        <label htmlFor="email" className="label block mb-2">Email</label>
        <input id="email" name="email" type="email" required maxLength={320}
          autoComplete="username" autoCapitalize="none" className="input w-full" />
      </div>
      <div>
        <label htmlFor="password" className="label block mb-2">Password</label>
        <input id="password" name="password" type="password" required maxLength={400}
          autoComplete="current-password" className="input w-full" />
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-50">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
