ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "User"
  ADD COLUMN "calendarWeekStartsOn" INTEGER,
  ADD COLUMN "defaultEmail" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "defaultDiscord" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultInApp" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discordWebhookUrl" TEXT;

ALTER TABLE "Journey"
  ADD COLUMN "journeyGroupId" TEXT,
  ADD COLUMN "scheduleRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pnrNextSyncAt" TIMESTAMP(3),
  ADD COLUMN "pnrLastError" TEXT;
CREATE INDEX "Journey_userId_journeyGroupId_idx" ON "Journey"("userId", "journeyGroupId");

ALTER TABLE "JourneyReminder"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cancelledAt" TIMESTAMP(3);
DROP INDEX "JourneyReminder_journeyId_type_key";
CREATE UNIQUE INDEX "JourneyReminder_journeyId_revision_type_key" ON "JourneyReminder"("journeyId", "revision", "type");

ALTER TABLE "ReminderDelivery"
  ADD COLUMN "leaseToken" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "snoozedUntil" TIMESTAMP(3);

-- Recover work abandoned by an older worker during the coordinated cutover.
UPDATE "ReminderDelivery" SET "status" = 'PENDING' WHERE "status" = 'SENDING';
