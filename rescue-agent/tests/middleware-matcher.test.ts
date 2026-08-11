import { describe, expect, it } from 'vitest';
import { config } from '@/middleware';

/**
 * THE ROOT PAGE WAS SERVED WITHOUT AUTHENTICATION IN PRODUCTION.
 *
 * The middleware function itself was never wrong. What was wrong was the rule
 * deciding WHEN Next.js invokes it:
 *
 *   matcher: ['/((?!api/health|...).*)']
 *
 * Matcher strings compile through path-to-regexp, where `(...)` is an
 * anonymous parameter that must match AT LEAST ONE character. For a request to
 * `/` that group would have to match the empty string, so the pattern does not
 * match the root and the middleware never ran there. Every deeper path has a
 * non-empty segment, matched, and was challenged correctly — which is exactly
 * why this looked fine from the inside.
 *
 * The Command Center lives at `/`. Client names, audit history and failure
 * diagnostics were readable by anyone who knew the hostname.
 *
 * Why no existing test caught it: every middleware test calls the middleware
 * FUNCTION directly with a synthetic request. That bypasses the matcher
 * entirely, so a suite can be perfectly green while the middleware is never
 * invoked in production. This file tests the matcher instead — the routing
 * rule, not the handler.
 */

/**
 * Models path-to-regexp's behaviour for the one rule that caused this incident:
 * an anonymous parameter must consume at least one character.
 *
 * Deliberately not a general path-to-regexp implementation. It reproduces the
 * specific semantics that made `/` slip through, so the assertions below fail
 * if someone collapses the matcher back into a single wildcard pattern.
 */
function matcherCovers(pattern: string, pathname: string): boolean {
  const open = pattern.indexOf('(');
  if (open === -1) return pattern === pathname;

  const prefix = pattern.slice(0, open);
  const inner = pattern.slice(open + 1, pattern.lastIndexOf(')'));
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${escapedPrefix}(${inner})$`).exec(pathname);

  // The parameter must match at least one character — the crux of the bug.
  return Boolean(match && match[1].length > 0);
}

const patterns = config.matcher as string[];
const covered = (pathname: string) => patterns.some((pattern) => matcherCovers(pattern, pathname));

describe('middleware matcher', () => {
  it('covers the root path, so the Command Center is behind authentication', () => {
    // The regression. Before the fix this was false in production.
    expect(covered('/')).toBe(true);
  });

  it('still covers every authenticated surface', () => {
    for (const pathname of [
      '/leads',
      '/audits',
      '/audits/abc123',
      '/frontdesk',
      '/frontdesk/demo-bistro',
      '/api/audits',
      '/api/leads/abc123',
      '/api/frontdesk/demo-bistro/readiness',
    ]) {
      expect(covered(pathname), `${pathname} must be matched by the middleware`).toBe(true);
    }
  });

  it('still exempts the liveness probe and static assets', () => {
    // /api/health must stay reachable unauthenticated so an orchestrator can
    // probe it. Adding '/' must not change that.
    for (const pathname of ['/api/health', '/_next/static/chunk.js', '/_next/image', '/favicon.ico']) {
      expect(covered(pathname), `${pathname} must remain exempt`).toBe(false);
    }
  });

  it('keeps the explicit root entry, because the wildcard alone cannot match /', () => {
    // Guards the fix itself. If someone "tidies" the two entries back into one
    // wildcard, the root silently stops being matched and the exposure returns
    // with no other test failing.
    const wildcard = patterns.find((pattern) => pattern.includes('('));
    expect(wildcard, 'the wildcard pattern should still exist').toBeDefined();
    expect(matcherCovers(wildcard as string, '/')).toBe(false);
    expect(patterns).toContain('/');
  });
});
