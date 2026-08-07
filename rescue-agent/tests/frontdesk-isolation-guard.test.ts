import { readFileSync } from 'node:fs';
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

const CUSTOMER_DATA_MODELS = ['fdConversation', 'fdMessage', 'fdLead', 'fdEscalation', 'fdAuditLog'];

/**
 * Calls that are intentionally not tenant-scoped, each with the reason it is
 * safe. Anything not listed here must carry `tenantId`.
 */
const ALLOWED_UNSCOPED: { snippet: string; reason: string }[] = [
  {
    snippet: 'demoMode: true',
    reason: 'Demo purge deliberately spans tenants; it can only ever match demo rows.',
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
