-- Review request record (Milestone 7c).
--
-- The auditable trace §XIII requires: who was asked, when, through which
-- channel, and what came back. It also makes the compliance property checkable
-- after the fact — review gating is invisible in a code review but obvious in
-- data, because a table showing only some customers were ever asked is the
-- evidence of it.
--
-- SUPPRESSED rows are kept deliberately. A refusal that leaves no record is
-- indistinguishable from never having considered the customer at all, and the
-- reason is what makes the decision auditable.
--
-- The unique index on (tenantId, conversationId) enforces one request per
-- interaction at the database level, so a retry or duplicate webhook cannot ask
-- the same customer twice for the same visit.
--
-- ADDITIVE ONLY. One enum and one table; no column added to and nothing dropped
-- from any existing object.

CREATE TYPE "FdReviewRequestStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED');

CREATE TABLE "FdReviewRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" "FdReviewRequestStatus" NOT NULL DEFAULT 'PENDING',
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "destination" TEXT,
    "reviewLink" TEXT,
    "suppressedReason" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FdReviewRequest_tenantId_conversationId_key" ON "FdReviewRequest"("tenantId", "conversationId");
CREATE INDEX "FdReviewRequest_tenantId_status_idx" ON "FdReviewRequest"("tenantId", "status");
CREATE INDEX "FdReviewRequest_tenantId_createdAt_idx" ON "FdReviewRequest"("tenantId", "createdAt");

ALTER TABLE "FdReviewRequest" ADD CONSTRAINT "FdReviewRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FdReviewRequest" ADD CONSTRAINT "FdReviewRequest_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "FdConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
