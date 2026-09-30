import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import type { Preferences } from "@/lib/workspace-types";

export async function getPreferences(userId: string): Promise<Preferences> {
  const [user, settings] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: userId } }), getAppSettings()]);
  return {
    name: user.name ?? "", email: user.email, role: user.role, timeZone: user.timeZone,
    weekendDays: user.weekendDays, calendarWeekStartsOn: user.calendarWeekStartsOn, defaultWeekStart: settings.calendarWeekStartsOn,
    defaultEmail: user.defaultEmail, defaultDiscord: user.defaultDiscord, defaultInApp: user.defaultInApp,
    available: { email: settings.reminderEmailEnabled, discord: settings.reminderDiscordEnabled, inApp: settings.reminderInAppEnabled },
    emailConfigured: Boolean(settings.smtpUrl || process.env.SMTP_URL),
    discordConfigured: Boolean(user.discordWebhookUrl || (user.role === "ADMIN" && (settings.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL))),
    discordStored: Boolean(user.discordWebhookUrl),
    bookingWindowDays: settings.bookingWindowDays, bookingOpenHour: settings.bookingOpenHour, bookingOpenMinute: settings.bookingOpenMinute,
    reminderSevenDaysEnabled: settings.reminderSevenDaysEnabled, reminderOneDayEnabled: settings.reminderOneDayEnabled, reminderBookingOpenEnabled: settings.reminderBookingOpenEnabled,
    pnrConfigured: Boolean(settings.pnrProviderUrl || process.env.PNR_PROVIDER_URL),
  };
}
