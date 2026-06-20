import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildJourneyReminders } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { notificationPreferences } from "@/lib/seed-data";
import type { Journey } from "@/lib/types";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET() {
  const user = await requireUser();
  const journeys = await prisma.journey.findMany({ where: { userId: user.id } });
  const reminders = journeys.flatMap((journey): ReturnType<typeof buildJourneyReminders> => {
    const item: Journey = {
      id: journey.id,
      routeId: journey.routeId,
      trainId: journey.trainId,
      travelDate: dateOnly(journey.travelDate),
      bookingOpenDate: dateOnly(journey.bookingOpenDate),
      preferredClass: journey.preferredClass,
      status: journey.status,
    };

    return buildJourneyReminders(item);
  });

  return NextResponse.json({
    data: {
      preferences: notificationPreferences,
      reminders,
      queued: reminders.filter((reminder) => reminder.dueDate >= dateOnly(new Date())),
    },
  });
}
