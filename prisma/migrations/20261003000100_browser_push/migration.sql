CREATE TABLE "RailPushConfig" ("id" TEXT NOT NULL, "publicKey" TEXT NOT NULL, "privateKey" TEXT NOT NULL, CONSTRAINT "RailPushConfig_pkey" PRIMARY KEY ("id"));
CREATE TABLE "RailPush" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "endpointHash" TEXT NOT NULL, "subscription" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RailPush_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RailPush_endpointHash_key" ON "RailPush"("endpointHash");
CREATE INDEX "RailPush_userId_idx" ON "RailPush"("userId");
ALTER TABLE "RailPush" ADD CONSTRAINT "RailPush_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
