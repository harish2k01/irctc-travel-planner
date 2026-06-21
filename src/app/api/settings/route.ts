import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";

const settingsSchema = z.object({
  allowSignups: z.boolean().optional(),
  reminderEmailEnabled: z.boolean().optional(),
  reminderDiscordEnabled: z.boolean().optional(),
  reminderInAppEnabled: z.boolean().optional(),
  reminderSevenDaysEnabled: z.boolean().optional(),
  reminderOneDayEnabled: z.boolean().optional(),
  reminderBookingOpenEnabled: z.boolean().optional(),
  smtpUrl: z.string().max(500).or(z.literal("")).optional(),
  emailFrom: z.string().max(200).or(z.literal("")).optional(),
  discordWebhookUrl: z.string().url().or(z.literal("")).optional(),
});

export async function GET() {
  await requireAdmin();
  const settings = await getAppSettings();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.appSettings.update({
    where: { id: "global" },
    data: {
      ...parsed.data,
      smtpUrl: parsed.data.smtpUrl === "" ? null : parsed.data.smtpUrl,
      emailFrom: parsed.data.emailFrom === "" ? null : parsed.data.emailFrom,
      discordWebhookUrl: parsed.data.discordWebhookUrl === "" ? null : parsed.data.discordWebhookUrl,
    },
  });

  return NextResponse.json({ data: settings });
}
