-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PHOTO_OBSERVED', 'STAFF_CONFIRMED', 'MANAGER_CONFIRMED', 'SYSTEM_CONFIRMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CallResolution" AS ENUM ('AI_RESOLVED', 'DRAFT_ORDER_CREATED', 'TRANSFERRED', 'CALLBACK_REQUIRED', 'LEAD_CAPTURED', 'CUSTOMER_ABANDONED', 'AI_FAILED', 'TECHNICAL_FAILURE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DraftOrderStatus" AS ENUM ('CAPTURING', 'AWAITING_CUSTOMER_CONFIRMATION', 'CUSTOMER_CONFIRMED', 'AWAITING_STAFF_REVIEW', 'ACCEPTED', 'REQUIRES_CALLBACK', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('LARGE_PARTY', 'PRIVATE_EVENT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED');

-- CreateTable
CREATE TABLE "RestaurantProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "greeting" TEXT NOT NULL,
    "agentName" TEXT NOT NULL DEFAULT 'Leverock''s virtual assistant',
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "hoursNote" TEXT,
    "earlyMenuNote" TEXT,
    "freshFishPolicy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'DINING',
    "opensAt" TEXT,
    "closesAt" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "priceDisplay" TEXT,
    "isMarketPrice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availabilityNote" TEXT,
    "mostPopular" BOOLEAN NOT NULL DEFAULT false,
    "signatureItem" BOOLEAN NOT NULL DEFAULT false,
    "requiresStaffConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "allergenEscalationRequired" BOOLEAN NOT NULL DEFAULT false,
    "prepOptions" TEXT[],
    "sideOptions" TEXT[],
    "modifierOptions" TEXT[],
    "requiredSideCount" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantPolicy" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffContact" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "externalCallId" TEXT,
    "callerPhone" TEXT,
    "callerName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "initialIntent" TEXT,
    "finalIntent" TEXT,
    "intentConfidence" INTEGER,
    "resolution" "CallResolution" NOT NULL DEFAULT 'UNKNOWN',
    "resolvedByAi" BOOLEAN NOT NULL DEFAULT false,
    "transferred" BOOLEAN NOT NULL DEFAULT false,
    "transferTargetRole" TEXT,
    "callbackRequired" BOOLEAN NOT NULL DEFAULT false,
    "abandoned" BOOLEAN NOT NULL DEFAULT false,
    "estimatedRevenue" DECIMAL(10,2),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftOrder" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "callId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" "DraftOrderStatus" NOT NULL DEFAULT 'CAPTURING',
    "customerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "reviewReason" TEXT,
    "reviewFlags" TEXT[],
    "allergyFlag" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" INTEGER,
    "estimatedValue" DECIMAL(10,2),
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftOrderItem" (
    "id" TEXT NOT NULL,
    "draftOrderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuItemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "preparation" TEXT,
    "sides" TEXT[],
    "modifiers" TEXT[],
    "specialRequests" TEXT[],
    "allergyNote" TEXT,
    "itemFlags" TEXT[],
    "unitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "callId" TEXT,
    "leadType" "LeadType" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "partySize" INTEGER,
    "requestedDate" TEXT,
    "details" TEXT,
    "estimatedValue" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAlert" (
    "id" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "callId" TEXT,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "targetRole" TEXT,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantProfile_slug_key" ON "RestaurantProfile"("slug");

-- CreateIndex
CREATE INDEX "BusinessHours_restaurantProfileId_dayOfWeek_idx" ON "BusinessHours"("restaurantProfileId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_restaurantProfileId_slug_key" ON "MenuCategory"("restaurantProfileId", "slug");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantProfileId_categoryId_idx" ON "MenuItem"("restaurantProfileId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_restaurantProfileId_slug_key" ON "MenuItem"("restaurantProfileId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StaffContact_restaurantProfileId_role_key" ON "StaffContact"("restaurantProfileId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_externalCallId_key" ON "VoiceCall"("externalCallId");

-- CreateIndex
CREATE INDEX "VoiceCall_restaurantProfileId_startedAt_idx" ON "VoiceCall"("restaurantProfileId", "startedAt");

-- CreateIndex
CREATE INDEX "CallEvent_callId_createdAt_idx" ON "CallEvent"("callId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftOrder_restaurantProfileId_status_idx" ON "DraftOrder"("restaurantProfileId", "status");

-- CreateIndex
CREATE INDEX "Lead_restaurantProfileId_leadType_status_idx" ON "Lead"("restaurantProfileId", "leadType", "status");

-- CreateIndex
CREATE INDEX "StaffAlert_restaurantProfileId_status_idx" ON "StaffAlert"("restaurantProfileId", "status");

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPolicy" ADD CONSTRAINT "RestaurantPolicy_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContact" ADD CONSTRAINT "StaffContact_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrderItem" ADD CONSTRAINT "DraftOrderItem_draftOrderId_fkey" FOREIGN KEY ("draftOrderId") REFERENCES "DraftOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrderItem" ADD CONSTRAINT "DraftOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAlert" ADD CONSTRAINT "StaffAlert_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAlert" ADD CONSTRAINT "StaffAlert_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

