import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { verifyPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, schema, 4_096);
    const email = input.email.toLowerCase();
    await enforceRateLimit(request, "auth:login:ip", 10, 15 * 60_000);
    await enforceRateLimit(request, "auth:login:account", 10, 15 * 60_000, email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }
    await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } });
    await createSession(user.id, request);
    await writeAudit({ actorId: user.id, action: "auth.login", targetType: "User", targetId: user.id, request });
    return jsonData({ id: user.id, role: user.role, mustResetPassword: user.mustResetPassword });
  } catch (error) {
    return routeError(error, request);
  }
}
