-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "avgTicketInput" DOUBLE PRECISION,
ADD COLUMN     "googleBusinessUrl" TEXT,
ADD COLUMN     "orderingUrlInput" TEXT,
ADD COLUMN     "ownerRating" DOUBLE PRECISION,
ADD COLUMN     "ownerReviewCount" INTEGER,
ADD COLUMN     "reservationUrlInput" TEXT,
ADD COLUMN     "socialUrlInput" TEXT;

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_auditId_key" ON "Lead"("auditId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
