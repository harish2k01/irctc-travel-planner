BEGIN;

-- New production enums.
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'READ');
CREATE TYPE "AccountTokenType" AS ENUM ('INVITATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- Preserve holiday data while reducing the supported types.
ALTER TYPE "HolidayType" RENAME TO "HolidayType_old";
CREATE TYPE "HolidayType" AS ENUM ('COMPANY', 'PERSONAL_LEAVE');
ALTER TABLE "Holiday"
  ALTER COLUMN "type" TYPE "HolidayType"
  USING (
    CASE
      WHEN "type"::text = 'PERSONAL_LEAVE' THEN 'PERSONAL_LEAVE'
      ELSE 'COMPANY'
    END
  )::"HolidayType";
DROP TYPE "HolidayType_old";

-- Map the removed booking states into the ticket tracker's simpler lifecycle.
ALTER TABLE "Journey" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "JourneyStatus" RENAME TO "JourneyStatus_old";
CREATE TYPE "JourneyStatus" AS ENUM ('PLANNED', 'BOOKED', 'ARCHIVED');
ALTER TABLE "Journey"
  ALTER COLUMN "status" TYPE "JourneyStatus"
  USING (
    CASE
      WHEN "status"::text IN ('BOOKED', 'WAITLISTED', 'RAC', 'CONFIRMED') THEN 'BOOKED'
      WHEN "status"::text IN ('CANCELLED', 'COMPLETED') THEN 'ARCHIVED'
      ELSE 'PLANNED'
    END
  )::"JourneyStatus";
DROP TYPE "JourneyStatus_old";
ALTER TABLE "Journey" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

ALTER TABLE "AppSettings"
  ADD COLUMN "bookingOpenHour" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "bookingOpenMinute" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bookingWindowDays" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "pnrAutoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pnrSyncIntervalMinutes" INTEGER NOT NULL DEFAULT 360;

ALTER TABLE "Session"
  ADD COLUMN "ipHash" TEXT,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "userAgent" TEXT;

DROP INDEX "User_googleId_key";
ALTER TABLE "User"
  DROP COLUMN "googleId",
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN "weekendDays" INTEGER[] NOT NULL DEFAULT ARRAY[0, 6]::INTEGER[];

UPDATE "User"
SET "role" = 'ADMIN'
WHERE "id" = (
  SELECT "id" FROM "User" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN' AND "isActive" = true);

CREATE TABLE "AccountToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AccountTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Copy route information onto each ticket before Route is removed.
UPDATE "Journey" AS journey
SET
  "sourceCode" = COALESCE(NULLIF(journey."sourceCode", ''), route."originCode"),
  "sourceName" = COALESCE(NULLIF(journey."sourceName", ''), route."originName"),
  "destinationCode" = COALESCE(NULLIF(journey."destinationCode", ''), route."destinationCode"),
  "destinationName" = COALESCE(NULLIF(journey."destinationName", ''), route."destinationName")
FROM "Route" AS route
WHERE journey."routeId" = route."id";

UPDATE "Journey"
SET
  "sourceCode" = COALESCE(NULLIF("sourceCode", ''), 'UNKNOWN'),
  "destinationCode" = COALESCE(NULLIF("destinationCode", ''), 'UNKNOWN');

ALTER TABLE "Journey"
  ADD COLUMN "pnrLast4" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "Journey"
SET "pnrLast4" = RIGHT("pnr", 4)
WHERE "pnr" IS NOT NULL AND "pnr" <> '';

-- Preserve booked train, class and seat information separately from planned tickets.
CREATE TABLE "PnrSnapshot" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "trainNumber" TEXT,
  "trainName" TEXT,
  "bookedClass" TEXT,
  "providerStatus" TEXT,
  "coach" TEXT,
  "seat" TEXT,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PnrSnapshot_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PnrSnapshot" (
  "id", "ticketId", "provider", "trainNumber", "trainName", "bookedClass",
  "providerStatus", "coach", "seat", "updatedAt"
)
SELECT
  'legacy_' || MD5(journey."id"),
  journey."id",
  'legacy',
  train."trainNumber",
  train."trainName",
  NULLIF(journey."preferredClass", ''),
  journey."status"::text,
  journey."coach",
  journey."seat",
  CURRENT_TIMESTAMP
FROM "Journey" AS journey
LEFT JOIN "Train" AS train ON train."id" = journey."trainId"
WHERE journey."pnr" IS NOT NULL AND journey."pnr" <> '';

-- Store travel dates as dates and booking moments as timezone-aware timestamps.
ALTER TABLE "Journey"
  ALTER COLUMN "travelDate" TYPE DATE USING "travelDate"::date,
  ALTER COLUMN "bookingOpenDate" TYPE TIMESTAMPTZ(3)
    USING (("bookingOpenDate"::date + TIME '08:00') AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "sourceCode" SET NOT NULL,
  ALTER COLUMN "destinationCode" SET NOT NULL;

ALTER TABLE "JourneyReminder" RENAME COLUMN "sentAt" TO "processedAt";
ALTER TABLE "JourneyReminder"
  ALTER COLUMN "dueAt" TYPE TIMESTAMPTZ(3)
    USING ("dueAt" AT TIME ZONE 'Asia/Kolkata');

UPDATE "JourneyReminder" AS reminder
SET "dueAt" = CASE reminder."type"
  WHEN 'SEVEN_DAYS_BEFORE' THEN journey."bookingOpenDate" - INTERVAL '7 days'
  WHEN 'ONE_DAY_BEFORE' THEN journey."bookingOpenDate" - INTERVAL '1 day'
  ELSE journey."bookingOpenDate"
END
FROM "Journey" AS journey
WHERE reminder."journeyId" = journey."id";

UPDATE "JourneyReminder"
SET "processedAt" = CURRENT_TIMESTAMP
WHERE "processedAt" IS NULL
  AND "dueAt" < CURRENT_TIMESTAMP - INTERVAL '24 hours';

ALTER TABLE "Holiday"
  DROP COLUMN "region",
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "date" TYPE DATE USING "date"::date;
ALTER TABLE "Holiday" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Remove data models that are no longer part of a ticket-only tracker.
ALTER TABLE "Journey" DROP CONSTRAINT "Journey_trainId_fkey";
ALTER TABLE "Journey" DROP CONSTRAINT "Journey_routeId_fkey";
DROP TABLE "Attachment";
DROP TABLE "LeaveRequest";
DROP TABLE "Notification";
DROP TABLE "Train";
DROP TABLE "Route";

ALTER TABLE "Journey"
  DROP COLUMN "bookingDate",
  DROP COLUMN "coach",
  DROP COLUMN "direction",
  DROP COLUMN "farePaid",
  DROP COLUMN "preferredClass",
  DROP COLUMN "recurrence",
  DROP COLUMN "routeId",
  DROP COLUMN "seat",
  DROP COLUMN "trainId",
  DROP COLUMN "waitlistPosition";

DROP TYPE "NotificationStatus";
DROP TYPE "RecurrenceType";
DROP TYPE "TravelDirection";
DROP TYPE "NotificationChannel";
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'DISCORD', 'IN_APP');

CREATE TABLE "ReminderDelivery" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

DROP INDEX "Holiday_date_idx";
DROP INDEX "Holiday_type_idx";
DROP INDEX "Journey_status_idx";
DROP INDEX "JourneyReminder_dueAt_idx";

CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");
CREATE INDEX "AccountToken_userId_type_idx" ON "AccountToken"("userId", "type");
CREATE INDEX "AccountToken_expiresAt_idx" ON "AccountToken"("expiresAt");
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
CREATE UNIQUE INDEX "PnrSnapshot_ticketId_key" ON "PnrSnapshot"("ticketId");
CREATE INDEX "PnrSnapshot_nextSyncAt_idx" ON "PnrSnapshot"("nextSyncAt");
CREATE UNIQUE INDEX "ReminderDelivery_scheduleId_channel_key" ON "ReminderDelivery"("scheduleId", "channel");
CREATE INDEX "ReminderDelivery_userId_channel_status_createdAt_idx" ON "ReminderDelivery"("userId", "channel", "status", "createdAt");
CREATE INDEX "ReminderDelivery_status_nextAttemptAt_idx" ON "ReminderDelivery"("status", "nextAttemptAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX "Holiday_userId_date_idx" ON "Holiday"("userId", "date");
CREATE UNIQUE INDEX "Holiday_userId_date_name_key" ON "Holiday"("userId", "date", "name");
CREATE INDEX "Journey_userId_status_idx" ON "Journey"("userId", "status");
CREATE INDEX "JourneyReminder_dueAt_processedAt_idx" ON "JourneyReminder"("dueAt", "processedAt");

ALTER TABLE "AccountToken"
  ADD CONSTRAINT "AccountToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PnrSnapshot"
  ADD CONSTRAINT "PnrSnapshot_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderDelivery"
  ADD CONSTRAINT "ReminderDelivery_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "JourneyReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderDelivery"
  ADD CONSTRAINT "ReminderDelivery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
