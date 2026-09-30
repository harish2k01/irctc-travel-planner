import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { sendDiscordMessage } from "@/lib/delivery";
import { sendTestEmail } from "@/lib/mail";
import { getDeliveryConfiguration } from "@/lib/settings";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, "delivery:test", 3, 3600000, user.id);
    const { channel } = await parseJson(request, z.object({ channel: z.enum(["email", "discord"]) }));
    const config = await getDeliveryConfiguration();
    if (channel === "email") {
      if (!config.reminderEmailEnabled) throw new ApiError(400, "Email is disabled by the administrator.", "DISABLED");
      const result = await sendTestEmail(user.email);
      if (!result.sent) throw new ApiError(400, result.reason, "NOT_CONFIGURED");
    } else {
      if (!config.reminderDiscordEnabled) throw new ApiError(400, "Discord is disabled by the administrator.", "DISABLED");
      const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const url = decryptSecret(account.discordWebhookUrl) ?? (user.role === "ADMIN" ? config.discordWebhookUrl : undefined);
      if (!url) throw new ApiError(400, "Save a Discord webhook first.", "NOT_CONFIGURED");
      try { await sendDiscordMessage(url, "Your IRCTC Travel Planner test reminder. Discord delivery is working."); }
      catch { throw new ApiError(502, "Discord did not accept the test. Check the saved webhook.", "DELIVERY_FAILED"); }
    }
    await writeAudit({ actorId: user.id, action: "delivery.tested", targetType: "User", targetId: user.id, request, metadata: { channel } });
    return jsonData({ message: "Test accepted by the delivery service." });
  } catch (error) { return routeError(error, request); }
}
