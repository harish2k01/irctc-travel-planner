import { NextResponse } from "next/server";
import { buildJourneyReminders } from "@/lib/dates";
import { journeys, notificationPreferences } from "@/lib/seed-data";

export async function GET() {
  const reminders = journeys.flatMap(buildJourneyReminders);

  return NextResponse.json({
    data: {
      preferences: notificationPreferences,
      reminders,
      queued: reminders.filter((reminder) => reminder.dueDate >= "2026-06-19"),
    },
  });
}
