-- Shared operator sign-in attempt counters (issue #73). Additive only: one new
-- table, no change to any existing table or row. See src/lib/operatorThrottle.ts.

-- CreateTable
CREATE TABLE "OperatorLoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorLoginThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "OperatorLoginThrottle_updatedAt_idx" ON "OperatorLoginThrottle"("updatedAt");

