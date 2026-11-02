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
import fs from 'node:fs';
import path from 'node:path';
import { SLOT, anchoredLength, createEngineProgram, effectiveProperties, loopBindings, objectLiterals, patternValues } from './engineSource';

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
      for (const env of loopBindings(ep, obj)) {
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

const key = (t: EvidenceTemplate) => `${t.field}|${t.types?.join(',') ?? '*'}|${t.pattern}`;
export const dedupe = (ts: EvidenceTemplate[]) => [...new Map(ts.map((t) => [key(t), t])).values()];

/** Working-tree engine files, repo-relative. */
export function workingTreeFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const add = (rel: string) => files.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
  for (const f of fs.readdirSync(path.join(root, 'src/lib/audit'))) if (f.endsWith('.ts')) add(`src/lib/audit/${f}`);
  if (fs.existsSync(path.join(root, 'src/types/audit.ts'))) add('src/types/audit.ts');
  return files;
}

function historicalFiles(repoRoot: string, commit: string): Map<string, string> {
  const files = new Map<string, string>();
  const list = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'rescue-agent/src/lib/audit', 'rescue-agent/src/types/audit.ts'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.ts'));
  for (const f of list) {
    files.set(f.replace(/^rescue-agent\//, ''), execFileSync('git', ['show', `${commit}:${f}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  }
  return files;
}

/** Regenerates the committed file. Returns the number of templates written. */
export function generateEvidenceTemplates(root: string): number {
  const repoRoot = path.resolve(root, '..');
  const commits = execFileSync('git', ['log', '--format=%H', '--', 'rescue-agent/src/lib/audit'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  let all = templatesFrom(workingTreeFiles(root));
  for (const c of commits) all = all.concat(templatesFrom(historicalFiles(repoRoot, c)));
  const templates = dedupe(all).sort((a, b) => key(a).localeCompare(key(b)));
  const body =
    '/**\n * GENERATED by scripts/engine-source/generate-evidence-templates.ts — do not edit.\n *\n' +
    ' * Audited provenance patterns for evidence facts and supporting context: the\n' +
    ' * literal wording the audit engine writes (working tree and every historical\n' +
    ` * commit that touched src/lib/audit — ${commits.length} commits), with a slot\n` +
    ' * wherever it interpolated a value, bound to the evidenceType beside it.\n */\n' +
    "export interface EvidenceTemplate {\n  types: readonly string[] | null;\n  field: 'fact' | 'supportingContext';\n  pattern: string;\n}\n\n" +
    `export const EVIDENCE_TEMPLATES: readonly EvidenceTemplate[] = ${JSON.stringify(templates, null, 1)};\n`;
  const outFile = path.join(root, 'src/lib/reports/generated/evidenceTemplates.ts');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, body);
  console.log(`${templates.length} templates from the working tree and ${commits.length} commits → ${path.relative(root, outFile)}`);
  return templates.length;
}
