/**
 * Prisma's "record not found" code, raised by update/delete when the `where`
 * matches nothing.
 *
 * Distinguishing it matters on the erasure path: catching every error and
 * answering 404 tells the operator the personal record is absent when the truth
 * may be that the database was unreachable and the record still exists. For a
 * GDPR erasure endpoint that is the difference between "it is gone" and "we
 * could not tell" — so anything that is not P2025 must surface as a 5xx.
 */
export const PRISMA_RECORD_NOT_FOUND = 'P2025';

/** True only for Prisma's record-not-found error, never for operational faults. */
export function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === PRISMA_RECORD_NOT_FOUND
  );
}
