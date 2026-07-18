import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createAccountToken } from "@/lib/account-tokens";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { sendInvitationEmail } from "@/lib/mail";
import { getDeliveryConfiguration } from "@/lib/settings";

const schema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(120),
  role: z.enum(["ADMIN", "USER"]),
});

function serializeUser(user: { id: string; email: string; name: string | null; role: "ADMIN" | "USER"; isActive: boolean; createdAt: Date }) {
  return { ...user, name: user.name ?? undefined, createdAt: user.createdAt.toISOString() };
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      take: 500,
    });
    return jsonData(users.map(serializeUser));
  } catch (error) {
    return routeError(error, request);
  }
}

export async function POST(request: Request) {
  let createdUserId: string | undefined;
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const input = await parseJson(request, schema);
    const delivery = await getDeliveryConfiguration();
    if (!delivery.smtpUrl) throw new ApiError(503, "Configure email delivery before inviting users.", "EMAIL_NOT_CONFIGURED");
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        passwordHash: null,
        mustResetPassword: true,
      },
    });
    createdUserId = user.id;
    const { token } = await createAccountToken(user.id, "INVITATION", 24 * 60);
    const mail = await sendInvitationEmail(user.email, token);
    if (!mail.sent) throw new ApiError(503, mail.reason, "EMAIL_DELIVERY_FAILED");
    await writeAudit({ actorId: admin.id, action: "user.invited", targetType: "User", targetId: user.id, request });
    return Response.json({ data: serializeUser(user) }, { status: 201 });
  } catch (error) {
    if (createdUserId) await prisma.user.deleteMany({ where: { id: createdUserId, passwordHash: null } });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeError(new ApiError(409, "A user already exists for this email.", "EMAIL_IN_USE"), request);
    }
    return routeError(error, request);
  }
}
