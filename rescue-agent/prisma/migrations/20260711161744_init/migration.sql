-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditStage" AS ENUM ('INITIALIZING', 'VALIDATING_WEBSITE', 'DISCOVERING_PAGES', 'COLLECTING_EVIDENCE', 'ANALYZING_CUSTOMER_JOURNEY', 'DETECTING_REVENUE_LEAKS', 'SCORING_OPPORTUNITIES', 'CALCULATING_RESCUE_SCORE', 'GENERATING_OWNER_REPORT', 'GENERATING_SALES_BRIEF', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('COLLECTED', 'UNAVAILABLE', 'BLOCKED', 'TIMEOUT', 'ERROR');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('OWNER_AUDIT', 'INTERNAL_SALES');

-- CreateEnum
CREATE TYPE "SalesPriority" AS ENUM ('HOT', 'WARM', 'NURTURE', 'LOW_PRIORITY');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "knownConcern" TEXT,
    "overallScore" INTEGER,
    "coverageScore" INTEGER,
    "confidenceLevel" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSource" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pageTitle" TEXT,
    "sourceType" TEXT NOT NULL,
    "status" "SourceStatus" NOT NULL,
    "httpStatus" INTEGER,
    "note" TEXT,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "auditSourceId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "supportingContext" TEXT,
    "confidence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyStage" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "manualValidationRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidenceIds" TEXT[],

    CONSTRAINT "JourneyStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "customerJourneyStage" TEXT NOT NULL,
    "evidenceIds" TEXT[],
    "impactScore" INTEGER NOT NULL,
    "urgencyScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "aiFitScore" INTEGER NOT NULL,
    "rescuePriorityScore" INTEGER NOT NULL,
    "recommendedSolution" TEXT NOT NULL,
    "manualValidationRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScore" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "score" INTEGER,
    "confidence" INTEGER NOT NULL,
    "insufficientData" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "AuditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesIntelligence" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "leadQualityScore" INTEGER NOT NULL,
    "salesOpportunityScore" INTEGER NOT NULL,
    "painLevel" TEXT NOT NULL,
    "buyerPersona" TEXT NOT NULL,
    "bestSalesAngle" TEXT NOT NULL,
    "topDiscoveryQuestion" TEXT NOT NULL,
    "discoveryQuestions" TEXT[],
    "likelyObjection" TEXT NOT NULL,
    "objectionStrategy" TEXT NOT NULL,
    "recommendedOffer" TEXT NOT NULL,
    "outreachAngle" TEXT NOT NULL,
    "emailOpener" TEXT NOT NULL,
    "callOpener" TEXT NOT NULL,
    "talkTrack" TEXT NOT NULL,
    "followUpAngle" TEXT NOT NULL,
    "priority" "SalesPriority" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditJob" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "currentStage" "AuditStage" NOT NULL DEFAULT 'INITIALIZING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "auditId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_websiteUrl_key" ON "Restaurant"("websiteUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Report_auditId_reportType_key" ON "Report"("auditId", "reportType");

-- CreateIndex
CREATE UNIQUE INDEX "SalesIntelligence_auditId_key" ON "SalesIntelligence"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditJob_auditId_key" ON "AuditJob"("auditId");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSource" ADD CONSTRAINT "AuditSource_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_auditSourceId_fkey" FOREIGN KEY ("auditSourceId") REFERENCES "AuditSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStage" ADD CONSTRAINT "JourneyStage_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScore" ADD CONSTRAINT "AuditScore_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesIntelligence" ADD CONSTRAINT "SalesIntelligence_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditJob" ADD CONSTRAINT "AuditJob_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
