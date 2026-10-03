ALTER TABLE "RailJob" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "RailJob_userId_createdAt_id_idx" ON "RailJob"("userId", "createdAt", "id");
ALTER TABLE "RailJob" ADD COLUMN "deferredUntil" TIMESTAMP(3);
CREATE TABLE "RailReminderPause" (
  "userId" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "until" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RailReminderPause_pkey" PRIMARY KEY ("userId", "journeyId"),
  CONSTRAINT "RailReminderPause_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
