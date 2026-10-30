/**
 * Security headers for every response. Plain .mjs so next.config.mjs can
 * import it without a build step and tests can assert on the exact list.
 *
 * AgentOS is a private founder console: it is never framed, never indexed,
 * sends no Referer, and asks for no device permissions. The CSP sets only
 * directives that cannot break Next's inline bootstrap scripts; a nonce-based
 * script-src is a separate hardening step (see docs/DEPLOYMENT_CHECKLIST.md).
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
