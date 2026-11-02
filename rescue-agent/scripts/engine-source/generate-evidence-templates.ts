/**
 * Generates src/lib/reports/generated/evidenceTemplates.ts: the audited
 * provenance patterns for evidence facts and supporting context.
 *
 * Every object literal in src/lib/audit that writes `fact` or
 * `supportingContext` is evaluated (engineSource.ts, pattern mode) into regex
 * patterns — the engine's literal wording with a slot wherever it
 * interpolated a value — bound to the `evidenceType` written beside it. This
 * is done for the working tree AND for every commit in this repository's
 * history that touched src/lib/audit, so evidence stored by an earlier engine
 * version can still be traced to the code that wrote it. A pattern with too
 * little literal text to establish provenance is dropped.
 *
 * Run: npx vite-node scripts/engine-source/run-generate-evidence-templates.ts
 * tests/evidence-provenance.test.ts fails if the working tree produces a
 * pattern this file does not contain.
 */
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { SLOT, anchoredLength, contextBindings, createEngineProgram, effectiveProperties, effectiveVariants, objectLiterals, patternValues, stringValues } from './engineSource';

export interface EvidenceTemplate {
  /** evidenceType values the pattern was written with; null when the type could not be determined. */
  types: string[] | null;
  field: 'fact' | 'supportingContext';
  pattern: string;
}

/**
 * Literal characters a pattern needs before it counts as provenance. A
 * supporting-context frame can be short ("Examples: …", "Hosts: …"); its slots
 * are still checked when published.
 */
export const MIN_ANCHOR = { fact: 16, supportingContext: 7 } as const;

/** The provenance patterns a set of engine files (repo-relative path → text) can produce. */
export function templatesFrom(files: Map<string, string>): EvidenceTemplate[] {
  const ep = createEngineProgram(files);
  const out: EvidenceTemplate[] = [];
  for (const [rel, sf] of ep.sources) {
    if (!rel.startsWith('src/lib/audit/')) continue;
    for (const obj of objectLiterals(sf)) {
      let props;
      try {
        props = effectiveProperties(ep, obj);
      } catch {
        continue;
      }
      const fields = (['fact', 'supportingContext'] as const).filter((f) => props.has(f));
      if (fields.length === 0) continue;
      // Evaluated once per iteration of each enclosing loop over an immutable
      // array (loopBindings), so a type and the wording written beside it
      // stay correlated: `{ evidenceType: check.type, fact: `No public
      // ${check.label} pathway …` }` yields one typed template per check.
      for (const env of contextBindings(ep, obj)) {
        let types: string[] | null = null;
        const t = props.get('evidenceType');
        if (t) {
          const raw = t.values.flatMap((v) => patternValues(ep, v, 0, env));
          types = raw.some((r) => r.includes(SLOT)) ? null : [...new Set(raw.map((r) => r.replace(/\\(.)/g, '$1')))].sort();
        }
        for (const field of fields) {
          const p = props.get(field)!;
          for (const value of [...p.values, ...p.superseded]) {
            for (const pattern of patternValues(ep, value, 0, env)) {
              if (anchoredLength(pattern) >= MIN_ANCHOR[field]) out.push({ types, field, pattern });
            }
          }
        }
      }
    }
  }
  return out;
}

/** Historical journey wording: a stage's `finding`, bound to the stages and statuses it was written with. */
export interface JourneyTemplate {
  stages: string[];
  statuses: string[];
  pattern: string;
}
/** Historical finding wording: `title`, `problem` or `businessImpact`, bound to the categories it was written with. */
export interface OpportunityTemplate {
  categories: string[];
  field: 'title' | 'problem' | 'businessImpact';
  pattern: string;
}
export interface ObservationTemplates {
  journey: JourneyTemplate[];
  opportunity: OpportunityTemplate[];
  /** Every finding category the engine has written. */
  categories: string[];
  /** Phrases the collector and engine write as a probe's `note` (quoted inside evidence). */
  notes: string[];
}

/** Literal characters a journey or finding pattern needs before it counts as provenance. */
export const MIN_OBSERVATION_ANCHOR = 24;
const OPPORTUNITY_FIELDS = ['title', 'problem', 'businessImpact'] as const;
const OPP_WATCHED = new Set(['category', 'title', 'problem', 'businessImpact', 'recommendedSolution']);

/** Values an identifier property can hold under one environment, or null when any is not literal. */
function literalValues(ep: ReturnType<typeof createEngineProgram>, exprs: import('typescript').Expression[], env: Parameters<typeof patternValues>[3]): string[] | null {
  const raw = exprs.flatMap((v) => patternValues(ep, v, 0, env));
  if (raw.length === 0 || raw.some((r) => r.includes(SLOT))) return null;
  return [...new Set(raw.map((r) => r.replace(/\\(.)/g, '$1')))].sort();
}

/**
 * The journey and finding wording a set of engine files can produce. A
 * template is kept only when the identifiers it is bound to (stage and
 * status, or category) are literal; otherwise it establishes nothing.
 */
export function observationTemplatesFrom(files: Map<string, string>): ObservationTemplates {
  const ep = createEngineProgram(files);
  const journey: JourneyTemplate[] = [];
  const opportunity: OpportunityTemplate[] = [];
  const categories = new Set<string>();
  const notes: string[] = [];
  for (const [rel, sf] of ep.sources) {
    if (rel === COLLECTOR || rel === 'src/lib/audit/evidence.ts') {
      // Phrase builders: functions declared to return a string, whose returned
      // wording the evidence quotes ("Nothing in the form's own heading …").
      const visit = (n: ts.Node) => {
        if (ts.isFunctionDeclaration(n) && n.body && n.type && n.type.kind === ts.SyntaxKind.StringKeyword) {
          const returns: ts.Expression[] = [];
          const collect = (m: ts.Node) => {
            if (ts.isReturnStatement(m) && m.expression) returns.push(m.expression);
            if (!ts.isFunctionLike(m)) ts.forEachChild(m, collect);
          };
          ts.forEachChild(n.body, collect);
          for (const r of returns) for (const pattern of patternValues(ep, r)) if (anchoredLength(pattern) >= 24) notes.push(pattern);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    if (rel === COLLECTOR || rel.startsWith('src/lib/audit/')) {
      for (const obj of objectLiterals(sf)) {
        let props;
        try {
          props = effectiveProperties(ep, obj);
        } catch {
          continue;
        }
        const note = props.get('note');
        if (!note) continue;
        for (const env of contextBindings(ep, obj)) {
          for (const value of [...note.values, ...note.superseded]) {
            for (const pattern of patternValues(ep, value, 0, env)) if (anchoredLength(pattern) >= 8) notes.push(pattern);
          }
        }
      }
    }
    if (!rel.startsWith('src/lib/audit/')) continue;
    for (const obj of objectLiterals(sf)) {
      let props;
      try {
        props = effectiveProperties(ep, obj);
      } catch {
        continue;
      }
      if (props.has('finding') && props.has('stage') && props.has('status')) {
        for (const env of contextBindings(ep, obj)) {
          const stages = literalValues(ep, props.get('stage')!.values, env);
          const statuses = literalValues(ep, props.get('status')!.values, env);
          if (!stages || !statuses) continue;
          const f = props.get('finding')!;
          for (const value of [...f.values, ...f.superseded]) {
            for (const pattern of patternValues(ep, value, 0, env)) {
              if (anchoredLength(pattern) >= MIN_OBSERVATION_ANCHOR) journey.push({ stages, statuses, pattern });
            }
          }
        }
      }
      if (OPPORTUNITY_FIELDS.some((f) => props.has(f)) || props.has('recommendedSolution')) {
        let variants;
        try {
          variants = effectiveVariants(ep, obj, 0, OPP_WATCHED);
        } catch {
          continue;
        }
        for (const v of variants) {
          const cat = v.get('category');
          if (!cat) continue;
          for (const env of contextBindings(ep, obj)) {
            let cats: string[] | null;
            try {
              cats = [...new Set(cat.values.flatMap((e) => stringValues(ep, e)))].sort();
            } catch {
              cats = literalValues(ep, cat.values, env);
            }
            if (!cats) continue;
            for (const c of cats) categories.add(c);
            for (const field of OPPORTUNITY_FIELDS) {
              const p = v.get(field);
              if (!p) continue;
              for (const value of [...p.values, ...p.superseded]) {
                for (const pattern of patternValues(ep, value, 0, env)) {
                  if (anchoredLength(pattern) >= (field === 'title' ? 12 : MIN_OBSERVATION_ANCHOR)) opportunity.push({ categories: cats, field, pattern });
                }
              }
            }
          }
        }
      }
    }
  }
  return { journey, opportunity, categories: [...categories].sort(), notes };
}

const jKey = (t: JourneyTemplate) => `${t.stages.join(',')}|${t.statuses.join(',')}|${t.pattern}`;
const oKey = (t: OpportunityTemplate) => `${t.field}|${t.categories.join(',')}|${t.pattern}`;
export function dedupeObservations(o: ObservationTemplates): ObservationTemplates {
  return {
    journey: [...new Map(o.journey.map((t) => [jKey(t), t])).values()].sort((a, b) => jKey(a).localeCompare(jKey(b))),
    opportunity: [...new Map(o.opportunity.map((t) => [oKey(t), t])).values()].sort((a, b) => oKey(a).localeCompare(oKey(b))),
    categories: [...new Set(o.categories)].sort(),
    notes: [...new Set(o.notes)].sort(),
  };
}
export const observationKeys = { journey: jKey, opportunity: oKey };

const key = (t: EvidenceTemplate) => `${t.field}|${t.types?.join(',') ?? '*'}|${t.pattern}`;
export const dedupe = (ts: EvidenceTemplate[]) => [...new Map(ts.map((t) => [key(t), t])).values()];

/** The collector, whose failure notes the engine quotes in evidence. */
const COLLECTOR = 'src/lib/web/collector.ts';

/** Working-tree engine files, repo-relative. */
export function workingTreeFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const add = (rel: string) => files.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
  for (const f of fs.readdirSync(path.join(root, 'src/lib/audit'))) if (f.endsWith('.ts')) add(`src/lib/audit/${f}`);
  if (fs.existsSync(path.join(root, 'src/types/audit.ts'))) add('src/types/audit.ts');
  if (fs.existsSync(path.join(root, COLLECTOR))) add(COLLECTOR);
  return files;
}

function historicalFiles(repoRoot: string, commit: string): Map<string, string> {
  const files = new Map<string, string>();
  const list = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'rescue-agent/src/lib/audit', 'rescue-agent/src/types/audit.ts', `rescue-agent/${COLLECTOR}`], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.ts'));
  for (const f of list) {
    files.set(f.replace(/^rescue-agent\//, ''), execFileSync('git', ['show', `${commit}:${f}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  }
  return files;
}

/** Regenerates the committed files. Returns the number of evidence templates written. */
export function generateEvidenceTemplates(root: string): number {
  const repoRoot = path.resolve(root, '..');
  const commits = execFileSync('git', ['log', '--format=%H', '--', 'rescue-agent/src/lib/audit'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  const working = workingTreeFiles(root);
  let all = templatesFrom(working);
  const obs: ObservationTemplates = { journey: [], opportunity: [], categories: [], notes: [] };
  const addObs = (o: ObservationTemplates) => {
    obs.journey.push(...o.journey);
    obs.opportunity.push(...o.opportunity);
    obs.categories.push(...o.categories);
    obs.notes.push(...o.notes);
  };
  addObs(observationTemplatesFrom(working));
  for (const c of commits) {
    const files = historicalFiles(repoRoot, c);
    all = all.concat(templatesFrom(files));
    addObs(observationTemplatesFrom(files));
  }
  const templates = dedupe(all).sort((a, b) => key(a).localeCompare(key(b)));
  // The header names no commit count: it would change with every commit that
  // touches the engine while the templates themselves do not.
  const body =
    '/**\n * GENERATED by scripts/engine-source/generate-evidence-templates.ts — do not edit.\n *\n' +
    ' * Audited provenance patterns for evidence facts and supporting context: the\n' +
    ' * literal wording the audit engine writes (working tree and every historical\n' +
    ' * commit that touched src/lib/audit), with a slot wherever it interpolated a\n' +
    ' * value, bound to the evidenceType beside it.\n */\n' +
    "export interface EvidenceTemplate {\n  types: readonly string[] | null;\n  field: 'fact' | 'supportingContext';\n  pattern: string;\n}\n\n" +
    `export const EVIDENCE_TEMPLATES: readonly EvidenceTemplate[] = ${JSON.stringify(templates, null, 1)};\n`;
  const outFile = path.join(root, 'src/lib/reports/generated/evidenceTemplates.ts');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, body);
  const o = dedupeObservations(obs);
  const obsBody =
    '/**\n * GENERATED by scripts/engine-source/generate-evidence-templates.ts — do not edit.\n *\n' +
    ' * Historical journey and finding wording: every `finding` the audit engine has\n' +
    ' * written for a journey stage (bound to the stage and status written with it),\n' +
    ' * every finding `title`, `problem` and `businessImpact` (bound to its category),\n' +
    ' * every finding category, and the collector probe notes — from the working tree\n' +
    ' * and every historical commit that touched src/lib/audit. A slot marks an\n' +
    ' * interpolated value.\n */\n' +
    'export interface JourneyTemplate {\n  stages: readonly string[];\n  statuses: readonly string[];\n  pattern: string;\n}\n' +
    "export interface OpportunityTemplate {\n  categories: readonly string[];\n  field: 'title' | 'problem' | 'businessImpact';\n  pattern: string;\n}\n\n" +
    `export const ENGINE_FINDING_CATEGORIES: readonly string[] = ${JSON.stringify(o.categories, null, 1)};\n\n` +
    `/** Phrases the collector and engine write as a probe's note, quoted inside evidence (a slot marks a value). */\n` +
    `export const ENGINE_NOTE_TEMPLATES: readonly string[] = ${JSON.stringify(o.notes, null, 1)};\n\n` +
    `export const JOURNEY_TEMPLATES: readonly JourneyTemplate[] = ${JSON.stringify(o.journey, null, 1)};\n\n` +
    `export const OPPORTUNITY_TEMPLATES: readonly OpportunityTemplate[] = ${JSON.stringify(o.opportunity, null, 1)};\n`;
  fs.writeFileSync(path.join(root, 'src/lib/reports/generated/observationTemplates.ts'), obsBody);
  console.log(`${templates.length} evidence templates, ${o.journey.length} journey and ${o.opportunity.length} finding templates, ${o.categories.length} categories from the working tree and ${commits.length} commits`);
  return templates.length;
}
