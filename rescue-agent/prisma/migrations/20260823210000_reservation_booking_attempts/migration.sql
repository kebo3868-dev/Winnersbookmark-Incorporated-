-- Reservation booking lifecycle (Milestone 7a).
--
-- One row per booking ATTEMPT, not per booking. The dangerous moment is a
-- worker dying between "the vendor accepted" and "we wrote it down", and only a
-- durable per-attempt record makes that recoverable without seating the party
-- twice. "idempotencyKey" is UNIQUE and is forwarded to the vendor, so a retry
-- updates the existing row instead of creating a second reservation.
--
-- CONFIRMED is reachable only with a vendor confirmation reference. That is §V
-- expressed in the data: a booking nobody can produce a reference for is not a
-- booking, and the lead stays REQUESTED.
--
-- ADDITIVE ONLY. Creates one enum and one table, adds no column to and drops
-- nothing from any existing object, so it cannot disturb the V1 baseline.

CREATE TYPE "FdBookingStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED_PENDING', 'CONFIRMED', 'FAILED');

CREATE TABLE "FdBookingAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "FdBookingStatus" NOT NULL DEFAULT 'PENDING',
    "providerName" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "partySize" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "confirmationReference" TEXT,
    "providerReference" TEXT,
    "slotId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdBookingAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FdBookingAttempt_idempotencyKey_key" ON "FdBookingAttempt"("idempotencyKey");
CREATE INDEX "FdBookingAttempt_tenantId_status_idx" ON "FdBookingAttempt"("tenantId", "status");
CREATE INDEX "FdBookingAttempt_status_nextAttemptAt_idx" ON "FdBookingAttempt"("status", "nextAttemptAt");
CREATE INDEX "FdBookingAttempt_status_lockedAt_idx" ON "FdBookingAttempt"("status", "lockedAt");
CREATE INDEX "FdBookingAttempt_tenantId_createdAt_idx" ON "FdBookingAttempt"("tenantId", "createdAt");

ALTER TABLE "FdBookingAttempt" ADD CONSTRAINT "FdBookingAttempt_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FdBookingAttempt" ADD CONSTRAINT "FdBookingAttempt_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "FdLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
