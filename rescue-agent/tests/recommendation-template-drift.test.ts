/**
 * CURRENT-ENGINE RECOMMENDATION DRIFT — review of ca3be50 (Medium).
 *
 * The client report shows a finding's stored recommendation only when it is,
 * word for word, an audited engine string for its category
 * (recommendationTemplates.ts); anything else gets the category fallback. If
 * the engine's wording changed and the audited list did not, every new audit
 * would silently show the fallback — or, worse, an edit to the audited list
 * could accept wording nobody reviewed.
 *
 * This test reads the engine's source with the TypeScript compiler and
 * evaluates EVERY expression assigned to `recommendedSolution` (and the
 * `category` beside it) into the full set of strings it can produce: string
 * concatenation, both arms of every conditional, template substitutions and
 * `const` lookups (across leaks.ts and orderButtonFinding.ts), and
 * `.toLowerCase()`. An expression it cannot evaluate fails the test, so new
 * engine wording can never be accepted untested. Then every (category,
 * wording) pair the engine can produce must be audited, and must take the
 * audited path in presentFindingRecommendation — not the fallback.
 *
 * The same evaluation pins AUDITED_ENGINE_OBSERVATION_SENTENCES to sentences
 * the engine actually writes.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  AUDITED_ENGINE_OBSERVATION_SENTENCES,
  auditedSolutionsFor,
  presentFindingRecommendation,
} from '@/lib/reports/recommendationTemplates';
import { isExploratoryOpportunity, presentRecommendedSolution } from '@/lib/reports/automationWording';

const ROOT = path.join(__dirname, '..');
const FILES = ['src/lib/audit/leaks.ts', 'src/lib/audit/orderButtonFinding.ts'].map((rel) => ({
  rel,
  source: ts.createSourceFile(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true),
}));

const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
const where = (node: ts.Node) => {
  const file = node.getSourceFile();
  return `${file.fileName}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
};

class Unevaluable extends Error {}

/** Every `const name = …` initializer in the engine files. */
function declarationsOf(name: string): ts.Expression[] {
  const found: ts.Expression[] = [];
  for (const { source } of FILES) {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) found.push(node.initializer);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

const product = (a: string[], b: string[]) => a.flatMap((x) => b.map((y) => x + y));

/** Every string an expression can evaluate to. Throws on anything it cannot follow. */
function values(node: ts.Expression, depth = 0): string[] {
  if (depth > 20) throw new Unevaluable(`too deep at ${where(node)}`);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return values(node.expression, depth + 1);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return product(values(node.left, depth + 1), values(node.right, depth + 1));
  }
  if (ts.isConditionalExpression(node)) return [...values(node.whenTrue, depth + 1), ...values(node.whenFalse, depth + 1)];
  if (ts.isTemplateExpression(node)) {
    let out = [node.head.text];
    for (const span of node.templateSpans) out = product(product(out, values(span.expression, depth + 1)), [span.literal.text]);
    return out;
  }
  if (ts.isIdentifier(node)) {
    const decls = declarationsOf(node.text);
    if (decls.length === 0) throw new Unevaluable(`no const declaration for ${node.text} at ${where(node)}`);
    return [...new Set(decls.flatMap((d) => values(d, depth + 1)))];
  }
  if (
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'toLowerCase' && node.arguments.length === 0
  ) {
    return values(node.expression.expression, depth + 1).map((v) => v.toLowerCase());
  }
  throw new Unevaluable(`cannot evaluate ${ts.SyntaxKind[node.kind]} at ${where(node)}: ${node.getText().slice(0, 80)}`);
}

/** Every `prop: …` assignment in a file, with the object literal it sits in. */
function assignments(file: ts.SourceFile, prop: string): { node: ts.PropertyAssignment; owner: ts.ObjectLiteralExpression }[] {
  const out: { node: ts.PropertyAssignment; owner: ts.ObjectLiteralExpression }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === prop && ts.isObjectLiteralExpression(node.parent)) {
      out.push({ node, owner: node.parent });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

const leaks = FILES[0].source;
const orderButton = FILES[1].source;

/** The (category, recommendation) pairs the current engine can produce. */
function enginePairs(): { category: string; solution: string; at: string }[] {
  const pairs: { category: string; solution: string; at: string }[] = [];
  for (const { node, owner } of assignments(leaks, 'recommendedSolution')) {
    const categoryProp = owner.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'category');
    if (!categoryProp) throw new Unevaluable(`recommendedSolution without a category at ${where(node)}`);
    const categories = values(categoryProp.initializer);
    // The order-button finding delegates its wording to orderButtonFinding.ts.
    const solutions = ts.isPropertyAccessExpression(node.initializer) && node.initializer.getText() === 'copy.recommendedSolution'
      ? assignments(orderButton, 'recommendedSolution').flatMap((a) => values(a.node.initializer))
      : values(node.initializer);
    for (const category of categories) for (const solution of solutions) pairs.push({ category, solution, at: where(node) });
  }
  return pairs;
}

describe('every recommendation the current engine can write is audited', () => {
  const pairs = enginePairs();

  it('the engine source is fully evaluable, and covers every category', () => {
    const categories = [...new Set(pairs.map((p) => p.category))].sort();
    expect(categories).toEqual([
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
    // Every branch counted: two link categories, three order-button address
    // steps, two menu and two CTA variants, three catering subjects.
    expect(pairs).toHaveLength(2 + 3 + 1 + 1 + 2 + 2 + 3 + 1 + 1 + 1);
  });

  it('each (category, wording) pair is in the audited list for that category', () => {
    for (const { category, solution, at } of pairs) {
      expect(auditedSolutionsFor(category).map(ws), `${at} ${category}: ${solution.slice(0, 80)}`).toContain(ws(solution));
    }
  });

  it('each takes the audited path in the report, never the fallback', () => {
    for (const { category, solution, at } of pairs) {
      // A strong fit, so an automation category is judged as a pilot
      // candidate here; an exploratory one has its own fixed template.
      const opp = { category, aiFitScore: 95, recommendedSolution: solution };
      if (isExploratoryOpportunity(opp)) continue;
      expect(presentFindingRecommendation(opp), `${at} ${category}`).toBe(presentRecommendedSolution(category, solution));
    }
  });

  it('a wording change anywhere in the engine would fail: altering any one audited string takes the fallback', () => {
    for (const { category, solution } of pairs) {
      const altered = `${solution} Updated.`;
      expect(auditedSolutionsFor(category).map(ws)).not.toContain(ws(altered));
    }
  });

  it('an expression the evaluator cannot follow fails rather than being skipped', () => {
    const probe = ts.createSourceFile('probe.ts', 'const x = { category: "PHONE-DEPENDENT CUSTOMER JOURNEY", recommendedSolution: buildIt() };', ts.ScriptTarget.Latest, true);
    const [{ node }] = assignments(probe, 'recommendedSolution');
    expect(() => values(node.initializer)).toThrow(Unevaluable);
  });
});

describe('audited engine observation sentences are sentences the engine writes', () => {
  it('each appears in a businessImpact the current engine can produce', () => {
    const impacts = assignments(leaks, 'businessImpact').flatMap(({ node }) => {
      try {
        return values(node.initializer);
      } catch {
        return [];
      }
    });
    for (const sentence of AUDITED_ENGINE_OBSERVATION_SENTENCES) {
      expect(impacts.some((impact) => ws(impact).includes(ws(sentence))), sentence).toBe(true);
    }
  });
});
