/**
 * STATIC ANALYSIS OF THE AUDIT ENGINE'S OWN SOURCE.
 *
 * Two consumers:
 *   - tests/recommendation-template-drift.test.ts evaluates every
 *     recommendation the engine can write into exact strings, so unaudited
 *     wording fails CI;
 *   - scripts/engine-source/generate-evidence-templates.ts evaluates every
 *     evidence fact and supporting context the collectors can write into
 *     provenance patterns (literal text with typed slots), committed to
 *     src/lib/reports/generated/evidenceTemplates.ts.
 *
 * It builds a real TypeScript program over the engine files, so identifiers
 * are resolved through the type checker's symbols (imports followed to their
 * declaration), and only IMMUTABLE bindings are followed: a `const` with an
 * initializer. A `let`, a `var`, a parameter or anything else whose value
 * cannot be reliably determined is unresolvable — an error in strings mode, a
 * slot in pattern mode.
 *
 * Object literals are read for their EFFECTIVE properties, in source order:
 * plain, string-literal and computed keys (`['recommendedSolution']`),
 * shorthand properties, and spreads of resolvable object literals — the last
 * assignment wins, and every superseded value is still reported. A spread or
 * a key that cannot be resolved, but could supply a watched property, makes
 * the object unresolvable. Mutation of a watched property anywhere in the
 * scanned files (assignment, element assignment, delete, Object.assign,
 * Object.defineProperty, Reflect.set) is reported too.
 */
import ts from 'typescript';
import path from 'node:path';

export class Unresolvable extends Error {}

export interface EngineProgram {
  program: ts.Program;
  checker: ts.TypeChecker;
  /** The scanned files, by repo-relative path. */
  sources: Map<string, ts.SourceFile>;
}

const ROOT = '/repo';

/**
 * A program over in-memory file contents keyed by repo-relative path
 * ("src/lib/audit/leaks.ts"), so a historical commit can be analysed exactly
 * like the working tree. "@/x" resolves to "src/x".
 */
export function createEngineProgram(files: Map<string, string>, realRoot?: string): EngineProgram {
  if (realRoot) return createRealProgram(files, realRoot);
  const abs = (rel: string) => path.posix.join(ROOT, rel);
  const byAbs = new Map([...files].map(([rel, text]) => [abs(rel), text]));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: ROOT,
    paths: { '@/*': ['src/*'] },
    noLib: true,
    allowJs: false,
    strict: true,
  };
  const host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const text = byAbs.get(fileName);
      return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true);
    },
    getDefaultLibFileName: () => '/lib.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => ROOT,
    getDirectories: () => [],
    fileExists: (fileName) => byAbs.has(fileName),
    readFile: (fileName) => byAbs.get(fileName),
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
  const program = ts.createProgram([...byAbs.keys()], options, host);
  const sources = new Map<string, ts.SourceFile>();
  for (const [rel] of files) {
    const sf = program.getSourceFile(abs(rel));
    if (sf) sources.set(rel, sf);
  }
  return { program, checker: program.getTypeChecker(), sources };
}

/**
 * The working tree, with full type information: the real filesystem, the
 * project's path alias and the standard library, so a spread's type (and
 * whether it can carry a watched property) is known rather than assumed.
 */
function createRealProgram(files: Map<string, string>, root: string): EngineProgram {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: root,
    paths: { '@/*': ['src/*'] },
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    resolveJsonModule: true,
    esModuleInterop: true,
  };
  // The given contents win over the disk, so a scan reads exactly the text
  // it was handed (mutation tests edit files in memory); every other file —
  // imports, the standard library — comes from the filesystem.
  const given = new Map([...files].map(([rel, text]) => [path.resolve(root, rel), text]));
  const host = ts.createCompilerHost(options, true);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (f) => given.get(path.resolve(f)) ?? readFile(f);
  host.fileExists = (f) => given.has(path.resolve(f)) || fileExists(f);
  host.getSourceFile = (f, lang, onError, create) => {
    const text = given.get(path.resolve(f));
    return text !== undefined ? ts.createSourceFile(f, text, lang, true) : getSourceFile(f, lang, onError, create);
  };
  const program = ts.createProgram([...given.keys()], options, host);
  const sources = new Map<string, ts.SourceFile>();
  for (const [rel] of files) {
    const sf = program.getSourceFile(path.join(root, rel));
    if (sf) sources.set(rel, sf);
  }
  return { program, checker: program.getTypeChecker(), sources };
}

export const where = (node: ts.Node) => {
  const sf = node.getSourceFile();
  return `${sf.fileName.replace(`${ROOT}/`, '').replace(/^.*?\/(src\/)/, '$1')}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
};

// ── Symbols and immutable bindings ──────────────────────────────────────────

/** The declaration an identifier resolves to, following imports. */
function declarationOf(checker: ts.TypeChecker, id: ts.Identifier): ts.Declaration | undefined {
  let symbol = checker.getSymbolAtLocation(id);
  if (!symbol) return undefined;
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  // A shorthand property's own symbol is the property; its value symbol is the binding.
  if (ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id) {
    const valueSymbol = checker.getShorthandAssignmentValueSymbol(id.parent);
    if (valueSymbol) symbol = valueSymbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(valueSymbol) : valueSymbol;
  }
  return symbol.valueDeclaration ?? symbol.declarations?.[0];
}

/** The initializer of an immutable binding (`const x = …`), or undefined. */
export function constInitializer(checker: ts.TypeChecker, id: ts.Identifier): ts.Expression | undefined {
  const decl = declarationOf(checker, id);
  if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer || !ts.isIdentifier(decl.name)) return undefined;
  const list = decl.parent;
  if (!ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const)) return undefined;
  return decl.initializer;
}

/** The body's return expressions of a function an identifier names (declaration or const arrow/function). */
function returnExpressionsOf(checker: ts.TypeChecker, id: ts.Identifier): { fn: ts.SignatureDeclaration; returns: ts.Expression[] } | undefined {
  const decl = declarationOf(checker, id);
  let fn: ts.FunctionLikeDeclaration | undefined;
  if (decl && ts.isFunctionDeclaration(decl)) fn = decl;
  else if (decl && ts.isVariableDeclaration(decl) && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
    if (!(decl.parent.flags & ts.NodeFlags.Const)) return undefined;
    fn = decl.initializer;
  }
  if (!fn || !fn.body) return undefined;
  if (!ts.isBlock(fn.body)) return { fn, returns: [fn.body] };
  const returns: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node !== fn) return;
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return { fn, returns };
}

/** The return expressions of a function node. */
function functionReturns(fn: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (!fn.body) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const returns: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node !== fn) return;
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return returns;
}

/**
 * The functions a `for (const f of ARRAY)` variable ranges over, when ARRAY
 * is an immutable binding to an array literal of functions (inline or const
 * function bindings). Undefined otherwise.
 */
function functionsIteratedBy(ep: EngineProgram, id: ts.Identifier): ts.FunctionLikeDeclaration[] | undefined {
  const decl = declarationOf(ep.checker, id);
  if (!decl || !ts.isVariableDeclaration(decl)) return undefined;
  const list = decl.parent;
  if (!ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const) || !ts.isForOfStatement(list.parent)) return undefined;
  let iterable = strip(list.parent.expression);
  if (ts.isIdentifier(iterable)) {
    const init = constInitializer(ep.checker, iterable);
    if (!init) return undefined;
    iterable = strip(init);
  }
  if (!ts.isArrayLiteralExpression(iterable)) return undefined;
  const fns: ts.FunctionLikeDeclaration[] = [];
  for (const el of iterable.elements) {
    const x = strip(el as ts.Expression);
    if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) fns.push(x);
    else if (ts.isIdentifier(x)) {
      const d = declarationOf(ep.checker, x);
      if (d && ts.isFunctionDeclaration(d)) fns.push(d);
      else {
        const init = constInitializer(ep.checker, x);
        if (init && (ts.isArrowFunction(strip(init)) || ts.isFunctionExpression(strip(init)))) fns.push(strip(init) as ts.ArrowFunction);
        else return undefined;
      }
    } else return undefined;
  }
  return fns;
}

// ── Exact strings (drift) ───────────────────────────────────────────────────

const strip = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e) ? strip(e.expression) : e;

/**
 * Every string an expression can evaluate to, or Unresolvable. Follows string
 * literals, concatenation, conditionals (both arms), templates, immutable
 * bindings, `.toLowerCase()`, and property reads of resolvable objects.
 */
export function stringValues(ep: EngineProgram, node: ts.Expression, depth = 0): string[] {
  if (depth > 25) throw new Unresolvable(`too deep at ${where(node)}`);
  const e = strip(node);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = stringValues(ep, e.left, depth + 1);
    const r = stringValues(ep, e.right, depth + 1);
    return l.flatMap((a) => r.map((b) => a + b));
  }
  if (ts.isConditionalExpression(e)) return [...stringValues(ep, e.whenTrue, depth + 1), ...stringValues(ep, e.whenFalse, depth + 1)];
  if (ts.isTemplateExpression(e)) {
    let out = [e.head.text];
    for (const span of e.templateSpans) {
      const v = stringValues(ep, span.expression, depth + 1);
      out = out.flatMap((a) => v.map((b) => a + b + span.literal.text));
    }
    return out;
  }
  if (ts.isIdentifier(e)) {
    const init = constInitializer(ep.checker, e);
    if (!init) throw new Unresolvable(`${e.text} is not an immutable binding at ${where(e)}`);
    return [...new Set(stringValues(ep, init, depth + 1))];
  }
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'toLowerCase' && e.arguments.length === 0) {
    return stringValues(ep, e.expression.expression, depth + 1).map((v) => v.toLowerCase());
  }
  if (ts.isPropertyAccessExpression(e) || (ts.isElementAccessExpression(e) && e.argumentExpression)) {
    const prop = ts.isPropertyAccessExpression(e) ? e.name.text : stringValues(ep, (e as ts.ElementAccessExpression).argumentExpression, depth + 1);
    const names = Array.isArray(prop) ? prop : [prop];
    const objects = objectLiteralsOf(ep, e.expression, depth + 1);
    const out: string[] = [];
    for (const obj of objects) {
      const props = effectiveProperties(ep, obj, depth + 1);
      for (const name of names) {
        const p = props.get(name);
        if (!p) throw new Unresolvable(`${name} not found on the object at ${where(obj)}`);
        for (const v of p.values) out.push(...stringValues(ep, v, depth + 1));
      }
    }
    return [...new Set(out)];
  }
  throw new Unresolvable(`cannot evaluate ${ts.SyntaxKind[e.kind]} at ${where(e)}: ${e.getText().slice(0, 100)}`);
}

/**
 * The object literals an expression can evaluate to: a literal, a const
 * binding to one, both arms of a conditional, or the returned objects of a
 * local function (null/undefined returns are skipped).
 */
export function objectLiteralsOf(ep: EngineProgram, node: ts.Expression, depth = 0): ts.ObjectLiteralExpression[] {
  if (depth > 25) throw new Unresolvable(`too deep at ${where(node)}`);
  const e = strip(node);
  if (ts.isObjectLiteralExpression(e)) return [e];
  if (e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) return [];
  if (ts.isConditionalExpression(e)) return [...objectLiteralsOf(ep, e.whenTrue, depth + 1), ...objectLiteralsOf(ep, e.whenFalse, depth + 1)];
  if (ts.isIdentifier(e)) {
    const init = constInitializer(ep.checker, e);
    if (!init) throw new Unresolvable(`${e.text} is not an immutable binding at ${where(e)}`);
    return objectLiteralsOf(ep, init, depth + 1);
  }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const fn = returnExpressionsOf(ep.checker, e.expression);
    if (fn) return fn.returns.flatMap((r) => objectLiteralsOf(ep, r, depth + 1));
    // A call through the variable of `for (const f of FUNCTIONS)`, where
    // FUNCTIONS is an immutable array of functions: every function's returns.
    const fns = functionsIteratedBy(ep, e.expression);
    if (fns) return fns.flatMap((f) => functionReturns(f)).flatMap((r) => objectLiteralsOf(ep, r, depth + 1));
    throw new Unresolvable(`cannot follow the call ${e.expression.text} at ${where(e)}`);
  }
  throw new Unresolvable(`cannot resolve the object ${ts.SyntaxKind[e.kind]} at ${where(e)}: ${e.getText().slice(0, 100)}`);
}

export interface EffectiveProperty {
  /** The value that wins (the first of `values`). */
  value: ts.Expression;
  /**
   * Every value that can win: more than one when a spread can be one of
   * several objects (a rule's result is whichever rule produced it).
   */
  values: ts.Expression[];
  /** Earlier values for the same name, overridden in this object. */
  superseded: ts.Expression[];
}

/** The property names a scan cares about; a spread or key that could supply one must be resolvable. */
export const WATCHED_PROPERTIES = new Set(['recommendedSolution', 'category', 'fact', 'supportingContext', 'evidenceType', 'title', 'problem', 'businessImpact']);

function couldSupplyWatched(ep: EngineProgram, expr: ts.Expression, watched: ReadonlySet<string>): boolean {
  const type = ep.checker.getTypeAtLocation(expr);
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return true;
  return [...watched].some((p) => type.getProperty(p) !== undefined);
}

/** Whether an expression's type declares a property (an identity copy's source must). */
export function typeHasProperty(ep: EngineProgram, expr: ts.Expression, prop: string): boolean {
  return ep.checker.getTypeAtLocation(expr).getProperty(prop) !== undefined;
}

/**
 * An object literal's effective properties, in source order: the last
 * assignment to a name wins and earlier ones are kept as superseded.
 */
export function effectiveProperties(
  ep: EngineProgram,
  obj: ts.ObjectLiteralExpression,
  depth = 0,
  watched: ReadonlySet<string> = WATCHED_PROPERTIES,
): Map<string, EffectiveProperty> {
  const props = new Map<string, EffectiveProperty>();
  const set = (name: string, value: ts.Expression) => {
    const prev = props.get(name);
    props.set(name, { value, values: [value], superseded: prev ? [...prev.superseded, ...prev.values] : [] });
  };
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p)) {
      let names: string[];
      if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name)) names = [p.name.text];
      else if (ts.isComputedPropertyName(p.name)) {
        try {
          names = stringValues(ep, p.name.expression, depth + 1);
        } catch (err) {
          throw new Unresolvable(`computed property name cannot be determined at ${where(p)} (${(err as Error).message})`);
        }
        if (names.length !== 1) throw new Unresolvable(`computed property name has more than one possible value at ${where(p)}`);
      } else throw new Unresolvable(`unsupported property name at ${where(p)}`);
      for (const n of names) set(n, p.initializer);
    } else if (ts.isShorthandPropertyAssignment(p)) {
      set(p.name.text, p.name);
    } else if (ts.isSpreadAssignment(p)) {
      let spread: ts.ObjectLiteralExpression[] | null = null;
      try {
        spread = objectLiteralsOf(ep, p.expression, depth + 1);
      } catch {
        spread = null;
      }
      if (spread === null) {
        if (couldSupplyWatched(ep, p.expression, watched)) throw new Unresolvable(`spread that could override a watched property cannot be resolved at ${where(p)}`);
        continue;
      }
      // One or more possible objects: each property takes any value an
      // alternative supplies; where some alternative does not supply it, the
      // value before the spread can survive.
      const alternatives = spread.map((inner) => effectiveProperties(ep, inner, depth + 1, watched));
      const names = new Set(alternatives.flatMap((a) => [...a.keys()]));
      for (const name of names) {
        const prev = props.get(name);
        const values: ts.Expression[] = [];
        const superseded: ts.Expression[] = prev ? [...prev.superseded] : [];
        for (const a of alternatives) {
          const ip = a.get(name);
          if (ip) {
            values.push(...ip.values);
            superseded.push(...ip.superseded);
          } else if (prev) values.push(...prev.values);
        }
        if (prev && alternatives.every((a) => a.has(name))) superseded.push(...prev.values);
        const unique = [...new Set(values)];
        props.set(name, { value: unique[0], values: unique, superseded: [...new Set(superseded)] });
      }
    } else if ((ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p))) {
      const name = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
      if (name === null || watched.has(name)) throw new Unresolvable(`accessor or method for a watched property at ${where(p)}`);
    }
  }
  return props;
}

/**
 * An object literal's effective properties per VARIANT: one variant for each
 * combination of spread alternatives, so properties that come from the same
 * object stay together (a rule's category with that rule's wording, never
 * another rule's). Within a variant the last assignment wins; superseded
 * values are kept.
 */
export function effectiveVariants(
  ep: EngineProgram,
  obj: ts.ObjectLiteralExpression,
  depth = 0,
  watched: ReadonlySet<string> = WATCHED_PROPERTIES,
): Map<string, EffectiveProperty>[] {
  if (depth > 25) throw new Unresolvable(`too deep at ${where(obj)}`);
  let variants: Map<string, EffectiveProperty>[] = [new Map()];
  const setIn = (v: Map<string, EffectiveProperty>, name: string, value: ts.Expression, superseded: ts.Expression[] = []) => {
    const prev = v.get(name);
    v.set(name, { value, values: [value], superseded: [...(prev ? [...prev.superseded, ...prev.values] : []), ...superseded] });
  };
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p)) {
      let spread: ts.ObjectLiteralExpression[] | null = null;
      try {
        spread = objectLiteralsOf(ep, p.expression, depth + 1);
      } catch {
        spread = null;
      }
      if (spread === null) {
        if (couldSupplyWatched(ep, p.expression, watched)) throw new Unresolvable(`spread that could override a watched property cannot be resolved at ${where(p)}`);
        continue;
      }
      const inner = spread.flatMap((o) => effectiveVariants(ep, o, depth + 1, watched));
      const next: Map<string, EffectiveProperty>[] = [];
      for (const v of variants) for (const iv of inner.length > 0 ? inner : [new Map<string, EffectiveProperty>()]) {
        const merged = new Map(v);
        for (const [name, ip] of iv) setIn(merged, name, ip.value, ip.superseded);
        next.push(merged);
      }
      if (next.length > 500) throw new Unresolvable(`too many spread combinations at ${where(p)}`);
      variants = next;
      continue;
    }
    // A plain, computed or shorthand property: read it with the single-object rules.
    const single = effectiveProperties(ep, ts.factory.updateObjectLiteralExpression(obj, [p]) as ts.ObjectLiteralExpression, depth + 1, watched);
    for (const [name, ip] of single) for (const v of variants) setIn(v, name, ip.value);
  }
  return variants;
}

/** Every object literal in a file. */
export function objectLiterals(sf: ts.SourceFile): ts.ObjectLiteralExpression[] {
  const out: ts.ObjectLiteralExpression[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Constructors whose result cannot be read from source: the scan cannot determine what they build. */
const DYNAMIC_CONSTRUCTORS = new Set(['JSON.parse', 'Object.fromEntries', 'Object.create', 'Reflect.construct', 'structuredClone', 'eval', 'Function']);

/**
 * Ways to build a value that the effective-property scan cannot see, in a
 * file: a dynamic constructor (JSON.parse, Object.fromEntries, Object.create,
 * Reflect.construct, structuredClone, eval, Function); a class that declares
 * a watched member (field, parameter property, accessor or method); and a
 * constant string anywhere that spells a constructed property's name outside
 * the positions the scan already resolves (a computed key, an element access,
 * a type). Engine values are built with object literals; anything else fails
 * closed rather than being skipped.
 */
export function unsupportedConstructions(
  ep: EngineProgram,
  sf: ts.SourceFile,
  watched: ReadonlySet<string>,
  spelledNames: readonly string[] = ['recommendedSolution'],
): string[] {
  const found: string[] = [];
  const inType = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isTypeNode(p) || ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p)) return true;
      if (ts.isStatement(p) || ts.isExpression(p) && !ts.isStringLiteral(p) && !ts.isBinaryExpression(p) && !ts.isTemplateExpression(p) && !ts.isParenthesizedExpression(p)) return false;
    }
    return false;
  };
  const resolvedPosition = (n: ts.Node): boolean => {
    let top: ts.Node = n;
    while (top.parent && (ts.isBinaryExpression(top.parent) || ts.isParenthesizedExpression(top.parent))) top = top.parent;
    const p = top.parent;
    return Boolean(p && (ts.isComputedPropertyName(p) || (ts.isElementAccessExpression(p) && p.argumentExpression === top)));
  };
  const spells = (texts: string[]) => texts.some((t) => spelledNames.some((name) => t.includes(name)));
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const callee = n.expression.getText(sf).replace(/\s+/g, '').replace(/^globalThis\./, '');
      if (DYNAMIC_CONSTRUCTORS.has(callee)) found.push(`dynamic construction (${callee}) at ${where(n)}`);
    }
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) {
      for (const m of n.members) {
        const name = m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) || ts.isPrivateIdentifier(m.name)) ? m.name.text : undefined;
        if (name && watched.has(name)) found.push(`class member ${name} at ${where(m)}`);
        if (ts.isConstructorDeclaration(m)) {
          for (const p of m.parameters) {
            if (ts.isIdentifier(p.name) && watched.has(p.name.text) && ts.getModifiers(p)?.length) found.push(`class parameter property ${p.name.text} at ${where(p)}`);
          }
        }
      }
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !inType(n) && !resolvedPosition(n) && spells([n.text])) {
      found.push(`the property name is spelled as a value at ${where(n)}`);
    }
    if (
      (ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken)) &&
      !(n.parent && ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) &&
      !inType(n) && !resolvedPosition(n)
    ) {
      let texts: string[] = [];
      try {
        texts = patternValues(ep, n as ts.Expression).map((p) => p.replace(/\\(.)/g, '$1'));
      } catch {
        texts = [];
      }
      if (spells(texts)) found.push(`the property name is built as a value at ${where(n)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return [...new Set(found)];
}

/** Mutations of a watched property anywhere in a file: they make an object's final value undeterminable. */
export function watchedMutations(ep: EngineProgram, sf: ts.SourceFile, watched: ReadonlySet<string>): string[] {
  const found: string[] = [];
  const keyOf = (e: ts.Expression): string[] | null => {
    if (ts.isPropertyAccessExpression(e)) return [e.name.text];
    if (ts.isElementAccessExpression(e)) {
      try {
        return stringValues(ep, e.argumentExpression);
      } catch {
        return null;
      }
    }
    return [];
  };
  const touches = (target: ts.Expression) => {
    const keys = keyOf(strip(target));
    return keys === null ? ts.isElementAccessExpression(strip(target)) : keys.some((k) => watched.has(k));
  };
  const visit = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && touches(n.left)) {
      found.push(`assignment at ${where(n)}`);
    }
    if (ts.isDeleteExpression(n) && touches(n.expression)) found.push(`delete at ${where(n)}`);
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      if (/^(Object\.(assign|defineProperty|defineProperties|setPrototypeOf)|Reflect\.(set|defineProperty))$/.test(callee)) found.push(`${callee} at ${where(n)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

// ── Provenance patterns (evidence templates) ────────────────────────────────

/**
 * Parameters of a function being inlined, bound to the caller's argument
 * expressions (and the caller's own bindings), so `formatFact(channel)` is
 * read through to the object `channel` holds.
 */
export type Bindings = Map<ts.Declaration, { expr: ts.Expression; env: Bindings }>;
const NO_BINDINGS: Bindings = new Map();

function bindArguments(fn: ts.SignatureDeclaration, call: ts.CallExpression, env: Bindings): Bindings {
  const next: Bindings = new Map(env);
  fn.parameters.forEach((p, i) => {
    const arg = call.arguments[i];
    if (arg && ts.isIdentifier(p.name)) next.set(p, { expr: arg, env });
  });
  return next;
}

/** An identifier bound to a parameter of a function being inlined. */
function boundArgument(ep: EngineProgram, id: ts.Identifier, env: Bindings): { expr: ts.Expression; env: Bindings } | undefined {
  const decl = declarationOf(ep.checker, id);
  return decl ? env.get(decl) : undefined;
}

/** objectLiteralsOf, reading through parameters bound by inlining. */
function boundObjectLiterals(ep: EngineProgram, node: ts.Expression, env: Bindings, depth: number): ts.ObjectLiteralExpression[] {
  const e = strip(node);
  if (ts.isIdentifier(e)) {
    const bound = boundArgument(ep, e, env);
    if (bound) return boundObjectLiterals(ep, bound.expr, bound.env, depth + 1);
  }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const fn = returnExpressionsOf(ep.checker, e.expression);
    if (fn) {
      const inner = bindArguments(fn.fn, e, env);
      return fn.returns.flatMap((r) => boundObjectLiterals(ep, r, inner, depth + 1));
    }
  }
  if (ts.isConditionalExpression(e)) return [...boundObjectLiterals(ep, e.whenTrue, env, depth + 1), ...boundObjectLiterals(ep, e.whenFalse, env, depth + 1)];
  return objectLiteralsOf(ep, e, depth);
}

const MAX_LOOP_VARIANTS = 200;

/**
 * The bindings under which a node is evaluated once per iteration of each
 * enclosing `for (const x of ARRAY)`, where ARRAY is an immutable binding to
 * an array literal: one environment per combination of elements, so values
 * read from the loop variable stay correlated (`check.type` with
 * `check.label`). A loop over anything else contributes no binding (its
 * variable reads as a slot). Always at least one environment.
 */
export function loopBindings(ep: EngineProgram, node: ts.Node): Bindings[] {
  let envs: Bindings[] = [NO_BINDINGS];
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (!ts.isForOfStatement(p) || !ts.isVariableDeclarationList(p.initializer)) continue;
    if (!(p.initializer.flags & ts.NodeFlags.Const) || p.initializer.declarations.length !== 1) continue;
    const decl = p.initializer.declarations[0];
    if (!ts.isIdentifier(decl.name)) continue;
    let iterable = strip(p.expression);
    if (ts.isIdentifier(iterable)) {
      const init = constInitializer(ep.checker, iterable);
      if (!init) continue;
      iterable = strip(init);
    }
    if (!ts.isArrayLiteralExpression(iterable) || iterable.elements.some((el) => ts.isSpreadElement(el))) continue;
    const elements = iterable.elements as ts.NodeArray<ts.Expression>;
    const next: Bindings[] = [];
    for (const env of envs) {
      for (const el of elements) {
        const bound: Bindings = new Map(env);
        bound.set(decl, { expr: el, env: NO_BINDINGS });
        next.push(bound);
      }
    }
    if (next.length > MAX_LOOP_VARIANTS) return [NO_BINDINGS];
    envs = next;
  }
  return envs;
}

/** The function a node is written in, when it is a named function or a const binding to one. */
function enclosingFunction(node: ts.Node): { fn: ts.SignatureDeclaration; decl: ts.Declaration } | undefined {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return { fn: p, decl: p };
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && p.parent.initializer === p) {
      return { fn: p, decl: p.parent };
    }
    if (ts.isFunctionLike(p)) return undefined;
  }
  return undefined;
}

/**
 * loopBindings, plus — when the node is written inside a helper function
 * (`function stage(name, status, finding) { return { stage: name, … } }`) —
 * one environment per call site of that helper, binding its parameters to the
 * caller's arguments (and the caller's own loops). The helper's text is then
 * read as each call writes it, with the stage, status and wording correlated
 * per call. The unbound reading is kept as well.
 */
export function contextBindings(ep: EngineProgram, node: ts.Node): Bindings[] {
  const inner = loopBindings(ep, node);
  const f = enclosingFunction(node);
  if (!f) return inner;
  const calls: ts.CallExpression[] = [];
  for (const sf of ep.sources.values()) {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && declarationOf(ep.checker, n.expression) === f.decl) calls.push(n);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const out: Bindings[] = [...inner];
  for (const call of calls) {
    for (const outer of loopBindings(ep, call)) {
      const bound = bindArguments(f.fn, call, outer);
      for (const env of inner) {
        out.push(new Map([...bound, ...env]));
        if (out.length > MAX_LOOP_VARIANTS * 4) return out;
      }
    }
  }
  return out;
}

/** A slot: text the engine interpolated, checked when published. */
export const SLOT = '([^\\n]{0,600}?)';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MAX_ALTERNATIVES = 400;

/**
 * Every regex source an expression can produce: literal text escaped, an
 * unresolvable sub-expression as a slot. Never throws.
 */
export function patternValues(ep: EngineProgram, node: ts.Expression, depth = 0, env: Bindings = NO_BINDINGS): string[] {
  if (depth > 12) return [SLOT];
  const e = strip(node);
  const cap = (xs: string[]) => (xs.length > MAX_ALTERNATIVES ? [SLOT] : [...new Set(xs)]);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [escapeRe(e.text)];
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = patternValues(ep, e.left, depth + 1, env);
    const r = patternValues(ep, e.right, depth + 1, env);
    return cap(l.flatMap((a) => r.map((b) => a + b)));
  }
  if (ts.isConditionalExpression(e)) return cap([...patternValues(ep, e.whenTrue, depth + 1, env), ...patternValues(ep, e.whenFalse, depth + 1, env)]);
  if (ts.isTemplateExpression(e)) {
    let out = [escapeRe(e.head.text)];
    for (const span of e.templateSpans) {
      const v = patternValues(ep, span.expression, depth + 1, env);
      out = cap(out.flatMap((a) => v.map((b) => a + b + escapeRe(span.literal.text))));
    }
    return out;
  }
  if (ts.isIdentifier(e)) {
    const bound = boundArgument(ep, e, env);
    if (bound) return patternValues(ep, bound.expr, depth + 1, bound.env);
    const init = constInitializer(ep.checker, e);
    return init ? patternValues(ep, init, depth + 1, env) : [SLOT];
  }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const fn = returnExpressionsOf(ep.checker, e.expression);
    if (fn && fn.returns.length > 0) {
      const inner = bindArguments(fn.fn, e, env);
      return cap(fn.returns.flatMap((r) => patternValues(ep, r, depth + 1, inner)));
    }
  }
  // `[a, b].join(sep)` and `[a, b].filter(Boolean).join(sep)`: every
  // combination of the elements' values (empty ones dropped when filtered).
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'join' && e.arguments.length <= 1) {
    let list = strip(e.expression.expression);
    if (ts.isIdentifier(list)) {
      const init = constInitializer(ep.checker, list);
      if (init) list = strip(init);
    }
    let filtered = false;
    if (
      ts.isCallExpression(list) && ts.isPropertyAccessExpression(list.expression) && list.expression.name.text === 'filter' &&
      list.arguments.length === 1 && ts.isIdentifier(list.arguments[0]) && list.arguments[0].text === 'Boolean'
    ) {
      filtered = true;
      list = strip(list.expression.expression);
    }
    const sepNode = e.arguments[0];
    const sep = sepNode === undefined ? ',' : ts.isStringLiteral(sepNode) || ts.isNoSubstitutionTemplateLiteral(sepNode) ? sepNode.text : null;
    if (ts.isArrayLiteralExpression(list) && sep !== null && list.elements.every((el) => !ts.isSpreadElement(el))) {
      let combos: string[][] = [[]];
      for (const el of list.elements) {
        const values = patternValues(ep, el as ts.Expression, depth + 1, env);
        combos = combos.flatMap((c) => values.map((v) => (filtered && v === '' ? c : [...c, v])));
        if (combos.length > MAX_ALTERNATIVES) return [SLOT];
      }
      return cap(combos.map((c) => c.join(escapeRe(sep))));
    }
  }
  // A property read of an object the engine built: every value it can hold.
  if (ts.isPropertyAccessExpression(e)) {
    try {
      const objects = boundObjectLiterals(ep, e.expression, env, depth + 1);
      const values = objects.flatMap((o) => {
        const p = effectiveProperties(ep, o, depth + 1).get(e.name.text);
        return p ? [...p.values, ...p.superseded] : [];
      });
      if (values.length > 0) return cap(values.flatMap((v) => patternValues(ep, v, depth + 1, env)));
    } catch {
      /* not resolvable: a slot */
    }
  }
  return [SLOT];
}

/** Literal (non-slot) characters in a pattern — how much of it is anchored text. */
export function anchoredLength(pattern: string): number {
  return pattern.split(SLOT).join('').replace(/\\(.)/g, '$1').replace(/[()|?:]/g, '').length;
}
