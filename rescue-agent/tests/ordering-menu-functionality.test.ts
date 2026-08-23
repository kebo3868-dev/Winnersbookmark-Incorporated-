import { describe, expect, it } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';

/**
 * ORDERING and MENU follow-up to the reservation fix.
 *
 * ORDERING carried the identical defect to RESERVATION: an ordering page with
 * online ordering switched off returns 200 and rendered as HEALTHY. Same rule
 * now applies — reachability proves the destination exists, never that an order
 * can be placed.
 *
 * MENU IS DELIBERATELY DIFFERENT, and that difference is the point of half this
 * file. Reservations and ordering are transactions a business can switch off,
 * so a 200 says nothing about them. Reading a menu is not a transaction: a menu
 * page that loads IS a working menu. MENU therefore keeps HEALTHY, and gains
 * only one new downgrade — the page that loads with no menu on it yet.
 *
 * Applying the reservation treatment to MENU would manufacture doubt the audit
 * does not actually have, which is its own kind of dishonesty.
 */

const page = (html: string, url = 'https://example-restaurant.test/') =>
  extractPage(url, url, 200, 'text/html', html);

const stageFor = (stage: string, html: string, probes: ProbeResult[]) => {
  const evidence = normalizeEvidence({ pages: [page(html)], failures: [], probes });
  const records = evidence.map((e, i) => ({
    id: `e${i}`,
    evidenceType: e.evidenceType,
    fact: e.fact,
    confidence: e.confidence,
    supportingContext: e.supportingContext ?? null,
  }));
  return { evidence, stage: analyzeJourney(records).find((s) => s.stage === stage) };
};

const ORDER_LINK = `<a href="https://www.toasttab.com/leverocks">Order Online</a>`;
const MENU_LINK = `<a href="https://example-restaurant.test/menu">View Our Menu</a>`;

const orderProbe = (extra: Partial<ProbeResult> = {}): ProbeResult => ({
  url: 'https://www.toasttab.com/leverocks',
  category: 'ordering',
  ok: true,
  httpStatus: 200,
  note: 'HTTP 200',
  ...extra,
});

const menuProbe = (extra: Partial<ProbeResult> = {}): ProbeResult => ({
  url: 'https://example-restaurant.test/menu',
  category: 'menu',
  ok: true,
  httpStatus: 200,
  note: 'HTTP 200',
  ...extra,
});

describe('ORDERING — reachability is not functionality', () => {
  it('classifies a reachable ordering destination as RESOLVED_UNVERIFIED, not HEALTHY', () => {
    const { stage } = stageFor('ORDERING', ORDER_LINK, [orderProbe()]);
    expect(stage?.status).toBe('RESOLVED_UNVERIFIED');
    expect(stage?.status).not.toBe('HEALTHY');
    expect(stage?.finding).toMatch(/not verified/i);
    expect(stage?.manualValidationRequired).toBe(true);
  });

  it('classifies an explicitly disabled ordering destination as RISK', () => {
    const { stage } = stageFor('ORDERING', ORDER_LINK, [
      orderProbe({ disabledSignal: 'ordering closed: "online ordering is currently closed"' }),
    ]);
    expect(stage?.status).toBe('RISK');
    expect(stage?.finding).toMatch(/ordering is not available/i);
  });

  it('never claims an ordering destination responded "successfully"', () => {
    const { evidence } = stageFor('ORDERING', ORDER_LINK, [orderProbe()]);
    const item = evidence.find((e) => e.evidenceType === 'ORDERING_PATH' && /is reachable/.test(e.fact));
    expect(item?.fact).not.toMatch(/responded successfully/i);
    expect(item?.supportingContext).toMatch(/ordering switched off responds identically/i);
  });

  it('keeps telephone precedence ahead of a reachable destination', () => {
    // Guards the FP1 fix: a phone CTA must still outrank a resolved destination.
    const { stage } = stageFor(
      'ORDERING',
      `<h2>ORDER ONLINE</h2><a href="tel:+17275551234">ORDER</a>${ORDER_LINK}`,
      [orderProbe()],
    );
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/telephone only/i);
  });

  it('still classifies a dead ordering destination as RISK', () => {
    const { stage } = stageFor('ORDERING', ORDER_LINK, [orderProbe({ ok: false, httpStatus: 500, note: 'HTTP 500' })]);
    expect(stage?.status).toBe('RISK');
  });
});

describe('MENU — reading is not a transaction, so HEALTHY survives', () => {
  it('keeps HEALTHY for a reachable menu', () => {
    // The deliberate asymmetry. If someone later "finishes the job" by making
    // MENU unverified too, this fails — which is the intent.
    const { stage } = stageFor('MENU', MENU_LINK, [menuProbe()]);
    expect(stage?.status).toBe('HEALTHY');
  });

  it('downgrades a placeholder menu page to FRICTION', () => {
    const { stage } = stageFor('MENU', MENU_LINK, [
      menuProbe({ placeholderSignal: 'menu coming soon: "menu coming soon"' }),
    ]);
    expect(stage?.status).toBe('FRICTION');
    expect(stage?.finding).toMatch(/no menu published on it yet/i);
  });

  it('still classifies a dead menu destination as RISK', () => {
    const { stage } = stageFor('MENU', MENU_LINK, [menuProbe({ ok: false, httpStatus: 404, note: 'HTTP 404' })]);
    expect(stage?.status).toBe('RISK');
  });

  it('does not treat a placeholder signal on a non-menu destination as a menu problem', () => {
    const { stage } = stageFor('MENU', `${MENU_LINK}${ORDER_LINK}`, [
      menuProbe(),
      orderProbe({ placeholderSignal: 'menu coming soon: "menu coming soon"' }),
    ]);
    expect(stage?.status).toBe('HEALTHY');
  });
});

describe('content signals only ever downgrade', () => {
  it('cannot promote any stage to HEALTHY', () => {
    // A disabled signal on a reachable destination must make things worse, never
    // better. Asserted directly because the whole safety argument rests on it.
    const disabled = stageFor('ORDERING', ORDER_LINK, [
      orderProbe({ disabledSignal: 'ordering closed: "online ordering is currently closed"' }),
    ]).stage;
    const plain = stageFor('ORDERING', ORDER_LINK, [orderProbe()]).stage;

    expect(plain?.status).toBe('RESOLVED_UNVERIFIED');
    expect(disabled?.status).toBe('RISK');
    expect([disabled?.status, plain?.status]).not.toContain('HEALTHY');
  });

  it('leaves reservation behaviour unchanged', () => {
    // FP2 regression guard — this PR must not disturb the accepted V1 fix.
    const { stage } = stageFor(
      'RESERVATION',
      `<a href="https://www.spothopperapp.com/reservations/x">Reserve</a>`,
      [{ url: 'https://www.spothopperapp.com/reservations/x', category: 'reservation', ok: true, httpStatus: 200, note: 'HTTP 200' }],
    );
    expect(stage?.status).toBe('RESOLVED_UNVERIFIED');
  });
});
