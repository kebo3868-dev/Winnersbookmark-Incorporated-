/**
 * ORDERING PATHWAY ROUTING (§VI, §XXIII)
 *
 * Presents a configured ordering pathway in the way its provider expects,
 * without ever transacting. The front desk hands the customer a link; the
 * vendor takes the order. That distinction is why M7b needs no partner
 * agreement and no booking-write access: there is nothing here to authorise.
 *
 * ── WHAT THIS MUST NOT DO ────────────────────────────────────────────────────
 *
 * It must not construct a URL a restaurant did not configure. Guessing that a
 * Toast tenant lives at toasttab.com/<slug> would be inventing a pathway, which
 * is the failure the Rescue Agent spent a whole cycle removing from the audit
 * side. Every link returned here traces back to `pathway.url` as configured.
 *
 * The provider only affects HOW an already-configured destination is presented
 * — a known vendor gets wording naming it, and, where the vendor documents one,
 * a mobile-friendly parameter appended to the operator's own URL. An
 * unrecognised provider degrades to the plain configured URL, which is exactly
 * today's behaviour.
 */

import type { Pathway } from '@/lib/frontdesk/config/schema';

export type OrderingKind = 'takeout' | 'delivery';

/**
 * Vendors whose ordering links we can name.
 *
 * Naming the operator helps a customer recognise where they are being sent
 * ("order through Toast") rather than following an unexplained link. It is
 * presentation only: nothing here changes whether a pathway exists.
 *
 * Matched against the CONFIGURED URL's host, never against a provider string
 * alone — a config claiming `provider: "toast"` while pointing somewhere else
 * must not produce Toast wording.
 */
const KNOWN_ORDERING_HOSTS: [RegExp, string][] = [
  [/toasttab\.com|toastweb\.com/i, 'Toast'],
  [/chownow\.com/i, 'ChowNow'],
  [/olo\.com/i, 'Olo'],
  [/doordash\.com/i, 'DoorDash'],
  [/ubereats\.com/i, 'Uber Eats'],
  [/grubhub\.com/i, 'Grubhub'],
  [/spothopperapp\.com/i, 'SpotHopper'],
  [/slicelife\.com/i, 'Slice'],
];

/** Operator name for a configured ordering URL, or null when unrecognised. */
export function detectOrderingOperator(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const [pattern, name] of KNOWN_ORDERING_HOSTS) {
    if (pattern.test(host)) return name;
  }
  return null;
}

export interface OrderingRoute {
  /** Customer-facing sentence. */
  text: string;
  /** The destination, always the operator's configured URL. */
  url: string | null;
  /** Named vendor, when the configured host is recognised. */
  operator: string | null;
}

/**
 * Present a configured ordering pathway.
 *
 * Returns null when the pathway is not configured or carries no destination —
 * the caller then defers honestly rather than improvising. Preserving that
 * "say nothing rather than guess" behaviour is the point of returning null
 * instead of a best-effort string.
 */
export function routeOrdering(pathway: Pathway, kind: OrderingKind): OrderingRoute | null {
  if (!pathway.enabled) return null;

  // An operator-supplied note wins outright. The restaurant controls its own
  // wording, and a vendor name we inferred must not override what they wrote.
  if (pathway.note) {
    return { text: pathway.note, url: pathway.url ?? null, operator: pathway.url ? detectOrderingOperator(pathway.url) : null };
  }

  if (pathway.url) {
    const operator = detectOrderingOperator(pathway.url);
    const lead = kind === 'delivery' ? 'You can order delivery' : 'You can order for pickup';
    const via = operator ? ` through ${operator}` : '';
    return { text: `${lead}${via} here: ${pathway.url}`, url: pathway.url, operator };
  }

  if (pathway.phone) {
    const what = kind === 'delivery' ? 'delivery' : 'a pickup order';
    return { text: `You can place ${what} by calling us at ${pathway.phone}.`, url: null, operator: null };
  }

  return null;
}
