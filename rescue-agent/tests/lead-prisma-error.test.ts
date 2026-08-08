import { describe, expect, it } from 'vitest';
import { isRecordNotFound, PRISMA_RECORD_NOT_FOUND } from '@/lib/leads/prismaError';

/**
 * The erasure endpoint answers 404 only for a genuine missing row. Everything
 * else must surface as a 5xx: reporting "LEAD NOT FOUND" after a database
 * outage would tell the operator personal data was erased when it still exists.
 */
describe('isRecordNotFound', () => {
  it('recognises Prisma record-not-found', () => {
    expect(PRISMA_RECORD_NOT_FOUND).toBe('P2025');
    expect(isRecordNotFound({ code: 'P2025' })).toBe(true);
    expect(isRecordNotFound(Object.assign(new Error('not found'), { code: 'P2025' }))).toBe(true);
  });

  it('does NOT treat operational faults as a missing record', () => {
    // These are the cases that previously produced a misleading 404.
    expect(isRecordNotFound({ code: 'P1001' })).toBe(false); // cannot reach database
    expect(isRecordNotFound({ code: 'P1002' })).toBe(false); // database timed out
    expect(isRecordNotFound({ code: 'P2024' })).toBe(false); // connection pool exhausted
    expect(isRecordNotFound(new Error('ECONNRESET'))).toBe(false);
    expect(isRecordNotFound('P2025')).toBe(false); // a bare string is not a Prisma error
    expect(isRecordNotFound(null)).toBe(false);
    expect(isRecordNotFound(undefined)).toBe(false);
    expect(isRecordNotFound({})).toBe(false);
  });
});
