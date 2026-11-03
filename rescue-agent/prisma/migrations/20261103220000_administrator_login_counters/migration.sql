-- Additive only: preserve every existing tenant failure counter and audit.
CREATE TABLE "FdAdminLoginCounter" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FdAdminLoginCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FdAdminLoginCounter_subject_windowStart_key"
    ON "FdAdminLoginCounter"("subject", "windowStart");
CREATE INDEX "FdAdminLoginCounter_windowStart_idx"
    ON "FdAdminLoginCounter"("windowStart");
