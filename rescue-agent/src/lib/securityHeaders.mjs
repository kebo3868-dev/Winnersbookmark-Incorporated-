/**
 * Security headers for every response (issue #72 hardening).
 *
 * Plain .mjs so next.config.mjs can import it without a build step, and tests
 * can assert on the exact list the server sends.
 *
 * Chosen to be safe for what this app actually does:
 * - Nothing here is meant to be framed by another site, so framing is refused
 *   (X-Frame-Options and CSP frame-ancestors, for old and new browsers).
 * - No Referer leaves the app. Evidence links open restaurants' own websites;
 *   the internal tool's address and audit ids are none of their business.
 * - The operator tool is never indexed.
 * - The CSP sets only directives that cannot break the app. A script-src
 *   policy would need per-request nonces for Next's inline scripts and is a
 *   separate change.
 * - HSTS without includeSubDomains: this host only, so no other service on a
 *   shared parent domain is affected.
 */
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];
