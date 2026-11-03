// Inventory the actual packaged Node modules, then audit those exact versions.
// The synthetic lock describes physical files, not the source package manifest.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

// Runtime images do not need a package manager. Export their physical
// inventory, then audit it with the verification host's npm process instead.
const imported = process.env.RUNTIME_AUDIT_IMPORT === '1' ? JSON.parse(fs.readFileSync(0, 'utf8')) : null;
const root = imported?.root ?? path.resolve(process.argv[2] ?? '/app');
const packages = imported?.packages ?? {};
function modules(directory, relative = 'node_modules') {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      for (const scoped of fs.readdirSync(path.join(directory, entry.name)))
        add(path.join(directory, entry.name, scoped), `${relative}/${entry.name}/${scoped}`);
    } else add(path.join(directory, entry.name), `${relative}/${entry.name}`);
  }
}
function add(directory, relative) {
  const file = path.join(directory, 'package.json');
  if (!fs.existsSync(file)) return;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (pkg.name && pkg.version) {
    packages[relative] = { name: pkg.name, version: pkg.version,
      ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
      ...(pkg.optionalDependencies ? { optionalDependencies: pkg.optionalDependencies } : {}) };
  }
  modules(path.join(directory, 'node_modules'), `${relative}/node_modules`);
}
if (!imported) modules(path.join(root, 'node_modules'));
if (!Object.keys(packages).length) throw new Error(`No installed packages under ${root}`);
const dependencies = Object.fromEntries(Object.entries(packages).filter(([key]) => !key.slice('node_modules/'.length).includes('/node_modules/')).map(([, value]) => [value.name, value.version]));
const manifest = { name: 'wbi-packaged-runtime-audit', version: '1.0.0', private: true, dependencies };
console.error(JSON.stringify({ root, physicalPackages: Object.keys(packages).length,
  inventory: Object.fromEntries(Object.entries(packages).map(([key, value]) => [key, value.version])) }, null, 2));
if (process.env.RUNTIME_AUDIT_EXPORT === '1') {
  process.stdout.write(JSON.stringify({ root, packages }) + '\n');
} else {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wbi-runtime-audit-'));
  fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(temporary, 'package-lock.json'), JSON.stringify({ ...manifest, lockfileVersion: 3,
    packages: { '': manifest, ...packages } }));
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json', '--cache', path.join(temporary, 'cache')], {
    cwd: temporary, encoding: 'utf8', env: process.env,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
