import { describe, expect, it } from 'vitest';
import { extractPage, classifyForms } from '@/lib/web/collector';
import { normalizeEvidence } from '@/lib/audit/evidence';
import { analyzeJourney } from '@/lib/audit/journey';
import {
  buildExecutiveReport,
  CONFIDENCE_LEGEND,
  confidenceLabel,
  type ExecutiveReportInput,
} from '@/lib/reports/executive';
import {
  previewExpiredPii,
  redactExpiredMarketingLeads,
  sweepExpiredPii,
  REDACTED_MARKER,
  type LeadRetentionClient,
  type MarketingRetentionClient,
  type RetentionPreviewClient,
} from '@/lib/leads/retention';
import type { EvidenceInput } from '@/types/audit';

const pageOf = (body: string, url = 'https://leverocks.com/') =>
  extractPage(url, url, 200, 'text/html', `<html><head><title>Leverock's</title></head><body>${body}</body></html>`);
const recordsFor = (body: string) => normalizeEvidence({ pages: [pageOf(body)], failures: [], probes: [] });
const find = (ev: EvidenceInput[], type: string) => ev.find((e) => e.evidenceType === type);
const stageOf = (ev: EvidenceInput[], stage: string) =>
  analyzeJourney(
    ev.map((e, i) => ({
      id: `e${i}`,
      evidenceType: e.evidenceType,
      fact: e.fact,
      confidence: e.confidence,
      supportingContext: e.supportingContext ?? null,
    })),
  ).find((s) => s.stage === stage);

// ── REQUIREMENT 1a: detect the contact form ───────────────────────────────
//
// `$('form')` was collected into a local that ended at `void formsHtml`, so a
// restaurant serving a contact form was told no enquiry form existed.

const CONTACT_FORM = `
  <a href="tel:+17273674588">Call us</a>
  <form action="/contact" id="contact-form">
    <input name="name" placeholder="Your name" />
    <input type="email" name="email" placeholder="Your email" />
    <textarea name="message" placeholder="How can we help?"></textarea>
    <button type="submit">Send</button>
  </form>
`;

describe('contact form detection', () => {
  it('detects an enquiry form on the page', () => {
    expect(pageOf(CONTACT_FORM).contactFormSignal).toBe(true);
  });

  it('reports it as traceable CONTACT_FORM evidence', () => {
    const form = find(recordsFor(CONTACT_FORM), 'CONTACT_FORM');
    expect(form?.fact).toMatch(/customer enquiry form is published/i);
    expect(form?.sourceUrl).toBe('https://leverocks.com/');
    expect(form?.supportingContext).toMatch(/not a newsletter signup/i);
  });

  it('bounds the claim — submitting is not the same as being answered', () => {
    expect(find(recordsFor(CONTACT_FORM), 'CONTACT_FORM')?.supportingContext)
      .toMatch(/whether the submission reaches anyone/i);
  });

  it('CONTACT_PATH can no longer deny the enquiry form it recorded', () => {
    const contact = find(recordsFor(CONTACT_FORM), 'CONTACT_PATH');
    expect(contact?.fact).not.toMatch(/\bno\b[^.]*enquiry form/i);
    expect(contact?.fact).not.toMatch(/no non-phone contact route/i);
    expect(contact?.fact).toMatch(/an enquiry form/i);
  });

  it('reads as prose when several routes exist', () => {
    const contact = find(recordsFor(`
      <a href="tel:+17273674588">Call</a>
      <a href="mailto:leverocksgreatseafood@gmail.com">Email</a>
      ${CONTACT_FORM}
    `), 'CONTACT_PATH');
    expect(contact?.fact).toMatch(/telephone, a published email address and an enquiry form/i);
  });

  it('a newsletter box is NOT a contact form', () => {
    const p = pageOf(`
      <form><label>Join our mailing list</label><input type="email" name="subscribe" /><button>Subscribe</button></form>
    `);
    expect(p.contactFormSignal).toBe(false);
    const ev = normalizeEvidence({ pages: [p], failures: [], probes: [] });
    expect(find(ev, 'CONTACT_FORM')).toBeUndefined();
    expect(find(ev, 'EMAIL_CAPTURE')?.fact).toMatch(/collecting visitors/i);
  });

  it('a search box is not a contact form', () => {
    expect(pageOf(`<form role="search"><input type="search" name="s" /><button>Go</button></form>`).contactFormSignal).toBe(false);
  });
});

// ── REQUIREMENT 1b: detect the reservation form ───────────────────────────

const RESERVATION_FORM = `
  <form action="/book" id="reservation-form">
    <h3>Book a table</h3>
    <input type="date" name="date" />
    <input type="time" name="time" />
    <select name="party_size"><option>2</option><option>4</option></select>
    <button type="submit">Request a table</button>
  </form>
`;

describe('reservation form detection', () => {
  it('detects a table-request form', () => {
    expect(pageOf(RESERVATION_FORM).reservationFormSignal).toBe(true);
    expect(pageOf(RESERVATION_FORM).contactFormSignal).toBe(false);
  });

  it('reports it without claiming a booking system exists', () => {
    const res = find(recordsFor(RESERVATION_FORM), 'RESERVATION_PATH');
    expect(res?.fact).toMatch(/table-request form is published/i);
    expect(res?.fact).toMatch(/could not be verified/i);
    // Must never borrow the phrasing that downstream layers read as tested.
    expect(res?.fact).not.toMatch(/publicly linked/i);
    expect(res?.supportingContext).toMatch(/not the same as holding a table/i);
  });

  it('does NOT make the RESERVATION stage look healthy or resolved', () => {
    const stage = stageOf(recordsFor(RESERVATION_FORM), 'RESERVATION');
    expect(stage?.status).toBe('UNKNOWN');
    expect(stage?.status).not.toBe('HEALTHY');
    expect(stage?.status).not.toBe('RESOLVED_UNVERIFIED');
    expect(stage?.manualValidationRequired).toBe(true);
    expect(stage?.finding).toMatch(/table-request form/i);
  });

  it('no longer says no reservation pathway exists when a form is served', () => {
    const res = find(recordsFor(RESERVATION_FORM), 'RESERVATION_PATH');
    expect(res?.fact).not.toMatch(/no public reservation pathway was detected/i);
  });

  it('a probed destination still outranks a bare form', () => {
    const ev = normalizeEvidence({
      pages: [pageOf(`<a href="https://resy.com/cities/ny/leverocks">Reserve</a>${RESERVATION_FORM}`)],
      failures: [],
      probes: [{ url: 'https://resy.com/cities/ny/leverocks', category: 'reservation', ok: true, httpStatus: 200, note: 'HTTP 200' }],
    });
    // The form branch is scoped to "form and nothing stronger", so a tested
    // destination governs the stage instead.
    expect(stageOf(ev, 'RESERVATION')?.status).not.toBe('UNKNOWN');
  });

  it('a generic contact form is not mistaken for a booking form', () => {
    expect(pageOf(CONTACT_FORM).reservationFormSignal).toBe(false);
  });

  it('classifyForms is conservative about bare wording', () => {
    // "reservations" in prose with no booking fields proves nothing.
    const $ = require('cheerio').load(`<form><input name="q" /><p>reservations</p></form>`);
    expect(classifyForms($).reservationFormSignal).toBe(false);
  });
});

// ── REQUIREMENT 2: the retention bug ──────────────────────────────────────

function marketingClient(count = 3) {
  const calls: { where: unknown; data: Record<string, unknown> }[] = [];
  const client: MarketingRetentionClient = {
    marketingLead: {
      updateMany: async (args) => {
        calls.push({ where: args.where, data: args.data as Record<string, unknown> });
        return { count };
      },
    },
  };
  return { client, calls };
}

function bothClient() {
  const calls: string[] = [];
  const client: LeadRetentionClient & MarketingRetentionClient = {
    auditLead: { updateMany: async () => { calls.push('auditLead'); return { count: 2 }; } },
    marketingLead: { updateMany: async () => { calls.push('marketingLead'); return { count: 5 }; } },
  };
  return { client, calls };
}

describe('marketing enquiries had no retention at all', () => {
  const now = new Date('2026-10-25T00:00:00.000Z');

  it('redacts every personal field a marketing enquiry carries', () => {
    const { client, calls } = marketingClient();
    return redactExpiredMarketingLeads(client, 365, now).then(() => {
      expect(calls[0].data).toEqual({
        name: REDACTED_MARKER,
        email: REDACTED_MARKER,
        message: REDACTED_MARKER,
        company: null,
        phone: null,
        websiteUrl: null,
        notes: null,
      });
    });
  });

  it('targets only enquiries older than the window', async () => {
    const { client, calls } = marketingClient();
    await redactExpiredMarketingLeads(client, 30, now);
    expect((calls[0].where as { createdAt: { lt: Date } }).createdAt.lt.toISOString()).toBe('2026-09-25T00:00:00.000Z');
  });

  it('is idempotent — an already-redacted row no longer matches', async () => {
    const { client, calls } = marketingClient();
    await redactExpiredMarketingLeads(client, 365, now);
    expect((calls[0].where as { NOT: { name: string } }).NOT).toEqual({ name: REDACTED_MARKER });
  });

  it('keeps the row so enquiry history survives', async () => {
    const { client, calls } = marketingClient();
    await redactExpiredMarketingLeads(client, 365, now);
    expect(calls).toHaveLength(1);
    expect(calls[0].data).not.toHaveProperty('status');
    expect(calls[0].data).not.toHaveProperty('createdAt');
  });
});

describe('one sweep covers every table holding personal data', () => {
  it('sweeps audit leads AND marketing enquiries', async () => {
    const { client, calls } = bothClient();
    const result = await sweepExpiredPii(client, 365);
    expect(calls.sort()).toEqual(['auditLead', 'marketingLead']);
    expect(result).toEqual({ retentionDays: 365, auditLeadsRedacted: 2, marketingLeadsRedacted: 5 });
  });

  it('stays off, and touches nothing, when retention is not configured', async () => {
    const { client, calls } = bothClient();
    const result = await sweepExpiredPii(client, null);
    expect(calls).toEqual([]);
    expect(result).toEqual({ retentionDays: null, auditLeadsRedacted: 0, marketingLeadsRedacted: 0 });
  });
});

describe('retention dry run shows what would happen and changes nothing', () => {
  const now = new Date('2026-10-25T00:00:00.000Z');
  const old = (days: number) => new Date(now.getTime() - days * 86_400_000);

  /**
   * The preview client exposes ONLY findMany and count. A write is not
   * something this test asserts against — it is something the preview function
   * has no method to perform.
   */
  function previewClient() {
    const writes: string[] = [];
    const client: RetentionPreviewClient = {
      auditLead: {
        count: async () => 2,
        findMany: async () => [
          { id: 'al-1', createdAt: old(400), contactName: 'Old Owner', email: 'old@example.org', phone: null },
          { id: 'al-2', createdAt: old(380), contactName: null, email: null, phone: '+15550001111' },
        ],
      },
      marketingLead: {
        count: async () => 1,
        findMany: async () => [{ id: 'ml-1', createdAt: old(500), name: 'Jane Diner', email: 'jane@example.org', phone: '+15559998888' }],
      },
    };
    return { client, writes };
  }

  it('counts every record a sweep would touch, across both tables', async () => {
    const { client } = previewClient();
    const p = await previewExpiredPii(client, 365, now);
    expect(p.auditLeadsAffected).toBe(2);
    expect(p.marketingLeadsAffected).toBe(1);
    expect(p.totalAffected).toBe(3);
  });

  it('reports the cutoff it would apply', async () => {
    const { client } = previewClient();
    const p = await previewExpiredPii(client, 365, now);
    expect(p.cutoff?.toISOString()).toBe('2025-10-25T00:00:00.000Z');
  });

  it('identifies each record and which personal fields it holds', async () => {
    const { client } = previewClient();
    const p = await previewExpiredPii(client, 365, now);
    const ml = p.sample.find((r) => r.id === 'ml-1');
    expect(ml?.table).toBe('MarketingLead');
    expect(ml?.ageDays).toBe(500);
    expect(ml?.fieldsHeld).toEqual(['name', 'email', 'phone']);
    const al2 = p.sample.find((r) => r.id === 'al-2');
    expect(al2?.fieldsHeld).toEqual(['phone']);
  });

  it('never returns the personal values themselves', async () => {
    const { client } = previewClient();
    const serialised = JSON.stringify(await previewExpiredPii(client, 365, now));
    for (const value of ['Jane Diner', 'jane@example.org', '+15559998888', 'Old Owner', 'old@example.org']) {
      expect(serialised, `preview leaked ${value}`).not.toContain(value);
    }
  });

  it('orders the sample oldest first — the most overdue records lead', async () => {
    const { client } = previewClient();
    const p = await previewExpiredPii(client, 365, now);
    expect(p.sample.map((r) => r.id)).toEqual(['ml-1', 'al-1', 'al-2']);
  });

  it('always marks itself as a dry run', async () => {
    const { client } = previewClient();
    expect((await previewExpiredPii(client, 365, now)).dryRun).toBe(true);
  });

  it('reports nothing affected when retention is disabled', async () => {
    const { client } = previewClient();
    const p = await previewExpiredPii(client, null, now);
    expect(p).toMatchObject({ retentionDays: null, cutoff: null, totalAffected: 0, sample: [], dryRun: true });
  });

  it('the endpoint routes ?dryRun=1 to the preview, not the sweep', () => {
    const route = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/app/api/retention/sweep/route.ts'),
      'utf8',
    );
    expect(route).toContain('previewExpiredPii');
    expect(route).toContain("searchParams.get('dryRun')");
  });
});

describe('retention no longer depends on an operator opening a page', () => {
  const read = (p: string) => require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf8');

  it('is reachable on a schedule', () => {
    const route = read('src/app/api/retention/sweep/route.ts');
    expect(route).toContain('sweepExpiredPii');
    expect(route).toMatch(/export const GET/);
    expect(route).toMatch(/export const POST/);
  });

  it('fails closed without a strong shared secret', () => {
    expect(read('src/app/api/retention/sweep/route.ts')).toContain('cronSecretMatches');
  });

  it('records its own auth failures through the bounded recorder', () => {
    // A silently rejected retention sweep is a data-protection failure nobody
    // would otherwise see.
    expect(read('src/app/api/retention/sweep/route.ts')).toContain('noteRejection');
  });

  it('the Leads page keeps an opportunistic sweep as a backstop', () => {
    expect(read('src/app/leads/page.tsx')).toContain('sweepExpiredPii');
  });
});

// ── REQUIREMENT 3: confidence labels are explained ────────────────────────

function reportInput(overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    auditId: 'clpresentation01',
    restaurantName: 'Test Grill',
    websiteUrl: 'https://testgrill.example',
    location: null,
    auditDate: '2026-10-25',
    auditStatus: 'COMPLETED',
    demoMode: false,
    contact: { company: 'Winnersbookmark', consultantName: 'Keith Warren', phone: '727-291-5965', email: null, bookingUrl: null, fallbackText: 'Call Keith.' },
    bookingQrDataUrl: null,
    avgTicket: null,
    overallScore: 70,
    coverageScore: 80,
    sourcesCollected: 5,
    sourcesFailed: 0,
    evidence: [
      { id: 'e1', evidenceType: 'CONTACT_EMAIL', fact: 'A public contact email address is published: x@y.com.', supportingContext: 'Found on https://testgrill.example.', confidence: 90, sourceUrl: 'https://testgrill.example' },
      { id: 'e2', evidenceType: 'CONTACT_FORM', fact: 'A customer enquiry form is published on the website.', supportingContext: null, confidence: 85, sourceUrl: 'https://testgrill.example/contact' },
      { id: 'e3', evidenceType: 'RESERVATION_PATH', fact: 'A table-request form is published.', supportingContext: null, confidence: 70, sourceUrl: 'https://testgrill.example/book' },
      { id: 'e4', evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected.', supportingContext: null, confidence: 55, sourceUrl: 'https://testgrill.example' },
    ],
    opportunities: [],
    journey: [],
    categoryScores: [],
    storedSummary: null,
    storedSummaryWasAiEnhanced: false,
    storedRecommendation: null,
    ...overrides,
  };
}

describe('confidence numbers are explained, not left as bare percentages', () => {
  it('publishes a legend saying what the number measures', () => {
    const dto = buildExecutiveReport(reportInput());
    expect(dto.confidenceLegend).toBe(CONFIDENCE_LEGEND);
    expect(dto.confidenceLegend).toMatch(/how directly each fact was observed/i);
    expect(dto.confidenceLegend).toMatch(/not how likely an outcome is/i);
  });

  it('names every band the labels can produce', () => {
    for (const band of ['Strong', 'Moderate', 'Preliminary']) {
      expect(CONFIDENCE_LEGEND, band).toContain(band);
    }
  });

  it('labels each evidence item with the band its score falls in', () => {
    const dto = buildExecutiveReport(reportInput());
    expect(dto.appendix.map((e) => e.confidenceLabel)).toEqual(['Strong', 'Strong', 'Moderate', 'Preliminary']);
  });

  it('the legend thresholds match confidenceLabel, so they cannot drift', () => {
    expect(confidenceLabel(80)).toBe('Strong');
    expect(confidenceLabel(79)).toBe('Moderate');
    expect(confidenceLabel(60)).toBe('Moderate');
    expect(confidenceLabel(59)).toBe('Preliminary');
    expect(CONFIDENCE_LEGEND).toContain('80–100');
    expect(CONFIDENCE_LEGEND).toContain('60–79');
    expect(CONFIDENCE_LEGEND).toContain('under 60');
  });

  it('keeps the raw score alongside the label — the label replaces nothing', () => {
    const dto = buildExecutiveReport(reportInput());
    expect(dto.appendix[0].confidence).toBe(90);
    expect(dto.appendix[0].confidenceLabel).toBe('Strong');
  });
});
