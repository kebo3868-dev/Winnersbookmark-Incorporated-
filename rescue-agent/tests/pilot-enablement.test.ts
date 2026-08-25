import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MISSED_CALL_STATUSES,
  parseTwilioCallStatus,
  parseTwilioInboundSms,
} from '@/lib/frontdesk/notify/twilio';
import { buildReadinessReport, type PlatformFacts } from '@/lib/frontdesk/config/readiness';
import { demoTenantConfig } from '@/lib/frontdesk/demo/tenant';
import type { TenantConfig } from '@/lib/frontdesk/config/schema';

/**
 * PILOT ENABLEMENT — the four gaps that had no supported surface.
 *
 * Three were missing operator actions: creating a real restaurant, issuing a
 * webhook secret, recording an attestation. The fourth was structural — with
 * Twilio configured there was no inbound path at all, because the platform's
 * inbound route speaks JSON with `x-wbi-signature` and Twilio posts
 * form-encoded with `X-Twilio-Signature`.
 *
 * ── THE PROPERTY THE BRIDGE IS BUILT AROUND ──────────────────────────────────
 *
 *   A TWILIO SIGNATURE PROVES THE ACCOUNT, NOT THE RESTAURANT.
 *
 * The auth token is shared by every number on the account, and the slug that
 * names the restaurant sits in an attacker-shaped URL. So a validly signed
 * message for restaurant A, replayed at restaurant B's URL, would be delivered
 * into B's conversations unless the payload's `To` is bound to B's own
 * configured sending number. That binding is the reason the guard exists, and
 * it is mutation-tested below.
 *
 * ── AND THE ONE THE EVENT SPLIT IS BUILT AROUND ──────────────────────────────
 *
 * An inbound message is something a customer wrote. A missed call produces an
 * UNPROMPTED text to somebody who did not. They are different events with
 * different consent postures, so they have different routes and different
 * parsers, and each refuses the other's shape outright.
 */

const AUTH_TOKEN = 'y'.repeat(32);
const TENANT_NUMBER = '+15550100100';
const CUSTOMER = '+17275550142';

const goodEnv = {
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: 'AC' + 'x'.repeat(32),
  TWILIO_AUTH_TOKEN: AUTH_TOKEN,
  TWILIO_STATUS_CALLBACK_URL: 'https://e.test/api/frontdesk/notifications/webhook',
  CRON_SECRET: 'z'.repeat(32),
  BASIC_AUTH_USER: 'operator',
  BASIC_AUTH_PASSWORD: 'p'.repeat(20),
  DATABASE_URL: 'postgresql://u:p@h:5432/d',
  FRONTDESK_DISPATCH_SCHEDULED: 'true',
  NODE_ENV: 'production',
};

// ===========================================================================
// GAP 4a — the parsers, and the event split
// ===========================================================================

const smsParams = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    MessageSid: 'SM123',
    From: CUSTOMER,
    To: TENANT_NUMBER,
    Body: 'Do you have a table for 4 on Friday?',
    ...over,
  });

const callParams = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    CallSid: 'CA123',
    From: CUSTOMER,
    To: TENANT_NUMBER,
    CallStatus: 'no-answer',
    ...over,
  });

describe('an inbound message can never be read as a missed call', () => {
  it('parses a genuine inbound SMS', () => {
    const parsed = parseTwilioInboundSms(smsParams());
    expect(parsed).toEqual({ eventId: 'SM123', from: CUSTOMER, to: TENANT_NUMBER, body: 'Do you have a table for 4 on Friday?' });
  });

  it('refuses to read an SMS payload as a missed call', () => {
    // The consequence if it did: a customer who wrote to us receives
    // "Sorry we missed your call".
    expect(parseTwilioCallStatus(smsParams())).toBeNull();
  });

  it('refuses to read a call payload as an inbound message', () => {
    expect(parseTwilioInboundSms(callParams())).toBeNull();
  });

  it('refuses a payload carrying BOTH shapes', () => {
    // Neither parser may claim an ambiguous event.
    const hybrid = new URLSearchParams({ ...Object.fromEntries(smsParams()), ...Object.fromEntries(callParams()) });
    expect(parseTwilioInboundSms(hybrid)).toBeNull();
    expect(parseTwilioCallStatus(hybrid)).toBeNull();
  });

  it('refuses an SMS with an empty or whitespace body', () => {
    expect(parseTwilioInboundSms(smsParams({ Body: '' }))).toBeNull();
    expect(parseTwilioInboundSms(smsParams({ Body: '   ' }))).toBeNull();
  });

  it('refuses an SMS with no message id or no addresses', () => {
    const noSid = smsParams(); noSid.delete('MessageSid'); noSid.delete('SmsSid');
    expect(parseTwilioInboundSms(noSid)).toBeNull();
    const noTo = smsParams(); noTo.delete('To');
    expect(parseTwilioInboundSms(noTo)).toBeNull();
  });
});

describe('only a genuinely unanswered call triggers recovery', () => {
  it.each(['no-answer', 'busy', 'failed'])('recovers from %s', (status) => {
    expect(parseTwilioCallStatus(callParams({ CallStatus: status }))?.status).toBe(status);
  });

  it('does NOT recover from a completed call', () => {
    // Texting "sorry we missed you" to someone the restaurant just spoke to is
    // worse than sending nothing at all.
    expect(parseTwilioCallStatus(callParams({ CallStatus: 'completed' }))).toBeNull();
  });

  it.each(['queued', 'ringing', 'in-progress', 'canceled', ''])('ignores %s', (status) => {
    expect(parseTwilioCallStatus(callParams({ CallStatus: status }))).toBeNull();
  });

  it('reads DialCallStatus when a <Dial> reported the outcome', () => {
    const p = callParams({ CallStatus: 'completed', DialCallStatus: 'no-answer' });
    expect(parseTwilioCallStatus(p)?.status).toBe('no-answer');
  });

  it('keeps the qualifying set explicit and small', () => {
    expect([...MISSED_CALL_STATUSES].sort()).toEqual(['busy', 'failed', 'no-answer']);
    expect(MISSED_CALL_STATUSES.has('completed')).toBe(false);
  });
});

// ===========================================================================
// GAP 4b — the route guard: signature, tenant binding, dedup, no-write
// ===========================================================================

const URL_SMS = 'https://app.test/api/frontdesk/alpha-grill/sms/twilio';
const URL_VOICE = 'https://app.test/api/frontdesk/alpha-grill/voice/twilio-status';

/** Twilio's scheme: HMAC-SHA1 over the URL plus sorted key/value pairs. */
function sign(url: string, params: URLSearchParams, token = AUTH_TOKEN): string {
  const keys = [...new Set([...params.keys()])].sort();
  let payload = url;
  for (const k of keys) for (const v of params.getAll(k)) payload += k + v;
  return createHmac('sha1', token).update(payload, 'utf8').digest('base64');
}

const tenantConfig = (over: Partial<TenantConfig> = {}): TenantConfig =>
  ({
    ...demoTenantConfig,
    restaurantName: 'Alpha Grill',
    messaging: { ...demoTenantConfig.messaging, smsEnabled: true, fromNumber: TENANT_NUMBER, missedCallRecoveryEnabled: true },
    ...over,
  }) as TenantConfig;

const tenantRow = {
  value: { id: 'tenant-a', slug: 'alpha-grill', name: 'Alpha', status: 'ACTIVE', demoMode: false, config: tenantConfig() } as unknown,
};
const calls: string[] = [];
const claimed = { fresh: true };
const handled = { sms: 0, missed: 0 };

vi.mock('@/lib/frontdesk/store', () => ({
  getTenantBySlug: async (slug: string) => {
    calls.push(`getTenantBySlug:${slug}`);
    return slug === 'alpha-grill' ? tenantRow.value : null;
  },
}));
vi.mock('@/lib/frontdesk/messaging/store', () => ({
  claimInboundEvent: async (...a: unknown[]) => {
    calls.push(`claimInboundEvent:${a[1]}`);
    return claimed.fresh;
  },
}));
vi.mock('@/lib/frontdesk/messaging/inbound', () => ({
  handleInboundSms: async () => {
    calls.push('handleInboundSms');
    handled.sms++;
    return { handled: 'REPLIED' };
  },
}));
vi.mock('@/lib/frontdesk/messaging/missedCall', () => ({
  handleMissedCall: async () => {
    calls.push('handleMissedCall');
    handled.missed++;
    return { recovered: true };
  },
}));
vi.mock('@/lib/frontdesk/security/rejections', () => ({
  noteRejection: async (i: { reason: string; credentialPresented: boolean }) => {
    calls.push(`noteRejection:${i.reason}:${i.credentialPresented ? 'presented' : 'silent'}`);
    return i.credentialPresented;
  },
  presentedAnyCredential: () => false,
}));
vi.mock('@/lib/frontdesk/notify/store', () => ({
  recordFailure: async () => { calls.push('recordFailure'); },
}));
vi.mock('@/lib/db', () => ({ prisma: {} }));

async function post(url: string, params: URLSearchParams, opts: { signature?: string | null; slug?: string } = {}) {
  const which = url === URL_SMS
    ? await import('@/app/api/frontdesk/[tenantSlug]/sms/twilio/route')
    : await import('@/app/api/frontdesk/[tenantSlug]/voice/twilio-status/route');
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  const sig = opts.signature === undefined ? sign(url, params) : opts.signature;
  if (sig !== null) headers['x-twilio-signature'] = sig;
  const request = new Request(url, { method: 'POST', headers, body: params.toString() });
  return which.POST(request as never, { params: Promise.resolve({ tenantSlug: opts.slug ?? 'alpha-grill' }) });
}

describe('the Twilio bridge refuses everything it should', () => {
  beforeEach(() => {
    calls.length = 0;
    claimed.fresh = true;
    handled.sms = 0;
    handled.missed = 0;
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    tenantRow.value = { id: 'tenant-a', slug: 'alpha-grill', name: 'Alpha', status: 'ACTIVE', demoMode: false, config: tenantConfig() };
  });

  it('an UNSIGNED request performs ZERO database work', async () => {
    const response = await post(URL_SMS, smsParams(), { signature: null });
    expect(response.status).toBe(401);
    // The decisive assertion: nothing was read, claimed, handled or written —
    // not even a rejection row. An unauthenticated caller must not be able to
    // drive work in a production database.
    expect(calls).toEqual([]);
  });

  it('a request with a WRONG signature is refused', async () => {
    const response = await post(URL_SMS, smsParams(), { signature: 'not-a-signature' });
    expect(response.status).toBe(401);
    expect(calls).toContain('noteRejection:BAD_SIGNATURE:presented');
    expect(handled.sms).toBe(0);
  });

  it('a signature over a DIFFERENT url is refused', async () => {
    // Twilio signs the full URL, so a signature lifted from another endpoint
    // must not verify here.
    const p = smsParams();
    const response = await post(URL_SMS, p, { signature: sign('https://app.test/somewhere/else', p) });
    expect(response.status).toBe(401);
    expect(handled.sms).toBe(0);
  });

  it('a signature made with a different auth token is refused', async () => {
    const p = smsParams();
    const response = await post(URL_SMS, p, { signature: sign(URL_SMS, p, 'w'.repeat(32)) });
    expect(response.status).toBe(401);
  });

  it('a VALIDLY SIGNED request whose To is another restaurant is refused', async () => {
    // The central property. The signature is genuine — it is made with the real
    // account token — but the message was not for this restaurant.
    const p = smsParams({ To: '+15550100999' });
    const response = await post(URL_SMS, p);
    expect(response.status).toBe(401);
    expect(calls).toContain('noteRejection:DESTINATION_MISMATCH:presented');
    expect(handled.sms).toBe(0);
  });

  it('refuses when the restaurant has no sending number configured', async () => {
    tenantRow.value = {
      ...(tenantRow.value as object),
      config: tenantConfig({ messaging: { ...tenantConfig().messaging, fromNumber: undefined } } as never),
    };
    expect((await post(URL_SMS, smsParams())).status).toBe(401);
    expect(handled.sms).toBe(0);
  });

  it('refuses an unknown restaurant with the same 401, revealing nothing', async () => {
    const url = 'https://app.test/api/frontdesk/nope/sms/twilio';
    const p = smsParams();
    const { POST } = await import('@/app/api/frontdesk/[tenantSlug]/sms/twilio/route');
    const request = new Request(url, {
      method: 'POST',
      headers: { 'x-twilio-signature': sign(url, p), 'content-type': 'application/x-www-form-urlencoded' },
      body: p.toString(),
    });
    const response = await POST(request as never, { params: Promise.resolve({ tenantSlug: 'nope' }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'INVALID WEBHOOK REQUEST' });
  });
});

describe('the Twilio bridge accepts and processes what it should', () => {
  beforeEach(() => {
    calls.length = 0; claimed.fresh = true; handled.sms = 0; handled.missed = 0;
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    tenantRow.value = { id: 'tenant-a', slug: 'alpha-grill', name: 'Alpha', status: 'ACTIVE', demoMode: false, config: tenantConfig() };
  });

  it('delivers a valid inbound message to the existing pipeline', async () => {
    const response = await post(URL_SMS, smsParams());
    expect(response.status).toBe(200);
    expect(handled.sms).toBe(1);
    expect(calls).toContain('claimInboundEvent:SM123');
  });

  it('a REPLAYED MessageSid produces exactly one conversation', async () => {
    await post(URL_SMS, smsParams());
    claimed.fresh = false; // the unique-constrained claim loses the second time
    const second = await post(URL_SMS, smsParams());
    expect(await second.json()).toMatchObject({ handled: false, reason: 'DUPLICATE_EVENT' });
    expect(handled.sms).toBe(1);
  });

  it('claims the event BEFORE handling it', async () => {
    await post(URL_SMS, smsParams());
    expect(calls.indexOf('claimInboundEvent:SM123')).toBeLessThan(calls.indexOf('handleInboundSms'));
  });

  it('recovers a genuinely missed call', async () => {
    const response = await post(URL_VOICE, callParams());
    expect(response.status).toBe(200);
    expect(handled.missed).toBe(1);
  });

  it('does NOT recover a completed call', async () => {
    const response = await post(URL_VOICE, callParams({ CallStatus: 'completed' }));
    expect(await response.json()).toMatchObject({ handled: false, reason: 'NOT_A_MISSED_CALL' });
    expect(handled.missed).toBe(0);
  });

  it('an SMS payload posted to the VOICE route recovers nothing', async () => {
    const response = await post(URL_VOICE, smsParams());
    expect(await response.json()).toMatchObject({ handled: false, reason: 'NOT_A_MISSED_CALL' });
    expect(handled.missed).toBe(0);
    expect(handled.sms).toBe(0);
  });

  it('a call payload posted to the SMS route creates no conversation', async () => {
    const response = await post(URL_SMS, callParams());
    expect(await response.json()).toMatchObject({ handled: false, reason: 'NOT_AN_INBOUND_MESSAGE' });
    expect(handled.sms).toBe(0);
  });

  it('acknowledges a suspended restaurant without processing it', async () => {
    tenantRow.value = { ...(tenantRow.value as object), status: 'SUSPENDED' };
    const response = await post(URL_SMS, smsParams());
    expect(await response.json()).toMatchObject({ handled: false, reason: 'TENANT_SUSPENDED' });
    expect(handled.sms).toBe(0);
  });

  it('answers 200 when the handler throws, and files the failure', async () => {
    // A 500 makes Twilio retry an event the claim already consumed, so the
    // retry is dropped as a duplicate and the failure becomes invisible.
    const inbound = await import('@/lib/frontdesk/messaging/inbound');
    vi.spyOn(inbound, 'handleInboundSms').mockRejectedValueOnce(new Error('db down'));
    const response = await post(URL_SMS, smsParams());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ handled: false, reason: 'PROCESSING_FAILED' });
    expect(calls).toContain('recordFailure');
  });
});

// ===========================================================================
// GAP 2 — provider-aware inbound authentication
// ===========================================================================

const facts = (o: Partial<PlatformFacts> = {}): PlatformFacts => ({
  webhookSecretConfigured: true,
  dispatchWorkerScheduled: true,
  openFailures: 0,
  criticalUnreachableFailures: 0,
  rota: { order: ['urgent', 'manager'], verifiedKeys: ['urgent', 'manager'] },
  env: goodEnv,
  ...o,
});
const authCheck = (f: PlatformFacts) =>
  buildReadinessReport(tenantConfig(), f).checks.find((c) => c.id === 'webhook.inboundAuth');

describe('inbound-auth readiness asks about the mechanism actually in force', () => {
  it('on Twilio, requires the auth token that really gates inbound', () => {
    expect(authCheck(facts())?.state).toBe('PASS');
    const { TWILIO_AUTH_TOKEN: _drop, ...noToken } = goodEnv;
    expect(authCheck(facts({ env: noToken }))?.state).toBe('FAIL');
  });

  it('on Twilio, does NOT require the per-tenant secret it never reads', () => {
    const check = authCheck(facts({ webhookSecretConfigured: false }));
    expect(check?.state).toBe('PASS');
    expect(check?.detail).toMatch(/not used on this provider/i);
  });

  it('cannot be passed on Twilio by supplying an irrelevant placeholder secret', () => {
    // A secret must never be the thing that clears this gate on Twilio — with
    // the token missing it stays FAIL no matter what secret is stored.
    const { TWILIO_AUTH_TOKEN: _drop, ...noToken } = goodEnv;
    expect(authCheck(facts({ env: noToken, webhookSecretConfigured: true }))?.state).toBe('FAIL');
    expect(authCheck(facts({ env: noToken, webhookSecretConfigured: false }))?.state).toBe('FAIL');
  });

  it('on a platform-scheme provider, requires the per-tenant secret', () => {
    const env = { ...goodEnv, SMS_PROVIDER: 'other-provider' };
    expect(authCheck(facts({ env, webhookSecretConfigured: true }))?.state).toBe('PASS');
    expect(authCheck(facts({ env, webhookSecretConfigured: false }))?.state).toBe('FAIL');
  });

  it('is not applicable before a real provider exists', () => {
    for (const provider of ['mock', '', undefined]) {
      const env = { ...goodEnv, SMS_PROVIDER: provider };
      expect(authCheck(facts({ env, webhookSecretConfigured: false }))?.state).toBe('NOT_APPLICABLE');
    }
  });

  it('a missing provider credential still blocks activation', () => {
    const { TWILIO_AUTH_TOKEN: _drop, ...noToken } = goodEnv;
    const report = buildReadinessReport(tenantConfig(), facts({ env: noToken }));
    expect(report.blockers.map((b) => b.id)).toContain('webhook.inboundAuth');
    expect(report.canActivate).toBe(false);
  });
});

// ===========================================================================
// GAPS 1 & 3 — the operator surfaces exist and are guarded
// ===========================================================================

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('the missing operator surfaces now exist', () => {
  it('a real restaurant can be created, and only by a platform admin', () => {
    const route = src('src/app/api/frontdesk/tenants/route.ts');
    expect(route).toContain('authorizePlatform');
    // Validated BEFORE the write — the whole reason not to do this by hand.
    expect(route.indexOf('parseTenantConfig')).toBeLessThan(route.indexOf('fdTenant.create'));
    // A route that could mint a demo tenant in production is a foot-gun.
    expect(route).toMatch(/demoMode:\s*false/);
    expect(route).not.toMatch(/demoMode:\s*(true|parsed|body)/);
  });

  it('a webhook secret can be issued, returned once, and stored only hashed', () => {
    const route = src('src/app/api/frontdesk/[tenantSlug]/webhook-secret/route.ts');
    expect(route).toContain('setTenantWebhookSecret');
    expect(route).toContain("'keys:manage'");
    expect(route).toContain('plaintext');
    // The route must not persist the plaintext itself.
    expect(route).not.toMatch(/data:\s*\{[^}]*plaintext/);
  });

  it('an attestation records the AUTHENTICATED actor, never a name from the body', () => {
    const route = src('src/app/api/frontdesk/[tenantSlug]/attestations/route.ts');
    expect(route).toContain('authorizePlatform');
    expect(route).toMatch(/authz\.actor/);
    // A free-text attester would let anyone certify as anyone.
    expect(route).not.toMatch(/telecomAttestedBy\s*=\s*parsed\.data/);
  });

  it('an attestation computes the fingerprint server-side from live config', () => {
    // If the caller supplied it, they could certify a telecom setup that is not
    // deployed and the staleness binding would be decorative.
    const route = src('src/app/api/frontdesk/[tenantSlug]/attestations/route.ts');
    expect(route).toMatch(/telecomAttestedFingerprint\s*=\s*telecomFingerprint\(tenant\.config/);
    expect(route).not.toMatch(/fingerprint:\s*z\./);
  });

  it('an attestation uses the server clock, not a caller-supplied date', () => {
    const route = src('src/app/api/frontdesk/[tenantSlug]/attestations/route.ts');
    expect(route).toMatch(/const at = new Date\(\)\.toISOString\(\)/);
    expect(route).not.toMatch(/attestedAt:\s*z\.string\(\)\.datetime/);
  });

  it('an attestation re-validates the whole config before writing it back', () => {
    const route = src('src/app/api/frontdesk/[tenantSlug]/attestations/route.ts');
    expect(route.indexOf('parseTenantConfig')).toBeLessThan(route.indexOf('fdTenant.update'));
  });

  it('still claims nothing about carrier approval', () => {
    const route = src('src/app/api/frontdesk/[tenantSlug]/attestations/route.ts');
    expect(route).toMatch(/has NOT verified/i);
    expect(/carrier confirmed|registration verified|approved by the carrier/i.test(route)).toBe(false);
  });

  it('both Twilio routes are registered as self-authenticating in the middleware', () => {
    const mw = src('src/middleware.ts');
    expect(mw).toMatch(/sms\\\/twilio\$/);
    expect(mw).toMatch(/voice\\\/twilio-status\$/);
  });
});
