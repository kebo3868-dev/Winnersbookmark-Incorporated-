/**
 * CURRENT-ENGINE RECOMMENDATION DRIFT — reviews of ca3be50 and 9b4329e.
 *
 * The client report shows a finding's stored recommendation only when it is,
 * word for word, an audited engine string for its category
 * (recommendationTemplates.ts). This test reads the engine's source with the
 * TypeScript compiler and type checker (scripts/engine-source/engineSource.ts)
 * and determines the EFFECTIVE final value of every `recommendedSolution` the
 * engine (src/lib/audit) can write:
 *
 * - object literals are read for their effective properties: plain, string and
 *   computed keys (`['recommendedSolution']: …`), shorthand properties, and
 *   spreads of resolvable objects — the last assignment wins, and every
 *   superseded value is scanned too;
 * - identifiers are resolved through the checker's symbols, and only
 *   immutable bindings (`const` with an initializer) are followed;
 * - a spread or key that cannot be resolved but could supply the property,
 *   a mutable binding, or any later mutation of the property (assignment,
 *   element assignment, delete, Object.assign, Object.defineProperty,
 *   Reflect.set) fails the test — a final value that cannot be determined is
 *   never accepted.
 *
 * Every effective (category, wording) pair must be audited and take the
 * audited path. Mutation tests below show the scanner catching each bypass.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  Unresolvable,
  createEngineProgram,
  effectiveVariants,
  objectLiterals,
  stringValues,
  watchedMutations,
  typeHasProperty,
  where,
  type EngineProgram,
} from '../scripts/engine-source/engineSource';
import { auditedSolutionsFor, presentFindingRecommendation } from '@/lib/reports/recommendationTemplates';
import { isExploratoryOpportunity, presentRecommendedSolution } from '@/lib/reports/automationWording';

const ROOT = path.join(__dirname, '..');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();

function engineFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const f of fs.readdirSync(path.join(ROOT, 'src/lib/audit'))) {
    if (f.endsWith('.ts')) files.set(`src/lib/audit/${f}`, fs.readFileSync(path.join(ROOT, 'src/lib/audit', f), 'utf8'));
  }
  files.set('src/types/audit.ts', fs.readFileSync(path.join(ROOT, 'src/types/audit.ts'), 'utf8'));
  return files;
}

interface Pair { category: string; solution: string; at: string; effective: boolean }

/** The drift scan watches the recommendation and the category that selects its audited list. */
const WATCHED = new Set(['recommendedSolution', 'category']);

/**
 * An identity copy: `recommendedSolution: x.recommendedSolution` (the same
 * property, read from a value whose type declares it) re-writes a value
 * created elsewhere — and every creation site is itself scanned — so it
 * cannot introduce wording. Persisting engine output (prisma create) is such
 * a copy.
 */
const identityCopy = (ep: EngineProgram, e: import('typescript').Expression, prop: string) => {
  const t = e.getText().trim();
  const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([A-Za-z_$][\w$]*)$/.exec(t);
  if (!m || m[2] !== prop) return false;
  const base = (e as import('typescript').PropertyAccessExpression).expression;
  return base !== undefined && typeHasProperty(ep, base, prop);
};

/**
 * Every recommendation an engine source can write: (category, wording) for
 * the effective value and for every superseded value, plus any problem that
 * makes a final value undeterminable.
 */
function scan(ep: EngineProgram, files: string[]): { pairs: Pair[]; problems: string[]; uncategorised: Pair[] } {
  const pairs: Pair[] = [];
  const problems: string[] = [];
  const uncategorised: Pair[] = [];
  for (const rel of files) {
    const sf = ep.sources.get(rel);
    if (!sf) continue;
    problems.push(...watchedMutations(ep, sf, WATCHED).map((m) => `mutation of recommendedSolution: ${m}`));
    for (const obj of objectLiterals(sf)) {
      // Only objects that write the property (directly, by computed key, or by spread) are in scope.
      let variants;
      try {
        variants = effectiveVariants(ep, obj, 0, WATCHED);
      } catch (err) {
        problems.push(`${(err as Error).message}`);
        continue;
      }
      for (const props of variants) {
        const sol = props.get('recommendedSolution');
        if (!sol) continue;
        const values = [{ e: sol.value, effective: true }, ...sol.superseded.map((e) => ({ e, effective: false }))];
        // A value is evaluated whenever it can be. Only when it cannot, and it
        // is an identity copy of engine output, is it skipped: the copy writes
        // back a value created (and scanned) elsewhere.
        const evaluated: { solutions: string[]; effective: boolean; at: string }[] = [];
        let failed = false;
        for (const { e, effective } of values) {
          try {
            evaluated.push({ solutions: stringValues(ep, e), effective, at: where(e) });
          } catch (err) {
            if (identityCopy(ep, e, 'recommendedSolution')) continue;
            problems.push(`${(err as Error).message}`);
            failed = true;
          }
        }
        if (failed || evaluated.length === 0) continue;
        const cat = props.get('category');
        if (!cat) {
          // Wording created without a category (the order-button copy, which
          // the leak rule places under its category) must be audited for one.
          for (const v of evaluated) for (const solution of v.solutions) uncategorised.push({ category: '*', solution, at: v.at, effective: v.effective });
          continue;
        }
        let categories: string[];
        try {
          categories = stringValues(ep, cat.value);
        } catch (err) {
          if (identityCopy(ep, cat.value, 'category')) continue;
          problems.push(`${(err as Error).message}`);
          continue;
        }
        for (const v of evaluated) for (const solution of v.solutions) for (const category of categories) pairs.push({ category, solution, at: v.at, effective: v.effective });
      }
    }
  }
  return { pairs, problems, uncategorised };
}

const audited = (p: Pair) => auditedSolutionsFor(p.category).map(ws).includes(ws(p.solution));

describe('every recommendation the current engine can write is audited', () => {
  const files = engineFiles();
  const ep = createEngineProgram(files, ROOT);
  const { pairs, problems, uncategorised } = scan(ep, [...files.keys()].filter((f) => f.startsWith('src/lib/audit/')));
  const distinct = (ps: Pair[]) => [...new Map(ps.map((p) => [`${p.category}|${p.solution}`, p])).values()];

  it('every final value in the engine is determinable: no unresolvable object, key, spread or binding, and no mutation', () => {
    expect(problems).toEqual([]);
  });

  it('the engine covers the expected categories, every branch counted', () => {
    expect([...new Set(pairs.map((p) => p.category))].sort()).toEqual([
      'BROKEN CUSTOMER PATHWAY',
      'CATERING LEAD CAPTURE OPPORTUNITY',
      'CONFUSING CTA HIERARCHY',
      'CONTACT PATH FRICTION',
      'CUSTOMER RETENTION — NO PUBLIC OPT-IN ROUTE',
      'MENU ACCESS FRICTION',
      'ONLINE ORDERING FAILURE RISK',
      'ORDER BUTTON LABEL MISMATCH',
      'PHONE-DEPENDENT CUSTOMER JOURNEY',
      'THIRD-PARTY ORDERING DEPENDENCY',
      'WEBSITE TECHNICAL FOUNDATION',
    ]);
    // Every branch counted once: two link categories, three order-button
    // address steps, two menu and two CTA variants, three catering subjects.
    expect(distinct(pairs.filter((p) => p.effective))).toHaveLength(17);
  });

  it('wording created without a category is audited for some category', () => {
    expect(uncategorised.length).toBeGreaterThan(0);
    for (const p of uncategorised) {
      const known = ['ORDER BUTTON LABEL MISMATCH', 'BROKEN CUSTOMER PATHWAY', 'PHONE-DEPENDENT CUSTOMER JOURNEY'].some((c) => auditedSolutionsFor(c).map(ws).includes(ws(p.solution)));
      expect(known, `${p.at}: ${p.solution.slice(0, 80)}`).toBe(true);
    }
  });

  it('every effective and superseded (category, wording) pair is audited for its category', () => {
    for (const p of pairs) expect(audited(p), `${p.at} ${p.category}: ${p.solution.slice(0, 80)}`).toBe(true);
  });

  it('every effective value takes the audited path, never the fallback', () => {
    for (const p of pairs.filter((x) => x.effective)) {
      const opp = { category: p.category, aiFitScore: 95, recommendedSolution: p.solution };
      if (isExploratoryOpportunity(opp)) continue;
      expect(presentFindingRecommendation(opp), `${p.at} ${p.category}`).toBe(presentRecommendedSolution(p.category, p.solution));
    }
  });
});

// ── Mutation tests: the scanner on engine source it must reject ────────────

const SAFE = 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.';
const UNSAFE = 'Install the AI Front Desk immediately.';
const CAT = 'BROKEN CUSTOMER PATHWAY';

function scanSource(source: string) {
  const files = new Map([['src/lib/audit/probe.ts', source]]);
  return scan(createEngineProgram(files), ['src/lib/audit/probe.ts']);
}
const effective = (r: ReturnType<typeof scanSource>) => r.pairs.filter((p) => p.effective).map((p) => p.solution);
const superseded = (r: ReturnType<typeof scanSource>) => r.pairs.filter((p) => !p.effective).map((p) => p.solution);
const fails = (r: ReturnType<typeof scanSource>) => r.problems.length > 0 || r.pairs.some((p) => !audited(p)) || r.uncategorised.length > 0;

describe('mutation tests: an unsafe effective value cannot pass; a superseded safe value is still scanned', () => {
  it('baseline: a plain audited value passes', () => {
    const r = scanSource(`export const o = { category: '${CAT}', recommendedSolution: '${SAFE}' };`);
    expect(effective(r)).toEqual([SAFE]);
    expect(fails(r)).toBe(false);
  });

  it("a computed key overrides a safe value: { ..., ['recommendedSolution']: unsafe }", () => {
    const r = scanSource(`export const o = { category: '${CAT}', recommendedSolution: '${SAFE}', ['recommendedSolution']: '${UNSAFE}' };`);
    expect(effective(r)).toEqual([UNSAFE]);
    expect(superseded(r)).toEqual([SAFE]);
    expect(fails(r)).toBe(true);
  });

  it("the reported payload, inserted into the real engine's leaks.ts: ...{ ['recommendedSolution']: unsafe } fails; the safe value it supersedes is scanned", () => {
    const files = engineFiles();
    const leaks = files.get('src/lib/audit/leaks.ts')!;
    const safeLine = "      recommendedSolution: 'Fix the broken link(s) immediately. This is a direct website repair, not an AI project.',\n";
    expect(leaks).toContain(safeLine);
    files.set('src/lib/audit/leaks.ts', leaks.replace(safeLine, `${safeLine}      ...{ ['recommendedSolution']: '${UNSAFE}' },\n`));
    const r = scan(createEngineProgram(files, ROOT), ['src/lib/audit/leaks.ts']);
    const unsafe = r.pairs.filter((p) => p.solution === UNSAFE);
    expect(unsafe.length).toBeGreaterThan(0);
    expect(unsafe.every((p) => p.effective && !audited(p))).toBe(true);
    expect(r.pairs.some((p) => !p.effective && p.solution.startsWith('Fix the broken link(s) immediately.'))).toBe(true);
  });

  it('a computed key through a const name is resolved by symbol', () => {
    const r = scanSource(`const KEY = 'recommendedSolution';\nexport const o = { category: '${CAT}', recommendedSolution: '${SAFE}', [KEY]: '${UNSAFE}' };`);
    expect(effective(r)).toEqual([UNSAFE]);
    expect(fails(r)).toBe(true);
  });

  it('a spread after the safe value overrides it', () => {
    const r = scanSource(`const override = { recommendedSolution: '${UNSAFE}' };\nexport const o = { category: '${CAT}', recommendedSolution: '${SAFE}', ...override };`);
    expect(effective(r)).toEqual([UNSAFE]);
    expect(superseded(r)).toEqual([SAFE]);
    expect(fails(r)).toBe(true);
  });

  it('an unsafe spread that a later safe value overrides is still scanned, and still fails', () => {
    const r = scanSource(`const base = { recommendedSolution: '${UNSAFE}' };\nexport const o = { ...base, category: '${CAT}', recommendedSolution: '${SAFE}' };`);
    expect(effective(r)).toEqual([SAFE]);
    expect(superseded(r)).toEqual([UNSAFE]);
    expect(fails(r)).toBe(true);
  });

  it('a value through an imported const is resolved by symbol', () => {
    const files = new Map([
      ['src/lib/audit/words.ts', `export const WORDING = '${UNSAFE}';`],
      ['src/lib/audit/probe.ts', `import { WORDING } from './words';\nexport const o = { category: '${CAT}', recommendedSolution: WORDING };`],
    ]);
    const r = scan(createEngineProgram(files), ['src/lib/audit/probe.ts']);
    expect(r.pairs.map((p) => p.solution)).toEqual([UNSAFE]);
    expect(r.pairs.some((p) => !audited(p))).toBe(true);
  });

  it('a mutable binding is not followed: let fails', () => {
    const r = scanSource(`let wording = '${SAFE}';\nwording = '${UNSAFE}';\nexport const o = { category: '${CAT}', recommendedSolution: wording };`);
    expect(r.problems.join(' ')).toMatch(/not an immutable binding/);
    expect(fails(r)).toBe(true);
  });

  it('a computed key that cannot be determined fails', () => {
    const r = scanSource(`export function f(k: string) { return { category: '${CAT}', recommendedSolution: '${SAFE}', [k]: '${UNSAFE}' }; }`);
    expect(r.problems.join(' ')).toMatch(/computed property name cannot be determined/);
    expect(fails(r)).toBe(true);
  });

  it('a spread that cannot be resolved but could supply the property fails', () => {
    const r = scanSource(`export function f(extra: { recommendedSolution: string }) { return { category: '${CAT}', recommendedSolution: '${SAFE}', ...extra }; }`);
    expect(r.problems.join(' ')).toMatch(/spread that could override a watched property cannot be resolved/);
    expect(fails(r)).toBe(true);
  });

  it('mutation after construction fails: property assignment, element assignment, Object.assign, delete', () => {
    for (const mutation of [
      `o.recommendedSolution = '${UNSAFE}';`,
      `o['recommendedSolution'] = '${UNSAFE}';`,
      `Object.assign(o, { recommendedSolution: '${UNSAFE}' });`,
      `delete (o as { recommendedSolution?: string }).recommendedSolution;`,
      `Reflect.set(o, 'recommendedSolution', '${UNSAFE}');`,
    ]) {
      const r = scanSource(`export const o = { category: '${CAT}', recommendedSolution: '${SAFE}' };\n${mutation}`);
      expect(r.problems.length, mutation).toBeGreaterThan(0);
    }
  });

  it('a same-name copy cannot launder wording: a resolvable source is evaluated and fails', () => {
    const r = scanSource(`const other = { recommendedSolution: '${UNSAFE}' };\nexport const o = { category: '${CAT}', recommendedSolution: other.recommendedSolution };`);
    expect(effective(r)).toEqual([UNSAFE]);
    expect(fails(r)).toBe(true);
  });

  it('an expression it cannot evaluate fails rather than being skipped', () => {
    const r = scanSource(`export const o = { category: '${CAT}', recommendedSolution: ['${SAFE}'].join(' ') };`);
    expect(r.problems.join(' ')).toMatch(/cannot evaluate/);
  });

  it('Unresolvable is the error type used throughout', () => {
    expect(new Unresolvable('x')).toBeInstanceOf(Error);
  });
});
