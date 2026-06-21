import { prisma } from "@/lib/db";

const SETTINGS_ID = "global";

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      allowSignups: true,
      reminderEmailEnabled: true,
      reminderDiscordEnabled: false,
      reminderInAppEnabled: true,
      reminderSevenDaysEnabled: true,
      reminderOneDayEnabled: true,
      reminderBookingOpenEnabled: true,
    },
  });
}
