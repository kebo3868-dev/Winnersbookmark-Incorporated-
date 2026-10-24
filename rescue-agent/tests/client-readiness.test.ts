import { describe, it, expect } from 'vitest';
import { extractPage } from '@/lib/web/collector';
import { normalizeEvidence, type ProbeResult } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { calculateCategoryScores, calculateOverallScore } from '@/lib/scoring/rescueScore';
import { canonicalEvidenceUrl, deduplicateEvidence, evidenceConfidence, findingStatus } from '@/lib/audit/integrity';
import { parseOrderingChannelFact } from '@/lib/audit/orderingChannel';
import { discoverRelevantPages } from '@/lib/web/discovery';
import { deriveEvidenceSourceUrl } from '@/lib/reports/executiveData';
import { resolveDatabaseUrl } from '@/lib/db';

const page = (html: string, url = 'https://restaurant.example/') => extractPage(url, url, 200, 'text/html', html);
const run = (html: string, probes: ProbeResult[] = []) => {
  const evidence = normalizeEvidence({ pages: [page(html)], failures: [], probes }).map((e, i) => ({ ...e, id: `e${i}` }));
  const journey = analyzeJourney(evidence);
  return { evidence, journey, opportunities: detectRevenueLeaks({ evidence, journey }), categories: calculateCategoryScores(journey, evidence) };
};

describe('client readiness: contact and public programs', () => {
  it.each([
    '<footer>leverocksgreatseafood@gmail.com</footer>',
    '<footer><a href="mailto:leverocksgreatseafood%40gmail.com?subject=Hello">Email us</a></footer>',
    '<footer>leverocksgreatseafood [at] gmail [dot] com</footer>',
  ])('preserves public email as contact evidence: %s', (html) => {
    const contact = run(html).evidence.find((e) => e.evidenceType === 'CONTACT_PATH');
    expect(contact?.fact).toContain('leverocksgreatseafood@gmail.com');
    expect(contact?.fact).not.toContain('no non-phone');
  });
  it('recognizes contact forms without mistaking them for newsletters', () => {
    const p = page('<form><input type="email"><textarea name="message"></textarea></form>');
    expect(p.contactFormSignal).toBe(true);
    expect(p.emailCaptureSignal).toBe(false);
    expect(run('<form><input type="email"><textarea></textarea></form>').evidence.find((e) => e.evidenceType === 'CONTACT_PATH')?.fact).toContain('inquiry form');
  });
  it.each(['<h2>FAQ</h2><p>Walk-ins welcome.</p>', '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>'])('detects in-page FAQs: %s', (html) => {
    expect(run(html).evidence.find((e) => e.evidenceType === 'FAQ_SIGNAL')?.fact).toMatch(/public FAQ section/);
  });
  it('uses the scoped FAQ absence statement', () => {
    expect(run('<h1>Restaurant</h1>').evidence.find((e) => e.evidenceType === 'FAQ_SIGNAL')?.fact).toBe('No publicly accessible FAQ was detected in the analyzed pages.');
  });
  it('uses visible rewards wording without requiring a separate loyalty link', () => {
    expect(run('<h2>Rewards program</h2><p>Earn points when dining.</p>').evidence.find((e) => e.evidenceType === 'LOYALTY_SIGNAL')?.fact).toMatch(/wording was detected/);
  });
  it.each(['', '<h2>Newsletter</h2>', '<h2>Newsletter</h2><a href="/rewards">Loyalty</a>'])('never infers private retention quality: %s', (html) => {
    const r = run(html);
    expect(r.journey.find((j) => j.stage === 'FOLLOW_UP')?.finding).toContain('Internal retention and follow-up processes could not be verified from publicly available website evidence.');
    expect(r.categories.find((c) => c.category === 'CUSTOMER_RETENTION')?.score).toBeNull();
    expect(JSON.stringify(r.journey)).not.toMatch(/appears basic|entirely on memory/);
  });
  it('private dining does not imply off-site catering or poor response', () => {
    const r = run('<a href="/private-parties">Book your party</a>');
    expect(r.evidence.find((e) => e.evidenceType === 'CATERING_PATH')?.fact).toMatch(/^No public catering/);
    expect(r.opportunities.find((o) => /inquiry process/.test(o.title))?.title).toBe('Validate the private dining inquiry process');
  });
});

describe('client readiness: channels and uncertainty', () => {
  it('preserves phone plus online ordering instead of telephone-only', () => {
    const r = run('<a href="tel:7273674588">Order</a><a href="/order-online">Order online</a>');
    expect(parseOrderingChannelFact(r.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')!.fact)?.state).toBe('ORDERING_PATH_UNCLEAR');
    expect(JSON.stringify(r.evidence)).not.toContain('telephone only');
    expect(r.categories.find((c) => c.category === 'ONLINE_ORDERING_EXPERIENCE')?.score).toBeNull();
  });
  it('requires review when online ordering promotion links to a telephone', () => {
    const r = run('<h2>Order online</h2><a href="tel:7273674588">Order</a>');
    expect(r.evidence.find((e) => e.evidenceType === 'ORDERING_CHANNEL')?.fact).toContain('advertised');
  });
  it('ignores explicitly hidden ordering anchors', () => {
    const p = page('<div hidden><a href="/order">Order online</a></div><div style="display:none"><a href="/reserve">Reserve</a></div>');
    expect(p.categorizedLinks.ordering).toBeUndefined();
    expect(p.categorizedLinks.reservation).toBeUndefined();
  });
  it.each([401, 403, 405, 429, 503])('does not label HTTP %i a confirmed broken booking', (httpStatus) => {
    const r = run('<a href="/reservations">Reserve</a>', [{ url: 'https://restaurant.example/reservations', category: 'reservation', ok: false, httpStatus, note: `HTTP ${httpStatus}` }]);
    expect(r.evidence.filter((e) => e.evidenceType === 'BROKEN_LINK')).toHaveLength(0);
  });
  it('does not turn collection errors into a website penalty', () => {
    const evidence = normalizeEvidence({ pages: [], failures: [{ url: 'https://restaurant.example', sourceType: 'HOME', status: 'TIMEOUT', note: 'Timeout' }], probes: [] }).map((e) => ({ ...e, id: 'e1' }));
    const journey = analyzeJourney(evidence);
    expect(journey.find((j) => j.stage === 'WEBSITE')?.status).toBe('UNKNOWN');
    expect(findingStatus(evidence[0])).toBe('SCAN ERROR');
  });
});

describe('client readiness: evidence and scoring', () => {
  it('records CTA placement without asserting conversion loss from a count', () => {
    const html = '<nav><a href="/menu">Menu</a></nav>' + Array.from({ length: 10 }, (_, i) => `<a href="/order/${i}">Order item ${i}</a>`).join('');
    const r = run(html);
    expect(r.evidence.find((e) => /distinct CTA/.test(e.fact))?.supportingContext).toContain('navigation: Menu');
    expect(r.opportunities.some((o) => /CTA/.test(o.category))).toBe(false);
  });
  it('canonicalizes tracking while preserving meaningful URL differences', () => {
    expect(canonicalEvidenceUrl('https://EXAMPLE.com/Menu?item=1&utm_source=x#food')).toBe('https://example.com/Menu?item=1');
    expect(canonicalEvidenceUrl('https://example.com/menu?item=2')).not.toBe(canonicalEvidenceUrl('https://example.com/Menu?item=1'));
    const p = page('<a href="/menu?item=1">Menu</a><a href="/menu?item=2">Menu</a>');
    expect(discoverRelevantPages(p)).toHaveLength(2);
  });
  it('deduplicates repeated facts without discarding different source corroboration', () => {
    const e = run('<h2>Newsletter</h2>').evidence[0];
    expect(deduplicateEvidence([e, e, { ...e, sourceUrl: 'https://another.example' }])).toHaveLength(2);
  });
  it('recognizes PDF-only menus repeated in navigation and footer', () => {
    const r = run('<nav><a href="/menu.pdf">Menu</a></nav><footer><a href="/menu.pdf?utm_source=footer">Menu</a></footer>');
    expect(r.evidence.some((e) => /only detected menu links point to PDF/.test(e.fact))).toBe(true);
  });
  it('preserves exact source URLs through persistence context', () => {
    expect(deriveEvidenceSourceUrl('Observed source: https://restaurant.example/reserve\nHTTP result', 'https://restaurant.example')).toBe('https://restaurant.example/reserve');
  });
  it('reproduces scoring for identical evidence and ignores duplicate observations', () => {
    const r = run('<title>Restaurant</title><meta name="viewport" content="width=device-width"><a href="/menu">Menu</a>');
    const duplicate = [...r.evidence, ...r.evidence, ...r.evidence.filter((e) => e.evidenceType === 'MENU_ACCESS')];
    expect(calculateOverallScore(calculateCategoryScores(analyzeJourney(duplicate), duplicate))).toEqual(calculateOverallScore(r.categories));
    expect(run('<title>Same</title>').categories).toEqual(run('<title>Same</title>').categories);
  });
  it('labels heuristic confidence separately from verification status', () => {
    expect([55, 65, 95].map(evidenceConfidence)).toEqual(['Low', 'Medium', 'High']);
    expect(findingStatus({ evidenceType: 'FAQ_SIGNAL', fact: 'No publicly accessible FAQ was detected in the analyzed pages.', supportingContext: null })).toBe('NOT OBSERVED');
  });
  it('excludes gift cards, media hosts, stylesheet assets, and careers from food ordering/contact', () => {
    const p = page('<a href="https://imagedelivery.net/photo/public"></a><a href="https://www.toasttab.com/store/giftcards">Gift Cards</a><a href="https://static.example/style.css">Order</a><a href="/copy-of-contact">Career Opportunities</a>');
    expect(p.categorizedLinks.ordering).toBeUndefined();
    expect(p.categorizedLinks.contact).toBeUndefined();
    expect(p.categorizedLinks.gift_card).toHaveLength(1);
  });
  it('preview runtime cannot fall back to a production connection', () => {
    expect(() => resolveDatabaseUrl({ VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://production' })).toThrow(/isolated/);
    expect(resolveDatabaseUrl({ VERCEL_ENV: 'preview', RESCUE_PREVIEW_DATABASE_URL: 'postgres://preview', DATABASE_URL: 'postgres://production' })).toBe('postgres://preview');
  });
});
