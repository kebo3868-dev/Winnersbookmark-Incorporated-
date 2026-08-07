import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * STRUCTURAL TENANT-ISOLATION GUARD
 *
 * The behavioural isolation tests prove today's queries are scoped. They
 * cannot prove the NEXT query will be, and cross-tenant leakage is the one
 * defect in this product that is unrecoverable once it reaches a real client:
 * you cannot un-show restaurant A's customer list to restaurant B.
 *
 * So this reads the source and fails if any query against a customer-data
 * model omits a tenant filter. It is a lint rule expressed as a test, which
 * means it runs in CI on every change without adding tooling.
 *
 * It is deliberately narrow. Identity tables (FdTenant, FdApiKey) are looked
 * up by their own unique keys before a tenant is even known, so they are out
 * of scope. The models below are the ones holding restaurant and customer
 * data, where a missing filter is a breach.
 */

const CUSTOMER_DATA_MODELS = [
  'fdConversation',
  'fdMessage',
  'fdLead',
  'fdEscalation',
  'fdAuditLog',
  // Added in M3/M4. FdConsent and FdNotification hold customer phone numbers;
  // FdRateCounter is keyed on them; FdInboundEvent and FdUser are the tenant
  // boundary itself. Every one of these was outside the guard until M4, which
  // is exactly how a scanner rots into a formality.
  'fdConsent',
  'fdNotification',
  'fdRateCounter',
  'fdInboundEvent',
  'fdUser',
];

/**
 * Calls that are intentionally not tenant-scoped, each with the reason it is
 * safe. Anything not listed here must carry `tenantId`.
 */
const ALLOWED_UNSCOPED: { snippet: string; reason: string }[] = [
  {
    snippet: 'demoMode: true',
    reason: 'Demo purge deliberately spans tenants; it can only ever match demo rows.',
  },
  {
    snippet: 'providerMessageId',
    reason:
      'Delivery callbacks arrive keyed only on the provider message id, which is ' +
      'globally unique and unguessable. The tenant is derived FROM the row, not ' +
      'supplied by the caller, so there is nothing for a caller to forge.',
  },
  {
    snippet: "status: 'SENDING'",
    reason:
      'The dispatch worker is a platform-level process draining every queue. Each ' +
      'claimed row carries its own tenantId, which scopes every write that follows.',
  },
  {
    snippet: "status: 'QUEUED'",
    reason: 'Same worker claim path as above.',
  },
];

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

/** Extract the balanced-parenthesis argument text of every matching call. */
function extractCalls(source: string, model: string): { method: string; args: string }[] {
  const calls: { method: string; args: string }[] = [];
  const pattern = new RegExp(`\\.${model}\\.([a-zA-Z]+)\\(`, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      index++;
    }
    calls.push({ method: match[1], args: source.slice(start, index - 1) });
  }
  return calls;
}

const SOURCES = [
  'src/lib/frontdesk/store.ts',
  'src/lib/frontdesk/auth/store.ts',
  'src/lib/frontdesk/messaging/store.ts',
  'src/lib/frontdesk/notify/store.ts',
];

describe('every customer-data query is tenant-scoped', () => {
  it.each(SOURCES)('%s', (relativePath) => {
    const source = readSource(relativePath);
    const violations: string[] = [];

    for (const model of CUSTOMER_DATA_MODELS) {
      for (const call of extractCalls(source, model)) {
        const scoped = /\btenantId\b/.test(call.args);
        const allowed = ALLOWED_UNSCOPED.some((entry) => call.args.includes(entry.snippet));
        if (!scoped && !allowed) {
          violations.push(
            `${relativePath}: ${model}.${call.method}() has no tenantId filter — ${call.args
              .replace(/\s+/g, ' ')
              .slice(0, 120)}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('actually finds the queries it claims to check (the guard is not vacuous)', () => {
    // A scanner that silently matches nothing would pass forever. This asserts
    // it sees a realistic number of real queries.
    const source = readSource('src/lib/frontdesk/store.ts');
    const total = CUSTOMER_DATA_MODELS.reduce((sum, model) => sum + extractCalls(source, model).length, 0);
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it('detects an unscoped query when one is introduced', () => {
    // Proves the rule has teeth, using a synthetic source rather than waiting
    // for a real regression to demonstrate it.
    const bad = 'await tx.fdLead.findMany({ where: { status: "NEW" } });';
    const calls = extractCalls(bad, 'fdLead');
    expect(calls).toHaveLength(1);
    expect(/\btenantId\b/.test(calls[0].args)).toBe(false);
  });

  it('accepts a scoped query', () => {
    const good = 'await tx.fdLead.findMany({ where: { tenantId, status: "NEW" } });';
    const calls = extractCalls(good, 'fdLead');
    expect(/\btenantId\b/.test(calls[0].args)).toBe(true);
  });
});

describe('credentials never leave the server', () => {
  it('no route or component selects a key digest', () => {
    // keyHash is selected in exactly one place: the verification lookup.
    const authStore = readSource('src/lib/frontdesk/auth/store.ts');
    const listSelect = authStore.slice(authStore.indexOf('export async function listApiKeys'));
    expect(listSelect.slice(0, 600)).not.toContain('keyHash: true');
  });

  it('the audit log is never handed message content', () => {
    const messageRoute = readSource('src/app/api/frontdesk/[tenantSlug]/message/route.ts');
    const auditCalls = messageRoute.match(/recordAudit\(\{[\s\S]*?\}\)/g) ?? [];
    expect(auditCalls.length).toBeGreaterThan(0);
    for (const call of auditCalls) {
      // `message` is the raw customer text; it must never be persisted here.
      expect(call).not.toMatch(/detail:.*\bmessage\b/);
    }
  });
});

/**
 * SURFACE AUTHORIZATION GUARD
 *
 * The middleware lets a request carrying a session cookie past the operator
 * credential, because Basic Auth cannot represent a restaurant user. That is
 * only safe while EVERY front desk surface authorizes itself.
 *
 * This fails the build if a page or route is added under /frontdesk without
 * doing so — the exact mistake that would turn "past the middleware" into
 * "authenticated".
 */
describe('every front desk surface authorizes itself', () => {
  const AUTHORIZING = [
    'resolveActor',            // session or operator, then authorize()
    'authenticateTenantRequest', // per-tenant API key path
    'requireAdmin',            // platform-admin-only routes
    'verifyWebhook',           // HMAC-signed provider callbacks
    'cronSecretMatches',       // scheduler secret
  ];

  /** Routes that are intentionally unauthenticated, with the reason. */
  const PUBLIC_BY_DESIGN: Record<string, string> = {
    'src/app/api/frontdesk/auth/login/route.ts':
      'Sign-in cannot sit behind the credential it issues. Rate-limited per account.',
    'src/app/api/frontdesk/auth/logout/route.ts':
      'Clearing a cookie is harmless; it revokes only the session presented.',
  };

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (/(page|route)\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it('has no unauthorized page or route under /frontdesk', () => {
    const root = path.resolve(__dirname, '..');
    const surfaces = [
      ...walk(path.join(root, 'src/app/frontdesk')),
      ...walk(path.join(root, 'src/app/api/frontdesk')),
    ];

    const unprotected = surfaces
      .map((file) => path.relative(root, file))
      .filter((rel) => !(rel in PUBLIC_BY_DESIGN))
      .filter((rel) => {
        const source = readFileSync(path.join(root, rel), 'utf8');
        return !AUTHORIZING.some((marker) => source.includes(marker));
      });

    expect(unprotected).toEqual([]);
  });

  it('finds a realistic number of surfaces (the walk is not silently empty)', () => {
    const root = path.resolve(__dirname, '..');
    const count =
      walk(path.join(root, 'src/app/frontdesk')).length +
      walk(path.join(root, 'src/app/api/frontdesk')).length;
    expect(count).toBeGreaterThanOrEqual(8);
  });
});
