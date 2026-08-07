-- AlterEnum
ALTER TYPE "FdNotificationStatus" ADD VALUE 'SENDING';

-- AlterTable
ALTER TABLE "FdNotification" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT;

-- CreateIndex
CREATE INDEX "FdNotification_status_lockedAt_idx" ON "FdNotification"("status", "lockedAt");

