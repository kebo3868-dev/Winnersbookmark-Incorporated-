import { z } from 'zod';

/** Keep the application's established validation messages during the Zod 4
 * migration. Schema-provided messages take precedence over this default map.
 * Parsing remains Zod 4, including its constrained-collection security fix.
 */
if ('config' in z) z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type': {
        if (issue.input === undefined) return 'Required';
        const received = issue.input === null ? 'null' : Array.isArray(issue.input) ? 'array' : typeof issue.input === 'number' && Number.isNaN(issue.input) ? 'nan' : typeof issue.input;
        if (issue.expected === 'int' && typeof issue.input === 'number') return 'Expected integer, received float';
        return `Expected ${issue.expected === 'record' ? 'object' : issue.expected}, received ${received}`;
      }
      case 'invalid_value': {
        const values = issue.values.map(v => typeof v === 'string' ? `'${v}'` : String(v));
        if (values.length === 1) return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
        if (issue.input === undefined) return 'Required';
        if (typeof issue.input !== 'string') {
          const received = issue.input === null ? 'null' : Array.isArray(issue.input) ? 'array' : typeof issue.input;
          return `Expected ${values.join(' | ')}, received ${received}`;
        }
        return `Invalid enum value. Expected ${values.join(' | ')}, received '${String(issue.input)}'`;
      }
      case 'invalid_format':
        return issue.format === 'regex' ? 'Invalid' : `Invalid ${issue.format}`;
      case 'too_small':
      case 'too_big': {
        const small = issue.code === 'too_small';
        const limit = small ? issue.minimum : issue.maximum;
        const direction = small ? 'least' : 'most';
        if (issue.origin === 'string') return `String must contain at ${direction} ${limit} character(s)`;
        if (issue.origin === 'array') return `Array must contain at ${direction} ${limit} element(s)`;
        if (issue.origin === 'number') return `Number must be ${small ? 'greater' : 'less'} than${issue.inclusive ? ' or equal to' : ''} ${limit}`;
        return undefined;
      }
      case 'unrecognized_keys':
        return `Unrecognized key(s) in object: ${issue.keys.map(k => `'${k}'`).join(', ')}`;
      case 'invalid_union': return 'Invalid input';
      case 'custom': return 'Invalid input';
      default: return undefined;
    }
  },
});

export { z };

/** Zod 3's default datetime accepted UTC minutes, seconds and fractional
 * seconds, but never fractional minutes or timezone offsets. Zod 4 requires
 * seconds by default. Validate both historical forms without changing data.
 */
export const historicalDatetime = () => z.string().refine(
  value => z.iso.datetime().safeParse(value).success || z.iso.datetime({ precision: -1 }).safeParse(value).success,
  'Invalid datetime',
);

/** Preserve Zod 3's integer domain and non-aborting error order, including
 * integer-valued JS numbers above MAX_SAFE_INTEGER. Each schema's existing
 * min/max limits remain. Zod 4's collection protections remain in force.
 */
export const integerSchema = () => z.number().refine(Number.isInteger, 'Expected integer, received float');

/** Keep the established type error on client surfaces when Zod 4 also runs
 * length checks on an input of the wrong type. The input still fails validation.
 */
export function validationIssues(error: { issues: z.core.$ZodIssue[] }) {
  const mismatches = new Set(error.issues.filter(i => i.code === 'invalid_type' && !['int', 'integer'].includes(i.expected)).map(i => JSON.stringify(i.path)));
  return error.issues.filter(i => i.code === 'invalid_type' || !mismatches.has(JSON.stringify(i.path)));
}
