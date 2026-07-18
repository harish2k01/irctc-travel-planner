import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

const SETTINGS_ID = "global";

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function getDeliveryConfiguration() {
  const settings = await getAppSettings();
  return {
    ...settings,
    smtpUrl: decryptSecret(settings.smtpUrl) ?? process.env.SMTP_URL,
    discordWebhookUrl: decryptSecret(settings.discordWebhookUrl) ?? process.env.DISCORD_WEBHOOK_URL,
    emailFrom: settings.emailFrom ?? process.env.EMAIL_FROM ?? "IRCTC Travel Planner <noreply@example.com>",
  };
}

export function serializeAdminSettings(settings: Awaited<ReturnType<typeof getAppSettings>>) {
  return {
    allowSignups: settings.allowSignups,
    reminderEmailEnabled: settings.reminderEmailEnabled,
    reminderDiscordEnabled: settings.reminderDiscordEnabled,
    reminderInAppEnabled: settings.reminderInAppEnabled,
    reminderSevenDaysEnabled: settings.reminderSevenDaysEnabled,
    reminderOneDayEnabled: settings.reminderOneDayEnabled,
    reminderBookingOpenEnabled: settings.reminderBookingOpenEnabled,
    bookingWindowDays: settings.bookingWindowDays,
    bookingOpenHour: settings.bookingOpenHour,
    bookingOpenMinute: settings.bookingOpenMinute,
    pnrAutoSyncEnabled: settings.pnrAutoSyncEnabled,
    pnrSyncIntervalMinutes: settings.pnrSyncIntervalMinutes,
    smtpConfigured: Boolean(settings.smtpUrl || process.env.SMTP_URL),
    discordConfigured: Boolean(settings.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL),
    emailFrom: settings.emailFrom ?? process.env.EMAIL_FROM ?? "",
  };
}
