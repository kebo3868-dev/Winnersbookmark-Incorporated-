-- Escalation contact verification (Milestone 6).
--
-- Records proof that a specific escalation contact can actually receive a
-- message. VERIFIED is only ever reached from a provider delivery receipt, so
-- the pilot-readiness gate can require evidence that a rota works rather than
-- an operator's belief that it does.

CREATE TYPE "FdContactVerificationStatus" AS ENUM ('PENDING', 'SENT', 'VERIFIED', 'FAILED');

CREATE TABLE "FdContactVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notificationId" TEXT,
    "status" "FdContactVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdContactVerification_pkey" PRIMARY KEY ("id")
);

-- One verification row per (tenant, contact, number). Keying on the phone as
-- well as the contact means editing a contact's number invalidates the proof
-- rather than inheriting it, which is the whole point of testing the number.
CREATE UNIQUE INDEX "FdContactVerification_tenantId_contactKey_phone_key"
    ON "FdContactVerification"("tenantId", "contactKey", "phone");

CREATE INDEX "FdContactVerification_tenantId_status_idx"
    ON "FdContactVerification"("tenantId", "status");

CREATE INDEX "FdContactVerification_notificationId_idx"
    ON "FdContactVerification"("notificationId");

ALTER TABLE "FdContactVerification"
    ADD CONSTRAINT "FdContactVerification_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
