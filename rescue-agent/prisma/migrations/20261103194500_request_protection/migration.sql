ALTER TABLE "FdAuditLog" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "FdAuditLog" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "FdAuditLog_dedupeKey_key" ON "FdAuditLog"("dedupeKey");

CREATE TABLE "FdSecurityBucket" (
  "namespace" TEXT NOT NULL,
  "slot" INTEGER NOT NULL CHECK ("slot" >= 0 AND "slot" < 65536),
  "windowStart" BIGINT NOT NULL,
  "count" INTEGER NOT NULL CHECK ("count" > 0),
  CONSTRAINT "FdSecurityBucket_pkey" PRIMARY KEY ("namespace", "slot")
);
