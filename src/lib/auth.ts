import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/http";
import { requestIpHash } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "irctc_session";
const SESSION_DAYS = 14;

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
  mustResetPassword: boolean;
  timeZone: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, request?: Request) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipHash: request ? requestIpHash(request) : undefined,
      userAgent: request?.headers.get("user-agent")?.slice(0, 500),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!process.env.DATABASE_URL) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > 15 * 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? undefined,
    role: session.user.role,
    mustResetPassword: session.user.mustResetPassword,
    timeZone: session.user.timeZone,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Sign in to continue.", "UNAUTHENTICATED");
  if (user.mustResetPassword) throw new ApiError(403, "Reset your password to continue.", "PASSWORD_RESET_REQUIRED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Administrator access is required.", "FORBIDDEN");
  return user;
}

export function assertCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided || expected.length !== provided.length) {
    throw new ApiError(401, "Invalid worker credentials.", "UNAUTHENTICATED");
  }
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  if (!expectedHash.equals(providedHash)) throw new ApiError(401, "Invalid worker credentials.", "UNAUTHENTICATED");
}
