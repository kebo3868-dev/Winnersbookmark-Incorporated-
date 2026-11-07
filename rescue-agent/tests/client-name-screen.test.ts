/**
 * A NAME TAKEN FROM THE AUDITED WEBSITE CANNOT WRITE CLAIMS ONTO ITS REPORT.
 *
 * Independent review of PR #79, Medium: the name resolved from the site's own
 * schema.org / og:site_name / <title> overrode the operator's and was printed
 * unscreened on the cover, in the summary and in "Prepared for" of the web
 * report and PDF. A site naming itself "Guaranteed $40,000 Lost Revenue
 * Recovered" had that printed three times. Low: the same name widened the
 * vocabulary that verifies interpolated values. Also Low: "1.250" as an
 * average ticket was stored as $1.25.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildExecutiveReport } from '@/lib/reports/executive';
import { clientRestaurantName, isPublishableRestaurantName } from '@/lib/reports/clientName';
import { verifySlot, type PublicationContext } from '@/lib/reports/slotVerification';
import { generateSalesBrief } from '@/lib/reports/sales';
import { parseIntakeNumber } from '@/lib/validation/intakeNumbers';
import { baseInput } from './fixtures/executive-input';

const HOSTILE = [
  'Guaranteed $40,000 Lost Revenue Recovered',
  'Increase Your Sales 300%',
  'AI Receptionist Answers Every Call',
  'Recover Lost Orders Today',
  'Profitable Kitchen Systems',
  'Book Now - Free Audit',
  'We double your bookings',
  'Fastest Profitable Proven Bistro',
  'Our AI chatbot handles reservations',
  'Save 25% Today',
];
const REAL = [
  "Leverock's Great Seafood", 'The Golden Anchor Seafood House (FICTIONAL DEMO)', 'The Lost Dog Cafe', 'Best Burger', 'Golden Corral',
  "Joe's Crab Shack", 'Route 66 Diner', 'Pier 600', '1950s Diner', 'Five Guys', "Chili's Grill & Bar", 'P.F. Chang\'s',
  "Ruth's Chris Steak House", 'The Cheesecake Factory', 'In-N-Out Burger', 'Cracker Barrel Old Country Store',
  "Ted Peters Famous Smoked Fish", "Frenchy's Rockaway Grill", "Bern's Steak House", 'Café Ole', 'Pho 99', 'Taco Bus',
  "Dave & Buster's", "Ford's Garage", 'Sea Dog Brewing Co.', 'Number One Chinese', 'First Watch', 'Recovery Room Bar',
];

describe('the name screen', () => {
  it.each(HOSTILE)('refuses %j', (name) => expect(isPublishableRestaurantName(name)).toBe(false));
  it.each(REAL)('keeps the real name %j', (name) => expect(isPublishableRestaurantName(name)).toBe(true));
  it('falls back to the domain, never to the claim', () => {
    expect(clientRestaurantName(HOSTILE[0], 'https://www.example-grill.com/')).toBe('example-grill.com');
    expect(clientRestaurantName("Leverock's Great Seafood", 'https://leverocks.com')).toBe("Leverock's Great Seafood");
  });
});

describe('the name screen holds against lookalikes, hidden characters and promotional phrasing (independent review)', () => {
  const DOMAIN = 'site.example';
  it.each([
    'Ｇuaranteed ＄40000 Lost Rеvenue Rеcovered', // fullwidth letters, Cyrillic е
    'Rev​enue Recov​ered 40000 USD', // zero-width spaces
    '‮dercover euneveR', // right-to-left override
    'Your Website Costs You 40000 Dollars',
    'Call 727-555-0100 For Your Refund',
    'Never miss a call again',
    'Proven results for restaurants',
    'Award-Winning Pizza',
    '50% Off Tonight',
    'Best Prices in Town',
    'Order Online | Joe’s',
  ])('%j prints the domain', (name) => expect(clientRestaurantName(name, `https://${DOMAIN}`)).toBe(DOMAIN));

  it.each([
    ["Joe's - #1 rated in Texas", "Joe's"],
    ["Joe's: We never miss an order", "Joe's"],
    ["Joe's Diner - Top Rated - 5 Stars", "Joe's Diner"],
    ["Joe's | Order Online | Free Delivery", "Joe's"],
    ["Joe's Crab Shack - Tampa", "Joe's Crab Shack"],
  ])('%j keeps only the business name: %j', (name, kept) => expect(clientRestaurantName(name, `https://${DOMAIN}`)).toBe(kept));

  it.each(['Joe’s Stone Crab', 'Côte Brasserie', 'Señor Frog’s', 'Crêpes & Co', 'Five Star Pizza', '24/7 Diner', '21 Club', 'Order Up Diner', 'The Lost Kitchen'])(
    'keeps the real name %j',
    (name) => expect(isPublishableRestaurantName(name)).toBe(true),
  );
});

describe('client report and PDF data', () => {
  it('a claim-carrying name appears nowhere in the report; the domain is used on the cover, summary and Prepared for', () => {
    const dto = buildExecutiveReport(baseInput({ restaurantName: HOSTILE[0] }));
    const json = JSON.stringify(dto);
    expect(json).not.toMatch(/Guaranteed|\$40,000|Lost Revenue/);
    expect(dto.cover.restaurantName).toBe('testgrill.example');
    expect(dto.valueSignals.preparedFor).toBe('testgrill.example');
    expect(dto.executiveSummary).toContain('of the testgrill.example digital presence');
  });

  it('an ordinary name is unchanged everywhere (historical reports render as before)', () => {
    const dto = buildExecutiveReport(baseInput());
    expect(dto.cover.restaurantName).toBe('Test Grill');
    expect(dto.valueSignals.preparedFor).toBe('Test Grill');
    expect(dto.executiveSummary).toContain('of the Test Grill digital presence');
  });
});

describe('Sales Brief and audit-time resolution', () => {
  it('the Sales Brief loader and the audit-time resolver both use the screen', () => {
    const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    expect(src('src/lib/reports/salesData.ts').match(/clientRestaurantName\(audit\.restaurant\.name, audit\.restaurant\.websiteUrl\)/g)).toHaveLength(2);
    expect(src('src/lib/reports/salesData.ts')).not.toMatch(/safeDisplayName/);
    expect(src('src/lib/reports/executive.ts')).not.toMatch(/safeDisplayName|preparedFor: input\.restaurantName|\$\{input\.restaurantName\}/);
    expect(src('src/lib/audit/orchestrator.ts')).toMatch(/if \(publishable && shouldReplaceStoredName\(audit\.restaurant\.name, resolvedName\)\)/);
  });

  it('outreach text built from a screened name carries no claim', () => {
    const brief = generateSalesBrief({ restaurantName: clientRestaurantName(HOSTILE[0], 'https://example-grill.com'), overallScore: 70, coverageScore: 80, topLeaks: [], journey: [], evidence: [], recommendedTier: null } as never);
    expect(JSON.stringify(brief)).not.toMatch(/Guaranteed|\$40,000/);
  });
});

describe('slot vocabulary', () => {
  const ctx = (name: string): PublicationContext => ({ sources: [], restaurant: { name, websiteUrl: 'https://x.example' } });
  it('a claim-carrying name no longer widens the vocabulary that verifies quoted values', () => {
    expect(verifySlot('Proven Profitable Menu', ctx('Fastest Profitable Proven Bistro'), null, null)).toBeNull();
    expect(verifySlot('Proven Profitable Menu', ctx('Joe'), null, null)).toBeNull();
  });
  it('an ordinary name still verifies its own words', () => {
    expect(verifySlot("Leverock's Menu", ctx("Leverock's Great Seafood"), null, null)).toBe('VOCABULARY');
  });
});

describe('average ticket', () => {
  it('"1.250" is refused as ambiguous, not stored as $1.25', () => {
    expect(parseIntakeNumber('1.250', 'avgTicket')).toEqual({ ok: false, error: 'AVERAGE TICKET MUST BE A DOLLAR AMOUNT, FOR EXAMPLE 45' });
    expect(parseIntakeNumber('$1.250', 'avgTicket')).toMatchObject({ ok: false });
  });
  it('unambiguous forms still read as before', () => {
    expect(parseIntakeNumber('1,250', 'avgTicket')).toEqual({ ok: true, value: 1250 });
    expect(parseIntakeNumber('12.50', 'avgTicket')).toEqual({ ok: true, value: 12.5 });
    expect(parseIntakeNumber('45,50', 'avgTicket')).toEqual({ ok: true, value: 45.5 });
    expect(parseIntakeNumber('4.5', 'ownerRating')).toEqual({ ok: true, value: 4.5 });
  });
});
