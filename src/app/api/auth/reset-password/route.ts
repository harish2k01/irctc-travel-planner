import { z } from "zod";
import { passwordSchema } from "@/lib/api-schemas";
import { consumeAccountToken } from "@/lib/account-tokens";
import { createSession, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  password: passwordSchema,
  token: z.string().min(20).optional(),
  type: z.enum(["invitation", "reset"]).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "auth:reset", 10, 60 * 60_000);
    const input = await parseJson(request, schema, 4_096);
    let userId: string;
    if (input.token && input.type) {
      const user = await consumeAccountToken(input.token, input.type === "invitation" ? "INVITATION" : "PASSWORD_RESET");
      userId = user.id;
    } else {
      const current = await getCurrentUser();
      if (!current?.mustResetPassword) throw new ApiError(400, "A valid reset link is required.", "INVALID_TOKEN");
      userId = current.id;
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(input.password), mustResetPassword: false, emailVerifiedAt: new Date() },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    await createSession(userId, request);
    return jsonData({ ok: true });
  } catch (error) {
    return routeError(error, request);
  }
}
