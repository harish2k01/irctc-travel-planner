ALTER TABLE "RailWorkspace" ADD COLUMN "listVersion" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "listPayload" TEXT NOT NULL DEFAULT '', ADD COLUMN "listDay" TEXT NOT NULL DEFAULT '';
CREATE TABLE "RailJourney" (
 "userId" TEXT NOT NULL, "id" TEXT NOT NULL, "date" TEXT NOT NULL, "bookingDate" TEXT NOT NULL, "bookingAt" TIMESTAMP(3) NOT NULL,
 "status" TEXT NOT NULL, "archived" BOOLEAN NOT NULL, "ruleId" TEXT, "hasTicket" BOOLEAN NOT NULL,
 "fingerprint" TEXT NOT NULL, "searchTokens" TEXT[] NOT NULL, "payload" TEXT NOT NULL,
 CONSTRAINT "RailJourney_pkey" PRIMARY KEY ("userId","id"),
 CONSTRAINT "RailJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RailJourney_userId_archived_status_date_id_idx" ON "RailJourney"("userId","archived","status","date","id");
CREATE INDEX "RailJourney_userId_bookingAt_id_idx" ON "RailJourney"("userId","bookingAt","id");
CREATE INDEX "RailJourney_searchTokens_idx" ON "RailJourney" USING GIN ("searchTokens");
