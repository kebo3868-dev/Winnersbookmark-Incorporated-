import { prisma } from '@/lib/db';

/**
 * How long a RUNNING audit may go without a job-stage update before we treat
 * the worker as dead. Generous relative to the slowest single stage (page
 * collection updates the job between stages).
 */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export const STALE_FAILURE_REASON =
  'AUDIT DID NOT COMPLETE: the analysis process was interrupted (this can happen on serverless hosts when a run exceeds the platform time limit). ' +
  'Evidence collected before the interruption has been preserved. Re-run the audit to try again.';

/**
 * Mark audits stuck in PENDING/RUNNING with no recent progress as FAILED.
 * Called lazily from read paths — on serverless hosting there is no daemon to
 * run sweeps, so honesty is enforced at the moment anyone looks.
 */
export async function failStaleAudits(auditId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const staleJobs = await prisma.auditJob.findMany({
    where: {
      ...(auditId ? { auditId } : {}),
      status: { in: ['PENDING', 'RUNNING'] },
      updatedAt: { lt: cutoff },
    },
    select: { auditId: true },
  });
  for (const job of staleJobs) {
    await prisma.audit.update({
      where: { id: job.auditId },
      data: { status: 'FAILED', failureReason: STALE_FAILURE_REASON, completedAt: new Date() },
    });
    await prisma.auditJob.update({
      where: { auditId: job.auditId },
      data: { status: 'FAILED', currentStage: 'FAILED', errorMessage: STALE_FAILURE_REASON },
    });
  }
  return staleJobs.length;
}
