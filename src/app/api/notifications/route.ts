import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildJourneyReminders } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import type { Journey } from "@/lib/types";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET() {
  const user = await requireUser();
  const [journeys, settings] = await Promise.all([
    prisma.journey.findMany({ where: { userId: user.id, remindersEnabled: true } }),
    getAppSettings(),
  ]);
  const reminders = journeys.flatMap((journey): ReturnType<typeof buildJourneyReminders> => {
    const hasEnabledChannel =
      (settings.reminderEmailEnabled && journey.reminderEmailEnabled) ||
      (settings.reminderDiscordEnabled && journey.reminderDiscordEnabled) ||
      (settings.reminderInAppEnabled && journey.reminderInAppEnabled);

    if (!hasEnabledChannel) {
      return [];
    }

    const item: Journey = {
      id: journey.id,
      routeId: journey.routeId,
      trainId: journey.trainId,
      travelDate: dateOnly(journey.travelDate),
      bookingOpenDate: dateOnly(journey.bookingOpenDate),
      preferredClass: journey.preferredClass,
      status: journey.status,
      remindersEnabled: journey.remindersEnabled,
      reminderEmailEnabled: journey.reminderEmailEnabled,
      reminderDiscordEnabled: journey.reminderDiscordEnabled,
      reminderInAppEnabled: journey.reminderInAppEnabled,
    };

    return buildJourneyReminders(item);
  }).filter((reminder) => {
    if (reminder.type === "SEVEN_DAYS_BEFORE") return settings.reminderSevenDaysEnabled;
    if (reminder.type === "ONE_DAY_BEFORE") return settings.reminderOneDayEnabled;
    return settings.reminderBookingOpenEnabled;
  });

  return NextResponse.json({
    data: {
      preferences: [
        { channel: "EMAIL", enabled: settings.reminderEmailEnabled },
        { channel: "DISCORD", enabled: settings.reminderDiscordEnabled },
        { channel: "IN_APP", enabled: settings.reminderInAppEnabled },
      ],
      reminders,
      queued: reminders.filter((reminder) => reminder.dueDate >= dateOnly(new Date())),
    },
  });
}
