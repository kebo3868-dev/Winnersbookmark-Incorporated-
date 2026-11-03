import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import current from '../../rescue-agent/tests/fixtures/leverocks-stored-audit.json';
import historical from '../../rescue-agent/tests/fixtures/leverocks-legacy-audit.json';
import * as configSchemas from '@/lib/frontdesk/config/schema';
import { marketingLeadSchema } from '@/lib/marketing/schema';

(globalThis as any).React = React;
let selected = current;
const auth = `Basic ${Buffer.from('trial:local-trial-password-0001').toString('base64')}`;
const hash = (v: string | Buffer) => crypto.createHash('sha256').update(v).digest('hex');
const phase = process.env.REPORT_PHASE ?? 'before';
const folder = path.resolve('../reports/dependency-remediation', phase);
fs.mkdirSync(folder, { recursive: true });
function audit() {
  const s = structuredClone(selected);
  return {
    ...s, id: s.auditId, restaurantId: 'local-verification-restaurant', status: 'COMPLETED', demoMode: false,
    createdAt: new Date(s.createdAt), completedAt: new Date(s.createdAt), avgTicketInput: null,
    reports: [{ content: { executiveSummary: 'Stored summary.', aiNarrativeUsed: false,
      recommendation: { tier: 'AI DISCOVERY AUDIT', rationale: 'unknown rationale' } } }],
  };
}
const readonlyModel = (find: () => unknown) => new Proxy({}, {
  get: (_target, key) => {
    if (key === 'findUnique') return async () => find();
    throw new Error(`Unexpected database operation: ${String(key)}`);
  },
});
vi.mock('@/lib/db', () => ({
  prisma: new Proxy({}, { get: (_target, table) => {
    if (table === 'audit') return readonlyModel(audit);
    if (table === 'salesIntelligence') return readonlyModel(() => ({
      id: 'local-brief', auditId: selected.auditId, createdAt: new Date('2026-11-01T12:00:00Z'),
      leadQualityScore: 70, salesOpportunityScore: 80, painLevel: 'HIGH', priority: 'HOT',
      buyerPersona: 'stored', bestSalesAngle: 'stored', topDiscoveryQuestion: 'stored', discoveryQuestions: [],
      likelyObjection: 'stored', objectionStrategy: 'stored', recommendedOffer: 'stored', outreachAngle: 'stored',
      emailOpener: 'stored', callOpener: 'stored', talkTrack: 'stored', followUpAngle: 'stored', audit: audit(),
    }));
    throw new Error(`Unexpected database table: ${String(table)}`);
  } }),
}));
vi.mock('next/headers', () => ({ headers: async () => ({ get: (k: string) => k === 'authorization' ? auth : null }) }));

function save(name: string, value: string | Buffer) {
  fs.writeFileSync(path.join(folder, name), value);
  if (phase === 'after' || process.env.REPORT_REFERENCE_PHASE) expect(hash(value), name).toEqual(hash(fs.readFileSync(path.resolve('../reports/dependency-remediation', process.env.REPORT_REFERENCE_PHASE ?? 'before', name))));
}

it('captures real loaders, report and Sales Brief HTML, PDF text and every PDF page raster; preserves both stored audits', async () => {
  process.env.BASIC_AUTH_USER = 'trial';
  process.env.BASIC_AUTH_PASSWORD = 'local-trial-password-0001';
  const { checkOperator } = await import('@/lib/operatorAuth');
  const { loadExecutiveReport } = await import('@/lib/reports/executiveData');
  const { loadSalesBrief } = await import('@/lib/reports/salesData');
  const ReportPage = (await import('@/app/audits/[auditId]/report/page')).default;
  const SalesPage = (await import('@/app/audits/[auditId]/sales/page')).default;
  const { GET } = await import('@/app/api/audits/[auditId]/report/pdf/route');
  const check = checkOperator(auth);
  if (!check.ok) throw new Error('operator denied');
  for (const [name, s] of [['current', current], ['historical', historical]] as const) {
    selected = s as typeof current;
    const original = hash(JSON.stringify(s));
    const params = { params: Promise.resolve({ auditId: s.auditId }) };
    const result = await loadExecutiveReport(check.operator, s.auditId);
    expect(result.status).toBe('ok');
    save(`${name}-executive.json`, JSON.stringify(result, null, 2) + '\n');
    save(`${name}-sales.json`, JSON.stringify(await loadSalesBrief(check.operator, s.auditId), null, 2) + '\n');
    save(`${name}-report.html`, renderToStaticMarkup(await ReportPage(params)));
    save(`${name}-sales.html`, renderToStaticMarkup(await SalesPage(params)));
    const response = await GET(new Request('http://local.invalid/report', { headers: { authorization: auth } }), params);
    expect(response.status).toBe(200);
    const pdf = Buffer.from(await response.arrayBuffer());
    const pdfFile = path.join(folder, `${name}.pdf`);
    fs.writeFileSync(pdfFile, pdf);
    save(`${name}-pdf.txt`, execFileSync('pdftotext', ['-layout', pdfFile, '-'], { encoding: 'utf8' }));
    const raster = fs.mkdtempSync('/tmp/wbi-pdf-raster-');
    execFileSync('pdftoppm', ['-r', '60', '-png', pdfFile, path.join(raster, 'page')]);
    const pages = fs.readdirSync(raster).sort().map(f => ({ page: f, sha256: hash(fs.readFileSync(path.join(raster, f))) }));
    save(`${name}-pdf-pages.json`, JSON.stringify(pages, null, 2) + '\n');
    expect(hash(JSON.stringify(s))).toBe(original);
    expect(s.overallScore).toBe(name === 'current' ? 84 : 73);
    expect(s.coverageScore).toBe(80);
    fs.rmSync(raster, { recursive: true });
  }
}, 120_000);

it('captures schema successes, defaults, rejection paths and exact validation messages', () => {
  const schemas = { ...configSchemas, marketingLeadSchema } as Record<string, any>;
  const samples: unknown[] = [undefined, null, false, 0, '', 'x', [], {}, { restaurantName: 'A Restaurant' },
    { restaurantName: '' }, { restaurantName: 'A', messaging: {} }, { restaurantName: 'A', escalationRouting: { UNKNOWN: 'manager' } },
    { name: '', email: 'bad', message: '' }, { name: 'A', email: 'a@example.com', message: 'Help' }];
  const results: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    if (typeof schema?.safeParse !== 'function') continue;
    results[name] = samples.map(input => {
      const result = schema.safeParse(input);
      return result.success ? { success: true, data: result.data } : {
        success: false, issues: result.error.issues.map((i: any) => ({ path: i.path, message: i.message })),
      };
    });
  }
  save('schema-contract.json', JSON.stringify(results, null, 2) + '\n');
});
