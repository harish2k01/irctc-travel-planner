ALTER TABLE "AppSettings"
  ADD COLUMN "calendarWeekStartsOn" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AppSettings"
  ADD CONSTRAINT "AppSettings_calendarWeekStartsOn_check"
  CHECK ("calendarWeekStartsOn" IN (0, 1));
