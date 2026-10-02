ALTER TABLE "AppSettings" ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "RailTelegram" ("userId" TEXT NOT NULL PRIMARY KEY, "providerId" TEXT NOT NULL, "chatId" TEXT, "chatHash" TEXT, "username" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT false, "linkTokenHash" TEXT, "linkExpiresAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "RailTelegram_chatHash_key" ON "RailTelegram"("chatHash");
CREATE UNIQUE INDEX "RailTelegram_linkTokenHash_key" ON "RailTelegram"("linkTokenHash");
ALTER TABLE "RailTelegram" ADD CONSTRAINT "RailTelegram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
