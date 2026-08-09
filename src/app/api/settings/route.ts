import { z } from "zod";
import { calendarWeekStartsOnSchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { getAppSettings, serializeAdminSettings } from "@/lib/settings";

const settingsSchema = z.object({
  allowSignups: z.boolean().optional(),
  reminderEmailEnabled: z.boolean().optional(),
  reminderDiscordEnabled: z.boolean().optional(),
  reminderInAppEnabled: z.boolean().optional(),
  reminderSevenDaysEnabled: z.boolean().optional(),
  reminderOneDayEnabled: z.boolean().optional(),
  reminderBookingOpenEnabled: z.boolean().optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
  bookingOpenHour: z.number().int().min(0).max(23).optional(),
  bookingOpenMinute: z.number().int().min(0).max(59).optional(),
  calendarWeekStartsOn: calendarWeekStartsOnSchema.optional(),
  pnrAutoSyncEnabled: z.boolean().optional(),
  pnrSyncIntervalMinutes: z.number().int().min(15).max(10_080).optional(),
  pnrProviderUrl: z.union([z.string().url().max(1_000), z.literal(""), z.null()]).optional(),
  pnrProviderApiKey: z.union([z.string().trim().max(1_000), z.literal(""), z.null()]).optional(),
  smtpUrl: z.union([z.string().url().max(1_000), z.literal(""), z.null()]).optional(),
  emailFrom: z.union([z.string().trim().max(200), z.literal(""), z.null()]).optional(),
  discordWebhookUrl: z.union([z.string().url().max(1_000), z.literal(""), z.null()]).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    return jsonData(serializeAdminSettings(await getAppSettings()));
  } catch (error) {
    return routeError(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const input = await parseJson(request, settingsSchema);
    const data = {
      ...input,
      pnrProviderUrl: input.pnrProviderUrl === undefined
        ? undefined
        : input.pnrProviderUrl ? encryptSecret(input.pnrProviderUrl) : null,
      pnrProviderApiKey: input.pnrProviderApiKey === undefined
        ? undefined
        : input.pnrProviderApiKey ? encryptSecret(input.pnrProviderApiKey) : null,
      smtpUrl: input.smtpUrl === undefined ? undefined : input.smtpUrl ? encryptSecret(input.smtpUrl) : null,
      discordWebhookUrl: input.discordWebhookUrl === undefined
        ? undefined
        : input.discordWebhookUrl ? encryptSecret(input.discordWebhookUrl) : null,
      emailFrom: input.emailFrom === undefined ? undefined : input.emailFrom || null,
    };
    const settings = await prisma.appSettings.update({ where: { id: "global" }, data });
    await writeAudit({
      actorId: admin.id,
      action: "settings.updated",
      targetType: "AppSettings",
      targetId: settings.id,
      metadata: { fields: Object.keys(input) },
      request,
    });
    return jsonData(serializeAdminSettings(settings));
  } catch (error) {
    return routeError(error, request);
  }
}
