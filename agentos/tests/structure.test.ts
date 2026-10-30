import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guarantees, checked over the source tree so a new file cannot
 * silently opt out of them.
 */
const SRC = path.resolve(__dirname, '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC);
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');
const read = (f: string) => readFileSync(f, 'utf8');

const PUBLIC_ROUTES = new Set(['app/api/health/route.ts', 'app/api/auth/login/route.ts']);
const PUBLIC_PAGES = new Set(['app/login/page.tsx']);

describe('every surface authorizes itself', () => {
  const routes = files.filter((f) => rel(f).startsWith('app/api/') && f.endsWith('route.ts'));
  const pages = files.filter((f) => rel(f).startsWith('app/') && f.endsWith('page.tsx'));

  it('finds the surfaces it is guarding', () => {
    expect(routes.length).toBeGreaterThanOrEqual(7);
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  it.each(routes.filter((f) => !PUBLIC_ROUTES.has(rel(f))).map(rel))('%s calls requireOwnerRequest', (file) => {
    expect(read(path.join(SRC, file))).toMatch(/requireOwnerRequest\(request, \{ mutating: (true|false) \}\)/);
  });

  it.each(pages.filter((f) => !PUBLIC_PAGES.has(rel(f))).map(rel))('%s calls requireOwnerPage', (file) => {
    expect(read(path.join(SRC, file))).toContain('await requireOwnerPage()');
  });

  it('every POST route that is not sign-in requires a same-origin request', () => {
    for (const file of routes.filter((f) => !PUBLIC_ROUTES.has(rel(f)))) {
      const source = read(file);
      if (source.includes('export async function POST')) expect(source, rel(file)).toContain('mutating: true');
    }
  });

  it('the public routes are exactly the ones the proxy exempts', () => {
    const proxy = read(path.join(SRC, 'proxy.ts'));
    expect(proxy).toContain("new Set(['/login', '/api/auth/login', '/api/health'])");
  });
});

describe('secrets stay on the server', () => {
  const clientFiles = files.filter((f) => /^\s*['"]use client['"]/.test(read(f)));

  it('finds the client components', () => {
    expect(clientFiles.length).toBeGreaterThanOrEqual(5);
  });

  it.each(clientFiles.map(rel))('%s imports no server module and reads no env', (file) => {
    const source = read(path.join(SRC, file));
    expect(source).not.toMatch(/from ['"]@\/lib\/(providers|store|config|auth\/session)/);
    expect(source).not.toContain('process.env');
  });

  it('provider and store modules are marked server-only', () => {
    expect(read(path.join(SRC, 'lib/providers/index.ts'))).toContain("import 'server-only'");
    expect(read(path.join(SRC, 'lib/store/index.ts'))).toContain("import 'server-only'");
  });

  it('no NEXT_PUBLIC_ variable carries a key, secret or database URL', () => {
    for (const file of files) {
      expect(read(file), rel(file)).not.toMatch(/NEXT_PUBLIC_\w*(KEY|SECRET|TOKEN|PASSWORD|DATABASE)/);
    }
  });

  it('agent output is rendered as text, never as HTML', () => {
    for (const file of files) expect(read(file), rel(file)).not.toContain('dangerouslySetInnerHTML');
  });
});
