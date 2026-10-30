'use client';

import { useState } from 'react';
import { errorText, postJson } from './post';

/**
 * Uncontrolled on purpose: the password is read from the form at submit, so
 * anything typed before the page hydrates (a slow phone on a weak signal) is
 * kept rather than silently dropped.
 */
export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get('password') ?? '');
        if (!password) return;
        setBusy(true);
        setError(null);
        const result = await postJson('/api/auth/login', { password });
        if (result.ok) {
          window.location.href = '/';
          return;
        }
        setBusy(false);
        setError(errorText(result));
      }}
    >
      <div>
        <label htmlFor="password" className="label">Owner password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {error && <p role="alert" data-testid="login-error" className="text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
