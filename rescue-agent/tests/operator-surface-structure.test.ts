/**
 * EVERY OPERATOR SURFACE AUTHORIZES ITSELF — enforced on the source.
 *
 * The middleware was the only thing standing between the internet and the
 * Command Center, every audit, the Sales Brief and the leads list (#72). Each
 * of those now checks the operator credential itself, and this test fails the
 * build when one does not: a page or route added anywhere outside the Front
 * Desk area (which has its own equivalent test) must either be on the short
 * public-by-design list below, with a reason, or start with the guard.
 *
 * "Start with" is checked on the syntax tree, not by searching the text. A
 * substring check passes for a guard that is only mentioned in a comment, or
 * called after the data has already been read; this one does not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'src/app');

/** Reachable without the operator credential on purpose, each with its own authentication. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'src/app/api/health/route.ts': 'Liveness for the orchestrator; configuration detail only with the operator credential.',
  'src/app/api/marketing/leads/route.ts': 'Server-to-server ingest; constant-time shared secret, fails closed without one.',
  'src/app/api/retention/sweep/route.ts': 'Scheduled PII sweep; scheduler secret, fails closed without one.',
};

/** Covered by tests/frontdesk-isolation-guard.test.ts ("every front desk surface authorizes itself"). */
const FRONT_DESK = /^src\/app\/(frontdesk|api\/frontdesk)\//;

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/^(page|route)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const callee = (node: ts.Node): string | null => {
  let expr = node;
  if (ts.isAwaitExpression(expr)) expr = expr.expression;
  return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) ? expr.expression.text : null;
};

/** `await requireOperatorPage();` or `const x = await requireOperatorPage();` */
function isPageGuard(statement: ts.Statement | undefined): boolean {
  if (!statement) return false;
  if (ts.isExpressionStatement(statement)) {
    return ts.isAwaitExpression(statement.expression) && callee(statement.expression) === 'requireOperatorPage';
  }
  if (ts.isVariableStatement(statement)) {
    const [decl] = statement.declarationList.declarations;
    return Boolean(decl?.initializer && ts.isAwaitExpression(decl.initializer) && callee(decl.initializer) === 'requireOperatorPage');
  }
  return false;
}

/** `const g = requireOperatorRequest(req);` then `if (!g.ok) return g.response;` */
function isRouteGuard(first: ts.Statement | undefined, second: ts.Statement | undefined, requestParam: string | null): boolean {
  if (!first || !second || !requestParam || !ts.isVariableStatement(first)) return false;
  const [decl] = first.declarationList.declarations;
  if (!decl || !ts.isIdentifier(decl.name) || !decl.initializer || !ts.isCallExpression(decl.initializer)) return false;
  const call = decl.initializer;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'requireOperatorRequest') return false;
  const [arg] = call.arguments;
  if (!arg || !ts.isIdentifier(arg) || arg.text !== requestParam) return false;
  const name = decl.name.text;
  if (!ts.isIfStatement(second)) return false;
  const cond = second.expression;
  const negatedOk =
    ts.isPrefixUnaryExpression(cond) &&
    cond.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isPropertyAccessExpression(cond.operand) &&
    ts.isIdentifier(cond.operand.expression) &&
    cond.operand.expression.text === name &&
    cond.operand.name.text === 'ok';
  const then = ts.isBlock(second.thenStatement) ? second.thenStatement.statements[0] : second.thenStatement;
  const returnsResponse =
    Boolean(then) &&
    ts.isReturnStatement(then!) &&
    Boolean(then!.expression) &&
    ts.isPropertyAccessExpression(then!.expression!) &&
    ts.isIdentifier((then!.expression as ts.PropertyAccessExpression).expression) &&
    ((then!.expression as ts.PropertyAccessExpression).expression as ts.Identifier).text === name &&
    (then!.expression as ts.PropertyAccessExpression).name.text === 'response';
  return negatedOk && returnsResponse;
}

const hasExport = (node: ts.Node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const hasDefault = (node: ts.Node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

/** Violations in one page or route source. Empty when the surface guards itself. */
export function surfaceViolations(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const problems: string[] = [];
  const isPage = /page\.tsx?$/.test(fileName);

  const directive = file.statements[0];
  if (directive && ts.isExpressionStatement(directive) && ts.isStringLiteral(directive.expression) && directive.expression.text === 'use client') {
    problems.push('client component page: it cannot check the credential on the server');
    return problems;
  }

  if (isPage) {
    const page = file.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && hasExport(s) && hasDefault(s));
    if (!page?.body) return ['no `export default function` page component to check'];
    if (!isPageGuard(page.body.statements[0])) problems.push(`${page.name?.text ?? 'default'}: first statement is not \`await requireOperatorPage()\``);
    return problems;
  }

  let handlers = 0;
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && hasExport(statement) && statement.name && HTTP_METHODS.has(statement.name.text)) {
      handlers++;
      const param = statement.parameters[0];
      const requestParam = param && ts.isIdentifier(param.name) ? param.name.text : null;
      const body = statement.body?.statements ?? ts.factory.createNodeArray<ts.Statement>();
      if (!isRouteGuard(body[0], body[1], requestParam)) {
        problems.push(`${statement.name.text}: does not open with \`requireOperatorRequest(request)\` and an early return`);
      }
    }
    if (ts.isVariableStatement(statement) && hasExport(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && HTTP_METHODS.has(decl.name.text)) {
          problems.push(`${decl.name.text}: exported as a variable; declare it as a function so the guard can be checked`);
        }
      }
    }
  }
  if (handlers === 0 && problems.length === 0) problems.push('no exported HTTP handler found');
  return problems;
}

const surfaces = walk(APP)
  .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter((rel) => !FRONT_DESK.test(rel) && !(rel in PUBLIC_BY_DESIGN))
  .sort();

describe('every operator page and route checks the operator credential first', () => {
  it('finds the operator surfaces it claims to check (the check is not vacuous)', () => {
    expect(surfaces).toEqual(
      expect.arrayContaining([
        'src/app/page.tsx',
        'src/app/audits/page.tsx',
        'src/app/audits/new/page.tsx',
        'src/app/audits/[auditId]/page.tsx',
        'src/app/audits/[auditId]/report/page.tsx',
        'src/app/audits/[auditId]/sales/page.tsx',
        'src/app/leads/page.tsx',
        'src/app/api/audits/route.ts',
        'src/app/api/audits/[auditId]/report/pdf/route.ts',
        'src/app/api/audits/[auditId]/status/route.ts',
        'src/app/api/audits/demo/route.ts',
        'src/app/api/demo/purge/route.ts',
        'src/app/api/leads/[leadId]/route.ts',
      ]),
    );
  });

  it.each(surfaces)('%s', (rel) => {
    expect(surfaceViolations(rel, readFileSync(path.join(ROOT, rel), 'utf8'))).toEqual([]);
  });

  it('the public-by-design list names only files that exist', () => {
    const all = walk(APP).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    for (const rel of Object.keys(PUBLIC_BY_DESIGN)) expect(all).toContain(rel);
  });
});

describe('the structural check catches what it should', () => {
  const page = (body: string) => `export default async function P() {\n${body}\n}`;
  const route = (body: string) => `export async function GET(request: Request) {\n${body}\n}`;

  it('accepts a page that opens with the guard', () => {
    expect(surfaceViolations('page.tsx', page('const operator = await requireOperatorPage();\nreturn null;'))).toEqual([]);
    expect(surfaceViolations('page.tsx', page('await requireOperatorPage();\nreturn null;'))).toEqual([]);
  });

  it('refuses a page that reads data before the guard, or only mentions it', () => {
    expect(surfaceViolations('page.tsx', page('const a = await prisma.audit.findMany();\nawait requireOperatorPage();'))).not.toEqual([]);
    expect(surfaceViolations('page.tsx', page('// requireOperatorPage()\nreturn null;'))).not.toEqual([]);
    expect(surfaceViolations('page.tsx', page('requireOperatorPage();\nreturn null;'))).not.toEqual([]); // not awaited
  });

  it('refuses a client component page', () => {
    expect(surfaceViolations('page.tsx', `'use client';\n${page('return null;')}`)).not.toEqual([]);
  });

  it('accepts a route that opens with the guard and returns early', () => {
    expect(
      surfaceViolations('route.ts', route('const guard = requireOperatorRequest(request);\nif (!guard.ok) return guard.response;\nreturn new Response();')),
    ).toEqual([]);
  });

  it('refuses a route without the early return, with the guard second, or guarding another request', () => {
    expect(surfaceViolations('route.ts', route('const guard = requireOperatorRequest(request);\nreturn new Response();'))).not.toEqual([]);
    expect(
      surfaceViolations('route.ts', route('const x = await db();\nconst guard = requireOperatorRequest(request);\nif (!guard.ok) return guard.response;')),
    ).not.toEqual([]);
    expect(
      surfaceViolations('route.ts', route('const guard = requireOperatorRequest(other);\nif (!guard.ok) return guard.response;')),
    ).not.toEqual([]);
    expect(surfaceViolations('route.ts', 'export async function POST() {\nreturn new Response();\n}')).not.toEqual([]);
    expect(surfaceViolations('route.ts', 'export const GET = async () => new Response();')).not.toEqual([]);
  });
});

describe('the Sales Brief is read only behind the operator check', () => {
  /** Writers produce briefs; the loader and the guarded Command Center are the only readers. */
  const ALLOWED = new Set([
    'src/lib/audit/orchestrator.ts', // writes the brief when an audit completes
    'src/lib/audit/demo.ts', // writes demonstration briefs
    'src/lib/reports/salesData.ts', // the reader; requires an OperatorAuthorization
    'src/app/page.tsx', // Command Center priority badge; guarded page
  ]);

  it('no other module touches the salesIntelligence table', () => {
    const files = walk(path.join(ROOT, 'src')).concat(
      readdirSync(path.join(ROOT, 'src'), { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile() && /\.tsx?$/.test(d.name))
        .map((d) => path.join(d.parentPath ?? (d as unknown as { path: string }).path, d.name)),
    );
    const offenders = [...new Set(files)]
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => /salesIntelligence/.test(readFileSync(path.join(ROOT, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
