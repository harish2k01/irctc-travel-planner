import { createHash, randomBytes, randomUUID } from "crypto";
import type { AccountTokenType } from "@prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccountToken(userId: string, type: AccountTokenType, ttlMinutes: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await prisma.$transaction([
    prisma.accountToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.accountToken.create({
      data: { id: randomUUID(), userId, type, tokenHash: hashToken(token), expiresAt },
    }),
  ]);
  return { token, expiresAt };
}

export async function consumeAccountToken(token: string, type: AccountTokenType) {
  const record = await prisma.accountToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date() || !record.user.isActive) {
    throw new ApiError(400, "This link is invalid or has expired.", "INVALID_TOKEN");
  }

  const updated = await prisma.accountToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) throw new ApiError(400, "This link has already been used.", "INVALID_TOKEN");
  return record.user;
}
