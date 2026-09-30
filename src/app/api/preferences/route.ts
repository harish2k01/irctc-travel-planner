import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { discordUrlSchema } from "@/lib/delivery";
import { assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { getPreferences } from "@/lib/preferences";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  timeZone: z.string().max(80).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone.").optional(),
  weekendDays: z.array(z.number().int().min(0).max(6)).max(7).transform((days) => [...new Set(days)]).optional(),
  calendarWeekStartsOn: z.union([z.literal(0), z.literal(1), z.null()]).optional(),
  defaultEmail: z.boolean().optional(), defaultDiscord: z.boolean().optional(), defaultInApp: z.boolean().optional(),
  discordWebhookUrl: discordUrlSchema.nullable().optional(),
});
export async function GET(request: Request) {
  try { return jsonData(await getPreferences((await requireUser()).id)); } catch (error) { return routeError(error, request); }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await parseJson(request, schema);
    await prisma.user.update({ where: { id: user.id }, data: { ...input,
      discordWebhookUrl: input.discordWebhookUrl === undefined ? undefined : input.discordWebhookUrl ? encryptSecret(input.discordWebhookUrl) : null,
    } });
    await writeAudit({ actorId: user.id, action: "preferences.updated", targetType: "User", targetId: user.id, request, metadata: { fields: Object.keys(input) } });
    return jsonData(await getPreferences(user.id));
  } catch (error) { return routeError(error, request); }
}
