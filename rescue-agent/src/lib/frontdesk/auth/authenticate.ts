import { checkBasicAuth, resolveAuthMode } from '@/lib/auth';
import {
  extractBearerKey,
  hashApiKey,
  verifyStoredKey,
  type KeyRejection,
  type StoredKey,
} from './apiKey';

/**
 * REQUEST AUTHENTICATION FOR TENANT-SCOPED ROUTES
 *
 * Two kinds of caller are legitimate, and they are told apart by what they
 * present rather than by which route they hit:
 *
 *   TENANT_KEY — a restaurant's own integration (`Authorization: Bearer wbifd_…`).
 *                Authorised for exactly one tenant.
 *   WBI_ADMIN  — a Winners Bookmark operator using the internal dashboard,
 *                authenticated by the app-wide Basic Auth credential.
 *
 * A request presenting a bearer token is judged ONLY as a tenant key: it never
 * falls back to admin access if the key turns out to be invalid. Otherwise a
 * revoked key would silently inherit whatever the browser session had, which
 * is precisely the kind of quiet privilege escalation this is meant to stop.
 */

export type Actor =
  | { kind: 'TENANT_KEY'; tenantId: string; keyId: string }
  | { kind: 'WBI_ADMIN' };

export type AuthFailure = {
  /** Machine-readable, for the audit log. Never returned to the caller verbatim. */
  reason: KeyRejection | 'NO_ADMIN_CREDENTIALS' | 'ADMIN_AUTH_MISCONFIGURED';
  status: 401 | 403 | 503;
};

export type AuthResult = { ok: true; actor: Actor } | { ok: false; failure: AuthFailure };

/** Looks up a key by digest. Implemented by the store; injected so this is testable. */
export type KeyLookup = (keyHash: string) => Promise<StoredKey | null>;

export interface AuthenticateOptions {
  authorizationHeader: string | null;
  /** Tenant named in the request path — the only tenant a key may act on. */
  expectedTenantId: string;
  requiredScope: string;
  lookupKey: KeyLookup;
  now?: Date;
  env?: { BASIC_AUTH_USER?: string; BASIC_AUTH_PASSWORD?: string; NODE_ENV?: string };
}

export async function authenticateTenantRequest(options: AuthenticateOptions): Promise<AuthResult> {
  const {
    authorizationHeader,
    expectedTenantId,
    requiredScope,
    lookupKey,
    now = new Date(),
    env = process.env,
  } = options;

  const presentedKey = extractBearerKey(authorizationHeader);

  if (presentedKey) {
    const stored = await lookupKey(hashApiKey(presentedKey));
    const verdict = verifyStoredKey(stored, expectedTenantId, requiredScope, now);
    if (verdict.ok) {
      return { ok: true, actor: { kind: 'TENANT_KEY', tenantId: verdict.tenantId, keyId: verdict.keyId } };
    }
    // 403 only for a key that is genuinely this tenant's but under-scoped.
    // Everything else is 401 and indistinguishable from the outside, so the
    // endpoint cannot be used to enumerate valid keys or tenants.
    const status = verdict.reason === 'MISSING_SCOPE' ? 403 : 401;
    return { ok: false, failure: { reason: verdict.reason, status } };
  }

  // No bearer token: the only other legitimate caller is a WBI operator.
  if (authorizationHeader?.startsWith('Bearer ')) {
    // A Bearer header that did not survive extraction is malformed. Reported
    // distinctly in the audit log, identically to the caller.
    return { ok: false, failure: { reason: 'MALFORMED_KEY', status: 401 } };
  }

  const mode = resolveAuthMode({
    BASIC_AUTH_USER: env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: env.BASIC_AUTH_PASSWORD,
    NODE_ENV: env.NODE_ENV,
  });

  if (mode === 'misconfigured') {
    return { ok: false, failure: { reason: 'ADMIN_AUTH_MISCONFIGURED', status: 503 } };
  }

  // Local development with no credentials configured: the app-wide middleware
  // is already open, so refusing here would make the app unusable offline.
  if (mode === 'open') return { ok: true, actor: { kind: 'WBI_ADMIN' } };

  const isAdmin = checkBasicAuth(
    authorizationHeader,
    env.BASIC_AUTH_USER as string,
    env.BASIC_AUTH_PASSWORD as string,
  );
  if (isAdmin) return { ok: true, actor: { kind: 'WBI_ADMIN' } };

  return { ok: false, failure: { reason: 'NO_ADMIN_CREDENTIALS', status: 401 } };
}

/**
 * Whether the front desk message endpoint may be reached without the app-wide
 * Basic Auth — i.e. whether it is a public, per-tenant-authenticated endpoint.
 *
 * Defaults to FALSE. While it is false the endpoint stays behind the internal
 * credential and is not reachable by a restaurant's website or a telephony
 * provider. Turning it on is a deliberate, separate decision from building the
 * authentication that makes it safe, and must not happen implicitly.
 */
export function isPublicEndpointEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.FRONTDESK_PUBLIC_ENDPOINT_ENABLED === 'true';
}

/** Caller-facing message. Deliberately uniform — it reveals nothing. */
export function authFailureMessage(failure: AuthFailure): string {
  if (failure.status === 503) return 'ACCESS NOT CONFIGURED';
  if (failure.status === 403) return 'THIS KEY IS NOT PERMITTED TO PERFORM THIS ACTION';
  return 'AUTHENTICATION REQUIRED';
}
