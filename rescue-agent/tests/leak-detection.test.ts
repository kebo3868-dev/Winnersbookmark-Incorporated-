import { describe, expect, it } from 'vitest';
import { detectRevenueLeaks } from '@/lib/audit/leaks';
import { analyzeJourney } from '@/lib/audit/journey';
import type { EvidenceRecordLike } from '@/types/audit';

let idCounter = 0;
const ev = (evidenceType: string, fact: string, confidence = 80): EvidenceRecordLike => ({
  id: `ev_${idCounter++}`,
  evidenceType,
  fact,
  supportingContext: null,
  confidence,
});

describe('detectRevenueLeaks', () => {
  it('returns zero opportunities when evidence shows a healthy site (no fabrication)', () => {
    const evidence = [
      ev('BUSINESS_IDENTITY', 'Homepage title: "Great Restaurant".'),
      ev('PHONE_VISIBILITY', 'A phone number is publicly displayed ((555) 111-2222).'),
      ev('CLICK_TO_CALL', 'Click-to-call (tel:) links are present, enabling one-tap mobile calls.'),
      ev('FAQ_SIGNAL', 'A FAQ pathway is publicly linked (1 link(s) found).'),
      ev('MENU_ACCESS', 'A menu pathway is publicly linked (2 link(s) found).'),
      ev('EMAIL_CAPTURE', 'An email capture mechanism (signup form or newsletter invitation) is publicly visible.'),
      ev('LOYALTY_SIGNAL', 'A loyalty or rewards pathway is publicly linked (1 link(s) found).'),
      ev('CTA_SIGNAL', 'Homepage presents 4 action-oriented CTA(s).'),
      ev('HOURS_VISIBILITY', 'Business hours are published on the website.'),
      ev('ADDRESS_VISIBILITY', 'A street address is published on the website.'),
      ev('MOBILE_SIGNAL', 'Homepage declares a mobile viewport meta tag (basic mobile configuration present).'),
    ];
    const journey = analyzeJourney(evidence);
    const leaks = detectRevenueLeaks({ evidence, journey });
    expect(leaks).toHaveLength(0);
  });

  it('detects a broken transactional link with evidence attached', () => {
    const evidence = [
      ev('BROKEN_LINK', 'The linked ordering destination failed when tested (HTTP 404).', 95),
      ev('ORDERING_PATH', 'An online ordering pathway is publicly linked (1 link(s) found).'),
    ];
    const journey = analyzeJourney(evidence);
    const leaks = detectRevenueLeaks({ evidence, journey });
    const broken = leaks.find((l) => /ORDERING FAILURE/i.test(l.category));
    expect(broken).toBeDefined();
    expect(broken!.evidenceIds.length).toBeGreaterThan(0);
    expect(broken!.evidenceIds).toContain(evidence[0].id);
  });

  it('flags phone-dependent journey as manual validation required, never as confirmed missed calls', () => {
    const evidence = [
      ev('PHONE_VISIBILITY', 'A phone number is publicly displayed ((555) 111-2222).'),
      ev('CLICK_TO_CALL', 'No click-to-call (tel:) links detected; mobile visitors must dial manually.'),
      ev('FAQ_SIGNAL', 'No public FAQ pathway was detected on the analyzed website pages.', 70),
    ];
    const journey = analyzeJourney(evidence);
    const leaks = detectRevenueLeaks({ evidence, journey });
    const phone = leaks.find((l) => /PHONE-DEPENDENT/i.test(l.category));
    expect(phone).toBeDefined();
    expect(phone!.manualValidationRequired).toBe(true);
    expect(phone!.problem).not.toMatch(/is missing calls|misses \d+ calls/i);
    expect(phone!.problem).toMatch(/potential missed-call exposure/i);
  });

  it('forces manualValidationRequired below 60 confidence', () => {
    const evidence = [
      ev('HOURS_VISIBILITY', 'Business hours were not detected in the text of the analyzed pages.', 50),
      ev('ADDRESS_VISIBILITY', 'A street address was not detected in the text of the analyzed pages.', 50),
    ];
    const journey = analyzeJourney(evidence);
    const leaks = detectRevenueLeaks({ evidence, journey });
    const contact = leaks.find((l) => /CONTACT PATH/i.test(l.category));
    expect(contact).toBeDefined();
    expect(contact!.confidenceScore).toBeLessThan(60);
    expect(contact!.manualValidationRequired).toBe(true);
  });

  it('caps opportunities at 10', () => {
    const evidence = [
      ev('BROKEN_LINK', 'The linked ordering destination failed when tested (HTTP 404).', 95),
      ev('CLICK_TO_CALL', 'No click-to-call (tel:) links detected; mobile visitors must dial manually.'),
      ev('FAQ_SIGNAL', 'No public FAQ pathway was detected on the analyzed website pages.'),
      ev('EMAIL_CAPTURE', 'No public email capture mechanism was detected on the analyzed pages.'),
      ev('LOYALTY_SIGNAL', 'No public loyalty or rewards pathway was detected on the analyzed website pages.'),
      ev('MENU_ACCESS', 'The only detected menu links point to PDF files, which create friction on mobile devices.'),
      ev('CTA_SIGNAL', 'Homepage presents 12 competing CTAs, which can dilute the primary next action.'),
      ev('CATERING_PATH', 'A catering pathway is publicly linked (1 link(s) found).'),
      ev('TECHNICAL_SIGNAL', 'Website is served over HTTP without HTTPS, which browsers flag as not secure.'),
      ev('MOBILE_SIGNAL', 'Homepage lacks a mobile viewport meta tag; mobile rendering is likely degraded.'),
      ev('HOURS_VISIBILITY', 'Business hours were not detected in the text of the analyzed pages.'),
      ev('ADDRESS_VISIBILITY', 'A street address was not detected in the text of the analyzed pages.'),
      ev('ORDERING_PATH', 'Multiple competing ordering destinations detected across 3 different platforms.'),
      ev('PHONE_VISIBILITY', 'A phone number is publicly displayed ((555) 111-2222).'),
    ];
    const journey = analyzeJourney(evidence);
    const leaks = detectRevenueLeaks({ evidence, journey });
    expect(leaks.length).toBeGreaterThan(3);
    expect(leaks.length).toBeLessThanOrEqual(10);
    for (const leak of leaks) expect(leak.evidenceIds.length).toBeGreaterThan(0);
  });
});

describe('analyzeJourney honesty rules', () => {
  it('returns UNKNOWN (not RISK) for stages without evidence', () => {
    const journey = analyzeJourney([]);
    const reservation = journey.find((s) => s.stage === 'RESERVATION');
    const review = journey.find((s) => s.stage === 'REVIEW');
    expect(reservation!.status).toBe('UNKNOWN');
    expect(review!.status).toBe('UNKNOWN');
    expect(review!.manualValidationRequired).toBe(true);
  });

  it('marks missing reservation path as UNKNOWN with manual validation, not as a confirmed gap', () => {
    const journey = analyzeJourney([
      { id: 'e1', evidenceType: 'RESERVATION_PATH', fact: 'No public reservation pathway was detected on the analyzed website pages.', supportingContext: null, confidence: 65 },
    ]);
    const reservation = journey.find((s) => s.stage === 'RESERVATION');
    expect(reservation!.status).toBe('UNKNOWN');
    expect(reservation!.manualValidationRequired).toBe(true);
  });
});
