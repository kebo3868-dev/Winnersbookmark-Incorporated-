-- CreateEnum
CREATE TYPE "FdNotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'UNDELIVERED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FdFailureCategory" AS ENUM ('FAILED_SMS', 'FAILED_NOTIFICATION', 'FAILED_INTEGRATION', 'FAILED_BOOKING', 'FAILED_DATA_WRITE', 'FAILED_WEBHOOK', 'FAILED_AI_RESPONSE');

-- CreateEnum
CREATE TYPE "FdFailureStatus" AS ENUM ('OPEN', 'RETRYING', 'RESOLVED', 'ABANDONED');

-- CreateTable
CREATE TABLE "FdNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "escalationId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "toNumber" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "FdNotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdFailure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "category" "FdFailureCategory" NOT NULL,
    "operation" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "referenceId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "FdFailureStatus" NOT NULL DEFAULT 'OPEN',
    "lastError" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FdNotification_providerMessageId_key" ON "FdNotification"("providerMessageId");

-- CreateIndex
CREATE INDEX "FdNotification_tenantId_status_idx" ON "FdNotification"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FdNotification_status_nextAttemptAt_idx" ON "FdNotification"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FdNotification_tenantId_createdAt_idx" ON "FdNotification"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FdFailure_tenantId_status_idx" ON "FdFailure"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FdFailure_category_status_idx" ON "FdFailure"("category", "status");

-- AddForeignKey
ALTER TABLE "FdNotification" ADD CONSTRAINT "FdNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdNotification" ADD CONSTRAINT "FdNotification_escalationId_fkey" FOREIGN KEY ("escalationId") REFERENCES "FdEscalation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdFailure" ADD CONSTRAINT "FdFailure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

