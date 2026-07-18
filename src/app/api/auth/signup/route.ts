import { Prisma } from "@prisma/client";
import { z } from "zod";
import { passwordSchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, parseJson, routeError } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAppSettings } from "@/lib/settings";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email(), password: passwordSchema });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "auth:signup", 5, 60 * 60_000);
    const input = await parseJson(request, schema, 8_192);
    const [userCount, settings] = await Promise.all([prisma.user.count(), getAppSettings()]);
    if (userCount > 0 && !settings.allowSignups) throw new ApiError(403, "Public signups are disabled.", "SIGNUPS_DISABLED");
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: userCount === 0 ? "ADMIN" : "USER",
        emailVerifiedAt: new Date(),
      },
    });
    await createSession(user.id, request);
    await writeAudit({ actorId: user.id, action: "user.signed_up", targetType: "User", targetId: user.id, request });
    return Response.json({ data: { id: user.id, role: user.role } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeError(new ApiError(409, "An account already exists for this email.", "EMAIL_IN_USE"), request);
    }
    return routeError(error, request);
  }
}
