import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { extractPage } from '../src/lib/web/collector';
import { normalizeEvidence } from '../src/lib/audit/evidence';
import { analyzeJourney } from '../src/lib/audit/journey';
import { detectRevenueLeaks } from '../src/lib/audit/leaks';
import { calculateCategoryScores, calculateOverallScore } from '../src/lib/scoring/rescueScore';
import { rankOpportunities } from '../src/lib/scoring/priority';
import { buildExecutiveReport } from '../src/lib/reports/executive';
import { getContact } from '../src/lib/config';
import { ExecutivePdf } from '../src/lib/pdf/ExecutivePdf';
import { findingStatus, evidenceConfidence } from '../src/lib/audit/integrity';

// Opt-in validation of operator-captured public HTML, never a live crawl or DB
// write. Supply SNAPSHOT_DIR and VALIDATION_OUTPUT_DIR. Does not test HTTP UI.
const state = vi.hoisted(() => ({ dto: null as unknown }));
vi.mock('../src/lib/reports/executiveData', () => ({ loadExecutiveReport: async () => ({ status: 'ok', dto: state.dto }) }));

it('validates three captured restaurant pages and renders the real report components', async () => {
  const source = process.env.SNAPSHOT_DIR;
  const output = process.env.VALIDATION_OUTPUT_DIR;
  if (!source || !output) throw new Error('Supply SNAPSHOT_DIR and VALIDATION_OUTPUT_DIR; snapshots must be captured with permission and robots review.');
  fs.mkdirSync(output, { recursive: true });
  const cases = [
    ['leverocks', "Leverock's Great Seafood", 'https://leverocks.com/'],
    ['bellabrava', 'BellaBrava (multi-location website)', 'https://www.bellabrava.com/'],
    ['shrimpstore', 'Fourth Street Shrimp Store', 'https://www.theshrimpstore.com/'],
  ];
  const results = [];
  for (const [key, name, url] of cases) {
    const html = fs.readFileSync(path.join(source, `${key}.html`), 'utf8');
    const p = extractPage(url, url, 200, 'text/html', html);
    const evidence = normalizeEvidence({ pages: [p], failures: [], probes: [] }).map((e, i) => ({ ...e, id: `${key}-${i + 1}` }));
    const journey = analyzeJourney(evidence);
    const categories = calculateCategoryScores(journey, evidence);
    const score = calculateOverallScore(categories);
    expect(calculateOverallScore(calculateCategoryScores(analyzeJourney(evidence), evidence))).toEqual(score);
    const opportunities = rankOpportunities(detectRevenueLeaks({ evidence, journey }));
    const dto = buildExecutiveReport({ auditId: `validation-${key}`, restaurantName: name, websiteUrl: url,
      location: null, auditDate: '2026-10-24', auditStatus: 'PARTIALLY_COMPLETED', demoMode: false,
      contact: getContact({}), bookingQrDataUrl: null, avgTicket: null,
      ...score, sourcesCollected: 1, sourcesFailed: 0, evidence, opportunities, journey, categoryScores: categories,
      storedSummary: null, storedSummaryWasAiEnhanced: false, storedRecommendation: null });
    dto.cover.subtitle = 'DEVELOPMENT VALIDATION SAMPLE — one captured homepage; not a complete client audit';
    dto.methodologyAndLimitations.unshift('Development validation only. One homepage captured October 24, 2026. No transaction links were probed, no owner data supplied, and no live database audit was run. Do not send as a finished client audit.');
    results.push({ key, name, url, title: p.title, email: p.emails, phone: p.phones, links: p.categorizedLinks,
      score, categories, journey, opportunities, evidence: evidence.map((e) => ({ ...e, status: findingStatus(e), evidenceConfidence: evidenceConfidence(e.confidence) })) });
    if (key === 'leverocks') {
      const pdf = await renderToBuffer(ExecutivePdf({ dto }));
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      fs.writeFileSync(path.join(output, 'Leverocks_Development_Validation.pdf'), pdf);
      state.dto = dto;
      const { default: ReportPage } = await import('../src/app/audits/[auditId]/report/page');
      const markup = renderToStaticMarkup(await ReportPage({ params: Promise.resolve({ auditId: 'validation-leverocks' }) }));
      const cssDir = path.resolve('.next/static/css');
      const css = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n') : '';
      fs.writeFileSync(path.join(output, 'report.html'), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="max-w-6xl mx-auto px-4 py-8">${markup}</main></body></html>`);
    }
  }
  fs.writeFileSync(path.join(output, 'snapshot-results.json'), JSON.stringify(results, null, 2));
}, 30_000);
