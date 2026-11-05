/**
 * OPTIONAL INTAKE NUMBERS ARE READ, NEVER GUESSED.
 *
 * A rating typed as "4,5" reached the route as null (the form sent
 * Number("4,5") = NaN, which JSON writes as null) and `z.coerce.number()`
 * turned it into 0. The audit stored an owner-reported 0.0★, printed it, and
 * scored reputation 0: the same site scored 84 with no rating, 85 with "4.5",
 * and 75 with "4,5". See src/lib/validation/intakeNumbers.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseIntakeNumber, readNumberText } from '@/lib/validation/intakeNumbers';
import { ratingFact } from '@/lib/audit/reputationWording';
import { calculateCategoryScores } from '@/lib/scoring/rescueScore';

const created: Record<string, unknown>[] = [];
vi.mock('@/lib/audit/orchestrator', () => ({
  createAudit: async (input: Record<string, unknown>) => { created.push(input); return { auditId: 'audit-test' }; },
  runAudit: async () => {},
}));
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }));

const USER = 'operator';
const PASSWORD = 'operator-password-for-tests-0001';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => { process.env = { ...ORIGINAL_ENV, BASIC_AUTH_USER: USER, BASIC_AUTH_PASSWORD: PASSWORD }; created.length = 0; });
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

async function post(body: unknown, raw?: string) {
  vi.resetModules(); // a fresh route each time, so its in-memory rate limit never trips
  const { POST } = await import('@/app/api/audits/route');
  const response = await POST(new Request('https://x.invalid/api/audits', {
    method: 'POST',
    headers: { authorization: AUTH, 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json(), input: created.at(-1) };
}
const site = { websiteUrl: 'https://example.com' };

describe('readNumberText', () => {
  it.each([
    ['4.5', 4.5], ['4,5', 4.5], [' 4,5 ', 4.5], ['45,50', 45.5], ['1,200', 1200], ['1,234,567', 1234567], ['1,200.50', 1200.5], ['312', 312], ['0', 0],
  ])('reads %j as %d', (text, value) => expect(readNumberText(text)).toBe(value));

  it.each(['4.5 stars', '4.5★', 'N/A', 'four', '4,5,6', '4.', '.5', '-1', '4,5000', '1 200', ''])('refuses %j', (text) => {
    expect(readNumberText(text)).toBeNull();
  });
});

describe('parseIntakeNumber', () => {
  it('missing, null and empty are "not provided" — never 0', () => {
    for (const raw of [undefined, null, '', '   ']) expect(parseIntakeNumber(raw, 'ownerRating')).toEqual({ ok: true, value: undefined });
  });

  it('enforces each field’s range and type, with a message naming the field', () => {
    expect(parseIntakeNumber('7', 'ownerRating')).toEqual({ ok: false, error: 'OWNER RATING MUST BE A NUMBER FROM 0 TO 5, FOR EXAMPLE 4.5' });
    expect(parseIntakeNumber(Number.NaN, 'ownerRating')).toMatchObject({ ok: false });
    expect(parseIntakeNumber('12.5', 'ownerReviewCount')).toEqual({ ok: false, error: 'REVIEW COUNT MUST BE A WHOLE NUMBER, FOR EXAMPLE 312' });
    expect(parseIntakeNumber('forty', 'avgTicket')).toEqual({ ok: false, error: 'AVERAGE TICKET MUST BE A DOLLAR AMOUNT, FOR EXAMPLE 45' });
    expect(parseIntakeNumber(true, 'avgTicket')).toMatchObject({ ok: false });
  });

  it('accepts a leading $ for the average ticket only', () => {
    expect(parseIntakeNumber('$45', 'avgTicket')).toEqual({ ok: true, value: 45 });
    expect(parseIntakeNumber('$4.5', 'ownerRating')).toMatchObject({ ok: false });
  });

  it('accepts real numbers as before', () => {
    expect(parseIntakeNumber(4.5, 'ownerRating')).toEqual({ ok: true, value: 4.5 });
    expect(parseIntakeNumber(0, 'ownerRating')).toEqual({ ok: true, value: 0 });
    expect(parseIntakeNumber(312, 'ownerReviewCount')).toEqual({ ok: true, value: 312 });
  });
});

describe('POST /api/audits', () => {
  it('"4,5" is stored as 4.5, not 0', async () => {
    const r = await post({ ...site, ownerRating: '4,5' });
    expect(r.status).toBe(201);
    expect(r.input).toMatchObject({ ownerRating: 4.5 });
  });

  it('null — what the old form sent for an unreadable number — is "not provided", not 0', async () => {
    const r = await post({ ...site, ownerRating: null, ownerReviewCount: null, avgTicket: null });
    expect(r.status).toBe(201);
    expect(r.input).toMatchObject({ ownerRating: undefined, ownerReviewCount: undefined, avgTicket: undefined });
  });

  it('reads every number field the way it was typed', async () => {
    const r = await post({ ...site, ownerRating: '4.5', ownerReviewCount: '1,234', avgTicket: '$45,50' });
    expect(r.input).toMatchObject({ ownerRating: 4.5, ownerReviewCount: 1234, avgTicket: 45.5 });
    const numeric = await post({ ...site, ownerRating: 4.4, ownerReviewCount: 312, avgTicket: 45 });
    expect(numeric.input).toMatchObject({ ownerRating: 4.4, ownerReviewCount: 312, avgTicket: 45 });
  });

  it('refuses an unreadable number with a message naming the field, and starts no audit', async () => {
    for (const [body, error] of [
      [{ ...site, ownerRating: '4.5 stars' }, 'OWNER RATING MUST BE A NUMBER FROM 0 TO 5, FOR EXAMPLE 4.5'],
      [{ ...site, ownerRating: 7 }, 'OWNER RATING MUST BE A NUMBER FROM 0 TO 5, FOR EXAMPLE 4.5'],
      [{ ...site, ownerReviewCount: '12.5' }, 'REVIEW COUNT MUST BE A WHOLE NUMBER, FOR EXAMPLE 312'],
      [{ ...site, avgTicket: 'N/A' }, 'AVERAGE TICKET MUST BE A DOLLAR AMOUNT, FOR EXAMPLE 45'],
    ] as const) {
      created.length = 0;
      const r = await post(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body).toEqual({ error });
      expect(created).toEqual([]);
    }
  });

  it('other invalid fields name themselves instead of "INVALID WEBSITE URL"', async () => {
    expect((await post({ ...site, contactEmail: 'x'.repeat(400) })).body).toEqual({ error: 'INVALID CONTACT EMAIL' });
    expect((await post({ ...site, city: 'x'.repeat(200) })).body).toEqual({ error: 'CITY IS TOO LONG (120 CHARACTERS MAXIMUM)' });
    expect((await post({})).body).toEqual({ error: 'INVALID WEBSITE URL' });
    expect((await post(undefined, '{not json')).body).toEqual({ error: 'INVALID REQUEST' });
  });
});

describe('the defect, end to end through the scoring', () => {
  it('a "4,5" rating now scores reputation 90, not 0', () => {
    const parsed = parseIntakeNumber('4,5', 'ownerRating');
    expect(parsed).toEqual({ ok: true, value: 4.5 });
    const fact = ratingFact((parsed as { value: number }).value, null);
    expect(fact).toMatch(/4\.5★/);
    const reputation = calculateCategoryScores([], [{ evidenceType: 'REVIEW_SIGNAL', fact }] as never)
      .find((c) => c.category === 'REVIEW_REPUTATION_SYSTEM')!;
    expect(reputation.score).toBe(90);
  });

  it('the form sends numbers as typed, never Number(…)', () => {
    const form = fs.readFileSync(path.join(__dirname, '../src/app/audits/new/NewAuditForm.tsx'), 'utf8');
    expect(form).toMatch(/const num = \(v: string\) => \(v\.trim\(\) === '' \? undefined : v\.trim\(\)\);/);
    expect(form).not.toMatch(/Number\(v\)/);
  });
});
