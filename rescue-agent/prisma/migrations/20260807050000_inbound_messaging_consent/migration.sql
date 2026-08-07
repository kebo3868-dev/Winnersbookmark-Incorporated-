-- CreateEnum
CREATE TYPE "FdConsentStatus" AS ENUM ('UNKNOWN', 'IMPLIED', 'OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "FdMessagePurpose" AS ENUM ('ESCALATION_ALERT', 'MISSED_CALL_RECOVERY', 'CONVERSATION_REPLY');

-- AlterTable
ALTER TABLE "FdNotification" ADD COLUMN     "purpose" "FdMessagePurpose" NOT NULL DEFAULT 'ESCALATION_ALERT';

-- CreateTable
CREATE TABLE "FdConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "FdConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT,
    "optedInAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdInboundEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdInboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdRateCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FdRateCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FdConsent_tenantId_status_idx" ON "FdConsent"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FdConsent_tenantId_phone_key" ON "FdConsent"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "FdInboundEvent_tenantId_receivedAt_idx" ON "FdInboundEvent"("tenantId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FdInboundEvent_provider_providerEventId_key" ON "FdInboundEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "FdRateCounter_windowStart_idx" ON "FdRateCounter"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "FdRateCounter_tenantId_scope_subject_windowStart_key" ON "FdRateCounter"("tenantId", "scope", "subject", "windowStart");

-- AddForeignKey
ALTER TABLE "FdConsent" ADD CONSTRAINT "FdConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdInboundEvent" ADD CONSTRAINT "FdInboundEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdRateCounter" ADD CONSTRAINT "FdRateCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

