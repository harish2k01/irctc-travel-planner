ALTER TABLE "RailTelegram" ADD COLUMN "authStateHash" TEXT,
ADD COLUMN "authPayload" TEXT, ADD COLUMN "authExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "RailTelegram_authStateHash_key" ON "RailTelegram"("authStateHash");
ALTER TABLE "AppSettings" ADD COLUMN "telegramPollLease" TEXT,
ADD COLUMN "telegramPollUntil" TIMESTAMP(3);
