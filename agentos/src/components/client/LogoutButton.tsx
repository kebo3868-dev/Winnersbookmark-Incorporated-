'use client';

import { postJson } from './post';

export function LogoutButton() {
  return (
    <button
      type="button"
      className="text-xs font-semibold text-slate-400 hover:text-slate-100"
      onClick={async () => {
        await postJson('/api/auth/logout');
        window.location.href = '/login';
      }}
    >
      Sign out
    </button>
  );
}
