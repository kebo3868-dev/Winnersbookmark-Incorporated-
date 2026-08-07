-- CreateTable
CREATE TABLE "FdApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "FdApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "event" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "keyId" TEXT,
    "outcome" TEXT NOT NULL,
    "detail" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FdApiKey_keyHash_key" ON "FdApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "FdApiKey_tenantId_revokedAt_idx" ON "FdApiKey"("tenantId", "revokedAt");

-- CreateIndex
CREATE INDEX "FdAuditLog_tenantId_createdAt_idx" ON "FdAuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FdAuditLog_event_createdAt_idx" ON "FdAuditLog"("event", "createdAt");

-- AddForeignKey
ALTER TABLE "FdApiKey" ADD CONSTRAINT "FdApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdAuditLog" ADD CONSTRAINT "FdAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

