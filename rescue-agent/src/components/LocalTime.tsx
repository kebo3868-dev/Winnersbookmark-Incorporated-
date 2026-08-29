'use client';

import { useEffect, useState } from 'react';

/**
 * A timestamp rendered in the VIEWER'S timezone.
 *
 * The audit list is a server component, so anything it formats is formatted in
 * the server's timezone — which for a Vercel deployment is UTC, and for an
 * operator in Florida is five hours wrong. Two audits run twenty minutes apart
 * over a lunch service are told apart by their clock time; a wrong clock time
 * makes that impossible.
 *
 * The server renders the ISO date, which is unambiguous and correct everywhere;
 * the client replaces it with local date and time once mounted. That ordering
 * matters: it keeps the markup identical on both sides of hydration, so the list
 * never flashes a mismatch.
 */
export default function LocalTime({ iso }: { iso: string }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    setLocal(
      date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      }),
    );
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {local ?? iso.slice(0, 10)}
    </time>
  );
}
