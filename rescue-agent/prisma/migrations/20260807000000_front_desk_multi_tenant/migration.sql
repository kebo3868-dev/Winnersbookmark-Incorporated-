-- CreateEnum
CREATE TYPE "FdTenantStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FdChannel" AS ENUM ('WEB', 'SMS', 'VOICE');

-- CreateEnum
CREATE TYPE "FdMessageRole" AS ENUM ('CUSTOMER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FdLeadCategory" AS ENUM ('RESERVATION', 'LARGE_PARTY', 'CATERING', 'PRIVATE_EVENT', 'TAKEOUT', 'DELIVERY', 'GENERAL', 'COMPLAINT_RECOVERY');

-- CreateEnum
CREATE TYPE "FdLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'WON', 'LOST', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FdPriority" AS ENUM ('STANDARD', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FdEscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "FdTenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FdTenantStatus" NOT NULL DEFAULT 'ONBOARDING',
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "FdChannel" NOT NULL DEFAULT 'WEB',
    "externalRef" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "FdMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "intent" TEXT,
    "answerSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "source" TEXT NOT NULL,
    "customerName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "category" "FdLeadCategory" NOT NULL,
    "intent" TEXT NOT NULL,
    "priority" "FdPriority" NOT NULL DEFAULT 'STANDARD',
    "partySize" INTEGER,
    "requestedDate" TEXT,
    "requestedTime" TEXT,
    "notes" TEXT,
    "estimatedValueCents" INTEGER,
    "status" "FdLeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedTo" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "followUpDueAt" TIMESTAMP(3),
    "resolution" TEXT,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FdLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FdEscalation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "customerName" TEXT,
    "contact" TEXT,
    "routeTo" TEXT NOT NULL,
    "status" "FdEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FdTenant_slug_key" ON "FdTenant"("slug");

-- CreateIndex
CREATE INDEX "FdTenant_status_idx" ON "FdTenant"("status");

-- CreateIndex
CREATE INDEX "FdConversation_tenantId_startedAt_idx" ON "FdConversation"("tenantId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FdConversation_tenantId_channel_externalRef_key" ON "FdConversation"("tenantId", "channel", "externalRef");

-- CreateIndex
CREATE INDEX "FdMessage_tenantId_createdAt_idx" ON "FdMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FdMessage_conversationId_createdAt_idx" ON "FdMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "FdLead_tenantId_createdAt_idx" ON "FdLead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FdLead_tenantId_status_idx" ON "FdLead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FdLead_tenantId_category_idx" ON "FdLead"("tenantId", "category");

-- CreateIndex
CREATE INDEX "FdEscalation_tenantId_status_idx" ON "FdEscalation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FdEscalation_tenantId_createdAt_idx" ON "FdEscalation"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "FdConversation" ADD CONSTRAINT "FdConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdMessage" ADD CONSTRAINT "FdMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdMessage" ADD CONSTRAINT "FdMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FdConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdLead" ADD CONSTRAINT "FdLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdLead" ADD CONSTRAINT "FdLead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FdConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdEscalation" ADD CONSTRAINT "FdEscalation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FdTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FdEscalation" ADD CONSTRAINT "FdEscalation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FdConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

