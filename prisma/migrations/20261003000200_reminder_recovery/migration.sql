ALTER TABLE "RailJob" ADD COLUMN "retryRequestedAt" TIMESTAMP(3);
CREATE TABLE "RailOperations" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "succeededAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RailOperations_pkey" PRIMARY KEY ("id")
);
