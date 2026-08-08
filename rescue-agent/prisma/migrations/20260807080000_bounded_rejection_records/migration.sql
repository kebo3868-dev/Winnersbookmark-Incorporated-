-- Bounded rejection records.
--
-- Rejected unauthenticated requests previously wrote one FdFailure row each,
-- which let anyone on the internet grow the table without limit and bury real
-- entries in the queue operators are required to review daily.
--
-- Rejections now upsert on a coalescing key (scope|operation|reason|hour) and
-- increment `attempts`, so the operator still sees that something is being
-- rejected and how often, at a cost of one row per hour rather than one row
-- per request.
--
-- NULL for ordinary failures. Postgres treats NULLs as distinct in a unique
-- index, so existing rows and all non-rejection failures are unaffected.

ALTER TABLE "FdFailure" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "FdFailure_dedupeKey_key" ON "FdFailure"("dedupeKey");
