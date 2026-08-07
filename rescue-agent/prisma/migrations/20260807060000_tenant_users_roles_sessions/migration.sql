-- CreateEnum
CREATE TYPE "FdRole" AS ENUM ('WBI_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'RESTAURANT_STAFF', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "FdUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- DropIndex
DROP INDEX "FdInboundEvent_provider_providerEventId_key";

-- AlterTable
ALTER TABLE "FdTenant" ADD COLUMN     "webhookSecretHash" TEXT;

-- AlterTable
ALTER TABLE "FdInboundEvent" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "FdUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "FdRole" NOT NULL,
    "status" "FdUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FdUser_tenantId_status_idx" ON "FdUser"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FdUser_tenantId_email_key" ON "FdUser"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "FdSession_tokenHash_key" ON "FdSession"("tokenHash");

-- CreateIndex
CREATE INDEX "FdSession_userId_expiresAt_idx" ON "FdSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FdInboundEvent_tenantId_provider_providerEventId_key" ON "FdInboundEvent"("tenantId", "provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "FdUser" ADD CONSTRAINT "FdUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdSession" ADD CONSTRAINT "FdSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FdUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

