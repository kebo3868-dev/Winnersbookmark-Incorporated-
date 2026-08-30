/**
 * CUSTOMER-FACING DESTINATIONS vs BACKEND ENDPOINTS
 *
 * The audit answers one question about a transaction link: can a customer who
 * clicks it complete the action? That question is only meaningful about a page
 * a customer can actually land on.
 *
 * ── THE DEFECT THIS MODULE EXISTS TO PREVENT ────────────────────────────────
 *
 * A restaurant's site embedded a working SpotHopper reservation widget. The
 * widget's configuration also named a SpotHopper API endpoint, which the probe
 * dutifully GET-tested. The endpoint accepts POST only, so it answered
 *
 *     HTTP 405 Method Not Allowed
 *
 * and the audit reported the reservation pathway as VERIFIED BROKEN — a dead
 * end for booking-intent customers. It was nothing of the kind. 405 is the
 * server saying "this resource exists, but not for the method you used". It is
 * evidence the endpoint is alive and evidence that we tested it wrongly. It is
 * not evidence about the customer journey at all, because no customer ever
 * visits that URL.
 *
 * ── THE TWO RULES ───────────────────────────────────────────────────────────
 *
 *   1. A destination that is structurally an API endpoint can never produce a
 *      VERIFIED BROKEN customer pathway, whatever status it returns. Its result
 *      is kept as raw diagnostic evidence and nothing more.
 *   2. A 405 (or 501) is a statement about HTTP METHOD, never about
 *      availability. It downgrades a claim to "needs a human to complete the
 *      flow"; it never upgrades one to "broken".
 *
 * Both rules only ever REDUCE the confidence of a negative claim. Neither can
 * turn an unverified pathway into a working one.
 */

export type DestinationKind =
  /** A page a customer can land on and act in. */
  | 'CUSTOMER_FACING'
  /** A machine interface: JSON/RPC/webhook/data endpoint. No customer goes here. */
  | 'API_ENDPOINT'
  /** A script, stylesheet, image or font. Not a destination at all. */
  | 'STATIC_ASSET'
  /** Nothing in the URL says either way. */
  | 'UNKNOWN';

export interface DestinationClassification {
  kind: DestinationKind;
  /** Human-readable justification, carried into evidence so the call is auditable. */
  reason: string;
}

/**
 * Path shapes that mark a machine interface rather than a customer page.
 *
 * Each entry has to be something a restaurant would never put behind an "Order"
 * or "Book a table" button. `/order` and `/reservations` are deliberately
 * absent: those are exactly the customer pages this audit must keep testing.
 */
const API_PATH_PATTERNS: [RegExp, string][] = [
  [/(^|\/)api(\/|$)/i, 'path contains an /api/ segment'],
  [/(^|\/)apis(\/|$)/i, 'path contains an /apis/ segment'],
  [/(^|\/)graphql(\/|$)/i, 'GraphQL endpoint'],
  [/(^|\/)rest(\/|$)/i, 'path contains a /rest/ segment'],
  [/(^|\/)rpc(\/|$)/i, 'RPC endpoint'],
  [/(^|\/)wp-json(\/|$)/i, 'WordPress REST endpoint'],
  [/(^|\/)ajax(\/|$)/i, 'AJAX endpoint'],
  [/(^|\/)jsonapi(\/|$)/i, 'JSON:API endpoint'],
  [/(^|\/)xmlrpc\.php$/i, 'XML-RPC endpoint'],
  [/(^|\/)(webhook|webhooks|callback|callbacks)(\/|$)/i, 'webhook/callback endpoint'],
  [/(^|\/)oauth(\d)?(\/|$)/i, 'OAuth endpoint'],
  [/(^|\/)v\d{1,2}(\/|$)/i, 'versioned API path segment'],
  [/\.(?:json|xml)$/i, 'data document, not a page'],
  [/(^|\/)_next(\/|$)/i, 'framework internal route'],
];

/** Hostnames that only ever serve machine interfaces. */
const API_HOST_PATTERNS: [RegExp, string][] = [
  [/^api\./i, 'hostname is an API subdomain'],
  [/^apis?\d*\./i, 'hostname is an API subdomain'],
  [/^graph\./i, 'hostname is a graph API subdomain'],
  [/^webhooks?\./i, 'hostname is a webhook subdomain'],
];

/** Extensions that are assets. A bundle is not somewhere a customer can be sent. */
const ASSET_PATH =
  /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm|map|txt|gz|zip)$/i;

/**
 * HTTP statuses that describe the REQUEST METHOD rather than the resource.
 *
 * 405 Method Not Allowed and 501 Not Implemented both mean the server
 * understood the address and refused the verb. A GET-only prober reading either
 * as "the customer journey is dead" is reporting its own limitation as the
 * restaurant's defect.
 */
export const METHOD_SEMANTIC_STATUSES = new Set([405, 501]);

/** True when a status says "wrong method", not "broken destination". */
export function isMethodSemanticsRefusal(httpStatus: number | undefined): boolean {
  return typeof httpStatus === 'number' && METHOD_SEMANTIC_STATUSES.has(httpStatus);
}

/**
 * Classify a destination URL from its structure alone.
 *
 * Structure only, deliberately: this runs before and independently of any
 * network result, so a classification can never be talked into changing by the
 * status code it is about to be used to interpret.
 */
export function classifyDestination(rawUrl: string): DestinationClassification {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'UNKNOWN', reason: 'destination could not be parsed as a URL' };
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (ASSET_PATH.test(path)) {
    return { kind: 'STATIC_ASSET', reason: 'destination is a static asset file, not a page' };
  }
  for (const [pattern, reason] of API_HOST_PATTERNS) {
    if (pattern.test(host)) return { kind: 'API_ENDPOINT', reason };
  }
  for (const [pattern, reason] of API_PATH_PATTERNS) {
    if (pattern.test(path)) return { kind: 'API_ENDPOINT', reason };
  }
  // A `format=json` style parameter is a data request however the path reads.
  const format = (url.searchParams.get('format') ?? url.searchParams.get('output') ?? '').toLowerCase();
  if (format === 'json' || format === 'xml') {
    return { kind: 'API_ENDPOINT', reason: 'query string requests a data format rather than a page' };
  }

  return { kind: 'CUSTOMER_FACING', reason: 'destination has the shape of a page a customer can open' };
}

/** Convenience: is this a destination a customer could actually be sent to? */
export function isCustomerFacingDestination(rawUrl: string): boolean {
  return classifyDestination(rawUrl).kind === 'CUSTOMER_FACING';
}

/**
 * Why a probe did not succeed. Distinguishes the restaurant's problem from the
 * audit's own limitation, which is the difference between a finding and a
 * false accusation.
 *
 *   HTTP    — the server answered with a ≥400 status. The destination spoke.
 *   NETWORK — DNS failure, connection refused, TLS failure. A real dead end.
 *   TIMEOUT — no answer inside the audit's budget. Could equally be rate
 *             limiting aimed at the crawler. Demonstrates nothing.
 *   BLOCKED — the audit's own SSRF policy refused to follow. Our decision, not
 *             a customer-visible failure.
 */
export type ProbeFailureKind = 'HTTP' | 'NETWORK' | 'TIMEOUT' | 'BLOCKED';

/**
 * Whether a probe result may be reported as a VERIFIED BROKEN customer pathway.
 *
 * Any one of these refuses the claim:
 *   • the destination is not customer-facing — no customer meets this URL;
 *   • the status describes the request method, not the resource;
 *   • the destination responded successfully;
 *   • the failure was the audit's own limitation (timeout, safety block)
 *     rather than something a customer would hit.
 *
 * This is the single gate every "broken pathway" claim passes through, so the
 * rule cannot drift apart between reservations and ordering.
 */
export function mayClaimVerifiedBroken(probe: {
  url: string;
  finalUrl?: string;
  ok: boolean;
  httpStatus?: number;
  failureKind?: ProbeFailureKind;
}): { allowed: boolean; reason: string } {
  const target = probe.finalUrl ?? probe.url;
  const classification = classifyDestination(target);

  if (classification.kind !== 'CUSTOMER_FACING') {
    return {
      allowed: false,
      reason: `the destination tested is not customer-facing (${classification.reason})`,
    };
  }
  if (isMethodSemanticsRefusal(probe.httpStatus)) {
    return {
      allowed: false,
      reason:
        `HTTP ${probe.httpStatus} reports that the request method is not allowed. The destination exists and rejected ` +
        "the audit's GET request — that says nothing about whether a customer can complete the action",
    };
  }
  if (probe.ok) {
    return { allowed: false, reason: 'the destination responded successfully' };
  }

  const kind: ProbeFailureKind = probe.failureKind ?? (typeof probe.httpStatus === 'number' ? 'HTTP' : 'NETWORK');
  if (kind === 'TIMEOUT') {
    return {
      allowed: false,
      reason:
        'the destination did not answer inside the audit time budget. A timeout can equally be rate limiting aimed at ' +
        'an automated request, so it does not demonstrate a customer-facing failure',
    };
  }
  if (kind === 'BLOCKED') {
    return {
      allowed: false,
      reason: "the audit's own safety policy declined to follow this destination, so nothing about it was tested",
    };
  }
  return {
    allowed: true,
    reason:
      kind === 'HTTP'
        ? `a customer-facing destination returned HTTP ${probe.httpStatus}`
        : 'a customer-facing destination could not be connected to at the network level',
  };
}
