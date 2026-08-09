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

type PnrConfigurationSettings = {
  pnrProviderUrl: string | null;
  pnrProviderApiKey: string | null;
};

type PnrEnvironment = Record<string, string | undefined> & {
  PNR_PROVIDER_URL?: string;
  PNR_PROVIDER_API_KEY?: string;
};

export function resolvePnrConfiguration(
  settings: PnrConfigurationSettings,
  environment: PnrEnvironment = process.env as PnrEnvironment,
) {
  return {
    providerUrl: decryptSecret(settings.pnrProviderUrl) ?? environment.PNR_PROVIDER_URL,
    apiKey: decryptSecret(settings.pnrProviderApiKey) ?? environment.PNR_PROVIDER_API_KEY,
  };
}

export async function getPnrConfiguration() {
  return resolvePnrConfiguration(await getAppSettings());
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
    calendarWeekStartsOn: settings.calendarWeekStartsOn === 1 ? 1 as const : 0 as const,
    pnrAutoSyncEnabled: settings.pnrAutoSyncEnabled,
    pnrSyncIntervalMinutes: settings.pnrSyncIntervalMinutes,
    pnrProviderConfigured: Boolean(settings.pnrProviderUrl || process.env.PNR_PROVIDER_URL),
    pnrProviderStored: Boolean(settings.pnrProviderUrl),
    pnrProviderApiKeyConfigured: Boolean(settings.pnrProviderApiKey || process.env.PNR_PROVIDER_API_KEY),
    pnrProviderApiKeyStored: Boolean(settings.pnrProviderApiKey),
    smtpConfigured: Boolean(settings.smtpUrl || process.env.SMTP_URL),
    discordConfigured: Boolean(settings.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL),
    emailFrom: settings.emailFrom ?? process.env.EMAIL_FROM ?? "",
  };
}
