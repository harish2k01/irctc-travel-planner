ALTER TABLE "RailWorkspace" ADD COLUMN "storageVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RailWorkspace" ADD COLUMN "planGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RailFile" ADD COLUMN "journeyId" TEXT;
ALTER TABLE "RailJob" ADD COLUMN "planGeneration" INTEGER;
ALTER TABLE "RailOperations" ADD COLUMN "accountCursor" TEXT;
