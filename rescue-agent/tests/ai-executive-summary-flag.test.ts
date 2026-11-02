/**
 * AI_EXECUTIVE_SUMMARY FEATURE FLAG (default OFF).
 *
 * - Generation: the audit gets an AI provider for the executive summary only
 *   when AI_EXECUTIVE_SUMMARY=enabled AND a provider is configured.
 * - Display: a summary stored as AI-written at audit time is shown only while
 *   the flag is enabled. Otherwise the web report and the PDF both show the
 *   deterministic summary, and the stored record is left as it is.
 * - /api/health reports what the pipeline and reports actually do.
 * - Nothing else in the report depends on the flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Pages are rendered by calling them; the test transform needs React in scope for their JSX.
(globalThis as { React?: typeof React }).React = React;

// ── DATABASE DOUBLE: one completed audit whose owner report was stored with an
// AI-written summary (the historical case). Reads are recorded; any write fails
// the test, since display must never alter a stored record.
const AUDIT_ID = 'cmvflag0000000000000000a';
const STORED_AI_SUMMARY =
  'Quillwhistle stored narrative: this paragraph was written by the AI provider at audit time and kept in the owner report.';
const STORED_DETERMINISTIC_SUMMARY = 'Stored deterministic owner summary.';

let storedOwnerReport: Record<string, unknown> = {};
const writes: string[] = [];

function auditRecord() {
  return {
    id: AUDIT_ID,
    status: 'COMPLETED',
    demoMode: false,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    completedAt: new Date('2026-10-01T12:05:00Z'),
    avgTicketInput: null,
    overallScore: 68,
    coverageScore: 80,
    restaurant: { name: 'Flag Test Grill', websiteUrl: 'https://flagtestgrill.example', city: 'Tampa', state: 'FL' },
    sources: [
      { id: 's1', status: 'COLLECTED', url: 'https://flagtestgrill.example' },
      { id: 's2', status: 'COLLECTED', url: 'https://flagtestgrill.example/menu' },
    ],
    evidence: [
      { id: 'e1', evidenceType: 'FAQ_SIGNAL', fact: 'No public FAQ pathway was detected on the analyzed website pages.', supportingContext: null, confidence: 70, auditSourceId: 's1' },
      { id: 'e2', evidenceType: 'BROKEN_LINK', fact: 'The linked ordering destination failed when tested (HTTP 404).', supportingContext: 'https://flagtestgrill.example/order', confidence: 95, auditSourceId: 's1' },
    ],
    opportunities: [
      {
        category: 'ONLINE ORDERING FAILURE RISK',
        title: 'A transaction link on the website is failing',
        problem: 'The ordering link returns 404.',
        businessImpact: 'Order-intent customers hit a dead end.',
        customerJourneyStage: 'ORDERING',
        evidenceIds: ['e2'],
        impactScore: 90, urgencyScore: 90, confidenceScore: 95, aiFitScore: 20, rescuePriorityScore: 90,
        recommendedSolution: 'Fix the broken link immediately.',
        manualValidationRequired: false,
      },
    ],
    journeyStages: [
      { stage: 'WEBSITE', status: 'HEALTHY', finding: 'The website loaded successfully.', manualValidationRequired: false },
      { stage: 'ORDERING', status: 'RISK', finding: 'The ordering link failed when tested.', manualValidationRequired: false },
    ],
    scores: [],
    reports: [{ content: storedOwnerReport }],
  };
}

const prismaDouble = {
  audit: {
    findUnique: async () => auditRecord(),
    update: async () => { writes.push('audit.update'); throw new Error('write during display'); },
  },
  report: {
    update: async () => { writes.push('report.update'); throw new Error('write during display'); },
    updateMany: async () => { writes.push('report.updateMany'); throw new Error('write during display'); },
    upsert: async () => { writes.push('report.upsert'); throw new Error('write during display'); },
  },
  $queryRaw: async () => [{ '?column?': 1 }],
};

vi.mock('@/lib/db', () => ({
  prisma: prismaDouble,
  resolveDatabaseUrl: () => 'postgresql://localhost:5432/test',
  resolveDatabaseUrlSource: () => 'DATABASE_URL',
  RUNTIME_URL_SOURCES: ['DATABASE_URL'],
}));

const requestHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined }),
}));

const USER = 'operator';
const PASSWORD = 'operator-password-for-tests-0001';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;

const ORIGINAL_ENV = { ...process.env };
const PROVIDER = { AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test-not-a-real-key' };

function setEnv(extra: Record<string, string | undefined>) {
  const env: Record<string, string | undefined> = { ...ORIGINAL_ENV, BASIC_AUTH_USER: USER, BASIC_AUTH_PASSWORD: PASSWORD };
  delete env.AI_EXECUTIVE_SUMMARY;
  delete env.AI_PROVIDER;
  delete env.ANTHROPIC_API_KEY;
  process.env = { ...env, ...extra } as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries(extra)) if (v === undefined) delete process.env[k];
}

beforeEach(() => {
  writes.length = 0;
  requestHeaders.clear();
  requestHeaders.set('authorization', AUTH);
  storedOwnerReport = { executiveSummary: STORED_AI_SUMMARY, aiNarrativeUsed: true, recommendation: null };
  setEnv({});
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function operator() {
  const { checkOperator } = await import('@/lib/operatorAuth');
  const check = checkOperator(AUTH);
  if (!check.ok) throw new Error('test operator credential refused');
  return check.operator;
}

async function loadDto() {
  const { loadExecutiveReport } = await import('@/lib/reports/executiveData');
  const result = await loadExecutiveReport(await operator(), AUDIT_ID);
  if (result.status !== 'ok') throw new Error(`unexpected ${result.status}`);
  return result.dto;
}

/** All text runs of a PDF, in content-stream order. */
function pdfText(pdf: Buffer): string {
  const latin = pdf.toString('latin1');
  const runs: string[] = [];
  for (const match of latin.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    let data = pdf.subarray(start, latin.indexOf('endstream', start));
    try {
      data = zlib.inflateSync(data);
    } catch {
      continue;
    }
    for (const run of data.toString('latin1').matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...run[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      const step = hex.length > 0 && /^(00[0-9a-fA-F]{2})+$/.test(hex) ? 4 : 2;
      let text = '';
      for (let i = 0; i < hex.length; i += step) text += String.fromCharCode(parseInt(hex.slice(i, i + step), 16));
      runs.push(text);
    }
  }
  return runs.join(' ').replace(/\s+/g, ' ');
}

async function pdfFromRoute(): Promise<string> {
  const { GET } = await import('@/app/api/audits/[auditId]/report/pdf/route');
  const response = await GET(new Request(`https://x.invalid/api/audits/${AUDIT_ID}/report/pdf`, { headers: { authorization: AUTH } }), {
    params: Promise.resolve({ auditId: AUDIT_ID }),
  });
  expect(response.status).toBe(200);
  return pdfText(Buffer.from(await response.arrayBuffer()));
}

async function webPage(): Promise<string> {
  const Page = (await import('@/app/audits/[auditId]/report/page')).default;
  const element = await Page({ params: Promise.resolve({ auditId: AUDIT_ID }) });
  return renderToStaticMarkup(element as React.ReactElement);
}

// ── FLAG PARSING ────────────────────────────────────────────────────────────

describe('AI_EXECUTIVE_SUMMARY parsing', () => {
  it('is off by default and turns on only for the exact value "enabled"', async () => {
    const { aiExecutiveSummaryEnabled } = await import('@/lib/ai/executiveSummary');
    expect(aiExecutiveSummaryEnabled({})).toBe(false);
    expect(aiExecutiveSummaryEnabled({ AI_EXECUTIVE_SUMMARY: '' })).toBe(false);
    for (const value of ['true', '1', 'on', 'yes', 'enable', 'disabled', 'off', 'enabled please']) {
      expect(aiExecutiveSummaryEnabled({ AI_EXECUTIVE_SUMMARY: value }), value).toBe(false);
    }
    for (const value of ['enabled', ' enabled ', 'ENABLED', 'Enabled']) {
      expect(aiExecutiveSummaryEnabled({ AI_EXECUTIVE_SUMMARY: value }), value).toBe(true);
    }
  });

  it('reads process.env by default', async () => {
    const { aiExecutiveSummaryEnabled } = await import('@/lib/ai/executiveSummary');
    expect(aiExecutiveSummaryEnabled()).toBe(false);
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled' });
    expect(aiExecutiveSummaryEnabled()).toBe(true);
  });
});

// ── GENERATION AT AUDIT TIME ────────────────────────────────────────────────

describe('generation: a provider only with the flag enabled and a valid provider', () => {
  it('enabled + configured provider: the audit gets the provider', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    const { getExecutiveSummaryProvider } = await import('@/lib/ai/executiveSummary');
    expect(getExecutiveSummaryProvider()?.name).toBe('anthropic');
  });

  it('disabled (unset) + configured provider: no provider, so the deterministic summary is stored', async () => {
    setEnv({ ...PROVIDER });
    const { getExecutiveSummaryProvider } = await import('@/lib/ai/executiveSummary');
    expect(getExecutiveSummaryProvider()).toBeNull();
  });

  it('disabled by an unrecognised value + configured provider: no provider', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'true', ...PROVIDER });
    const { getExecutiveSummaryProvider } = await import('@/lib/ai/executiveSummary');
    expect(getExecutiveSummaryProvider()).toBeNull();
  });

  it('enabled + missing provider: no provider in every missing-provider shape', async () => {
    const { getExecutiveSummaryProvider } = await import('@/lib/ai/executiveSummary');
    for (const env of [
      {},
      { AI_PROVIDER: 'anthropic' },
      { ANTHROPIC_API_KEY: 'sk-test-not-a-real-key' },
      { AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'sk-test-not-a-real-key' },
      { AI_PROVIDER: '', ANTHROPIC_API_KEY: 'sk-test-not-a-real-key' },
    ]) {
      setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...env });
      expect(getExecutiveSummaryProvider(), JSON.stringify(env)).toBeNull();
    }
  });

  it('disabled + missing provider: no provider', async () => {
    const { getExecutiveSummaryProvider } = await import('@/lib/ai/executiveSummary');
    expect(getExecutiveSummaryProvider()).toBeNull();
  });

  it('the audit pipeline obtains its provider only through the flag', () => {
    const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    const orchestrator = src('src/lib/audit/orchestrator.ts');
    expect(orchestrator).toMatch(/const provider = getExecutiveSummaryProvider\(\);/);
    expect(orchestrator).not.toMatch(/getAiProvider|from '@\/lib\/ai\/provider'/);
    // aiEnabled on the audit follows the gated provider.
    expect(orchestrator).toMatch(/aiEnabled: Boolean\(provider\) && !aiFailed/);

    // No other source file may call the ungated provider directly.
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && /getAiProvider\(/.test(fs.readFileSync(full, 'utf8'))) {
          callers.push(path.relative(path.join(__dirname, '..'), full));
        }
      }
    };
    walk(path.join(__dirname, '..', 'src'));
    expect(callers.sort()).toEqual(['src/lib/ai/executiveSummary.ts', 'src/lib/ai/provider.ts']);
  });
});

// ── DISPLAY OF HISTORICAL (STORED) AI SUMMARIES ─────────────────────────────

describe('display: historical AI summaries follow the flag; stored records are untouched', () => {
  it('flag off (default): a stored AI summary is not shown; the deterministic summary is', async () => {
    const before = JSON.stringify(storedOwnerReport);
    const dto = await loadDto();
    expect(dto.executiveSummary).not.toContain('Quillwhistle');
    expect(dto.executiveSummary).toMatch(/^Our audit analyzed 2 public page\(s\) of the Flag Test Grill digital presence/);
    expect(dto.summaryWasAiEnhanced).toBe(false);
    expect(JSON.stringify(storedOwnerReport)).toBe(before);
    expect(writes).toEqual([]);
  });

  it('flag off with a provider configured: still not shown', async () => {
    setEnv({ ...PROVIDER });
    const dto = await loadDto();
    expect(dto.executiveSummary).not.toContain('Quillwhistle');
    expect(dto.summaryWasAiEnhanced).toBe(false);
  });

  it('flag set to an unrecognised value: still not shown', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'true', ...PROVIDER });
    const dto = await loadDto();
    expect(dto.executiveSummary).not.toContain('Quillwhistle');
  });

  it('flag enabled: the stored AI summary is shown', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    const dto = await loadDto();
    expect(dto.executiveSummary).toBe(STORED_AI_SUMMARY);
    expect(dto.summaryWasAiEnhanced).toBe(true);
    expect(writes).toEqual([]);
  });

  it('flag enabled with the provider missing: the stored text needs no provider, so it is shown', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled' });
    const dto = await loadDto();
    expect(dto.executiveSummary).toBe(STORED_AI_SUMMARY);
  });

  it('a stored deterministic summary is unaffected by the flag', async () => {
    storedOwnerReport = { executiveSummary: STORED_DETERMINISTIC_SUMMARY, aiNarrativeUsed: false, recommendation: null };
    const off = await loadDto();
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    const on = await loadDto();
    expect(on.executiveSummary).toBe(off.executiveSummary);
    expect(on.summaryWasAiEnhanced).toBe(false);
  });

  it('only the summary changes: scores, findings, evidence, confidence and classification are identical', async () => {
    const off = await loadDto();
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    const on = await loadDto();
    const strip = (dto: typeof off) => {
      const { executiveSummary: _s, summaryWasAiEnhanced: _a, ...rest } = dto;
      return rest;
    };
    expect(on.executiveSummary).not.toBe(off.executiveSummary);
    expect(strip(on)).toEqual(strip(off));
  });
});

// ── WEB AND PDF APPLY THE SAME CONFIGURATION ────────────────────────────────

describe('the web report and the PDF export agree', () => {
  it('flag off: neither shows the stored AI summary; both show the deterministic one', async () => {
    const html = await webPage();
    const pdf = await pdfFromRoute();
    expect(html).not.toContain('Quillwhistle');
    expect(pdf).not.toContain('Quillwhistle');
    expect(html).toContain('Our audit analyzed 2 public page(s)');
    expect(pdf).toContain('Our audit analyzed');
  }, 60_000);

  it('flag enabled: both show the stored AI summary', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    const html = await webPage();
    const pdf = await pdfFromRoute();
    expect(html).toContain('Quillwhistle');
    expect(pdf).toContain('Quillwhistle');
    expect(html).not.toContain('Our audit analyzed 2 public page(s)');
  }, 60_000);

  it('both surfaces load through the one gated loader', () => {
    const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    for (const file of ['src/app/api/audits/[auditId]/report/pdf/route.ts', 'src/app/audits/[auditId]/report/page.tsx']) {
      expect(src(file), file).toMatch(/loadExecutiveReport\(/);
      expect(src(file), file).not.toMatch(/storedSummary|aiNarrativeUsed|reportType/);
    }
    expect(src('src/lib/reports/executiveData.ts')).toMatch(/showStoredAiExecutiveSummary\(Boolean\(owner\?\.aiNarrativeUsed\)\)/);
  });
});

// ── /api/health ─────────────────────────────────────────────────────────────

describe('/api/health reports actual executive-summary availability', () => {
  async function health(withCredential = true) {
    const { GET } = await import('@/app/api/health/route');
    const response = await GET(new Request('https://x.invalid/api/health', withCredential ? { headers: { authorization: AUTH } } : {}));
    return (await response.json()) as { config?: { executiveSummary?: Record<string, string>; aiNarrative?: unknown } };
  }

  it('default (flag unset, no provider): deterministic, stored AI summaries hidden', async () => {
    const body = await health();
    expect(body.config?.executiveSummary).toEqual({
      newAudits: 'deterministic',
      storedAiSummaries: 'hidden (deterministic summary shown)',
      flag: 'off (AI_EXECUTIVE_SUMMARY unset)',
      provider: 'not configured (AI_PROVIDER unset)',
    });
    expect(body.config).not.toHaveProperty('aiNarrative');
  });

  it('flag off with a provider configured: still deterministic, though the provider is reported', async () => {
    setEnv({ ...PROVIDER });
    const status = (await health()).config?.executiveSummary;
    expect(status?.newAudits).toBe('deterministic');
    expect(status?.storedAiSummaries).toBe('hidden (deterministic summary shown)');
    expect(status?.provider).toBe('anthropic (configured)');
  });

  it('an unrecognised flag value is reported as off', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'true', ...PROVIDER });
    const status = (await health()).config?.executiveSummary;
    expect(status?.flag).toMatch(/^off \(unrecognised value; only AI_EXECUTIVE_SUMMARY=enabled turns it on\)$/);
    expect(status?.newAudits).toBe('deterministic');
  });

  it('flag enabled + provider: AI-enhanced, stored AI summaries shown', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    expect((await health()).config?.executiveSummary).toEqual({
      newAudits: 'ai-enhanced',
      storedAiSummaries: 'shown',
      flag: 'enabled',
      provider: 'anthropic (configured)',
    });
  });

  it('flag enabled + missing provider: deterministic, naming what is missing', async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{}, 'not configured (AI_PROVIDER unset)'],
      [{ AI_PROVIDER: 'anthropic' }, 'not configured (AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing)'],
      [{ AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'sk-test-not-a-real-key' }, 'not configured (AI_PROVIDER is not a supported provider; use anthropic)'],
    ];
    for (const [env, provider] of cases) {
      setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...env });
      const status = (await health()).config?.executiveSummary;
      expect(status?.newAudits, JSON.stringify(env)).toBe('deterministic');
      expect(status?.provider, JSON.stringify(env)).toBe(provider);
      expect(status?.storedAiSummaries).toBe('shown');
    }
  });

  it('never reveals the key, and stays operator-only', async () => {
    setEnv({ AI_EXECUTIVE_SUMMARY: 'enabled', ...PROVIDER });
    expect(JSON.stringify(await health())).not.toContain('sk-test-not-a-real-key');
    const anonymous = await health(false);
    expect(anonymous).not.toHaveProperty('config');
    expect(JSON.stringify(anonymous)).not.toMatch(/executiveSummary|AI_EXECUTIVE_SUMMARY/);
  });
});

// ── DOCUMENTATION ───────────────────────────────────────────────────────────

describe('the flag is documented', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

  it('.env.example ships it off and explains how to turn it on', () => {
    const example = read('.env.example');
    expect(example).toMatch(/^AI_EXECUTIVE_SUMMARY=$/m);
    expect(example).toMatch(/AI_EXECUTIVE_SUMMARY=enabled/);
  });

  it('the deployment guide describes it', () => {
    const doc = read('docs/DEPLOYMENT.md');
    expect(doc).toMatch(/`AI_EXECUTIVE_SUMMARY`/);
    expect(doc).toMatch(/default (is )?off/i);
  });
});
