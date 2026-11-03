import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
import * as migrated from '@/lib/frontdesk/config/schema';
import { validationIssues } from '@/lib/validation/zod';

// An explicitly supplied test-only Zod 3 installation is needed for the oracle.
// No legacy validator is included in the application dependency tree.
const require = createRequire(import.meta.url);
const oldZod = require(process.env.ZOD3_REFERENCE ?? '/tmp/wbi-zod-candidates/node_modules/zod3').z;
const original = execFileSync('git', ['show', '07198e3f3eb2b11a6e707c6ee8dcbb0795d24c01:rescue-agent/src/lib/frontdesk/config/schema.ts'], { encoding: 'utf8' });
const module = { exports: {} as Record<string, any> };
vm.runInNewContext(ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module, exports: module.exports, require: (name: string) => { if (name !== 'zod') throw new Error(name); return { z: oldZod }; }, Intl });
const normalize = (result: any) => result.success ? { success: true, data: result.data } : {
  success: false, issues: validationIssues(result.error).map((issue: any) => ({ path: issue.path, message: issue.message })),
};

it('compares defaults, acceptance, paths and exact messages against the original Zod 3 schemas', () => {
  const values: unknown[] = [undefined, null, true, false, [], {}, 0, -1, 1, 1.5, 2, 4, 100, 1e30,
    '', 'a', 'abc', 'x'.repeat(321), 'America/New_York', 'Not/AZone', '23:59', '25:00',
    '2026-11-03', '2026-11-03T12:00Z', '2026-11-03T12:00:00Z', '2026-11-03T12:00:00.123Z',
    '2026-11-03T12:00.123Z', '2026-11-03T12:00:00.Z', '2026-02-30T12:00Z', '2026-11-03T25:00Z',
    '2026-11-03T12:00:00+01:00',
    'a@example.com', "a'b@example.com", 'a..b@example.com', 'a@b.c', 'https://example.com',
    'mailto:a@example.com', 'SMS', 'EMAIL', 'WARM_PROFESSIONAL', ['STOP'], { restaurantName: 'A' }];
  let comparisons = 0;
  const differences: unknown[] = [];
  function check(label: string, before: any, after: any) {
    for (const input of values) {
      const a = normalize(before.safeParse(input));
      const b = normalize(after.safeParse(input));
      comparisons++;
      if (JSON.stringify(a) !== JSON.stringify(b)) differences.push({ label, input, before: a, after: b });
    }
  }
  for (const [name, before] of Object.entries(module.exports)) {
    const after = (migrated as Record<string, any>)[name];
    if (typeof before?.safeParse !== 'function') continue;
    check(name, before, after);
    if (before.shape) for (const field of Object.keys(before.shape)) check(`${name}.${field}`, before.shape[field], after.shape[field]);
  }
  fs.writeFileSync(`../reports/dependency-remediation/${process.env.REPORT_PHASE ?? 'after'}/zod-compatibility.json`, JSON.stringify({ comparisons, differences }, null, 2) + '\n');
  expect(differences).toEqual([]);
});
