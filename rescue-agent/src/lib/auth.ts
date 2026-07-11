/**
 * Basic-auth credential check for the app-wide middleware. Edge-runtime safe
 * (no node:crypto). Comparison is constant-time over the combined credential
 * string to avoid trivially timing out the password length.
 */
export function checkBasicAuth(authorizationHeader: string | null, user: string, password: string): boolean {
  if (!authorizationHeader?.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(authorizationHeader.slice(6).trim());
  } catch {
    return false;
  }
  const expected = `${user}:${password}`;
  return constantTimeEquals(decoded, expected);
}

function constantTimeEquals(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length, 1);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < maxLength; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export type AuthMode = 'open' | 'required' | 'misconfigured';

/**
 * Decide how the middleware should behave from environment configuration.
 * - Credentials set → auth required.
 * - No credentials in production → fail CLOSED (the app serves confidential
 *   sales intelligence; an unauthenticated production deploy is a mistake).
 * - No credentials outside production → open (local development).
 */
export function resolveAuthMode(env: { BASIC_AUTH_USER?: string; BASIC_AUTH_PASSWORD?: string; NODE_ENV?: string }): AuthMode {
  const hasCreds = Boolean(env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD);
  if (hasCreds) return 'required';
  return env.NODE_ENV === 'production' ? 'misconfigured' : 'open';
}
