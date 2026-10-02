import { createHash, randomBytes, randomUUID } from "crypto";
import type { AccountTokenType,Prisma } from "@prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccountToken(userId: string, type: AccountTokenType, ttlMinutes: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    await tx.accountToken.deleteMany({ where: { userId, type, usedAt: null } });
    await tx.accountToken.create({
      data: { id: randomUUID(), userId, type, tokenHash: hashToken(token), expiresAt },
    });
  });
  return { token, expiresAt };
}

export async function consumeAccountToken(token: string, type: AccountTokenType,tx:Prisma.TransactionClient) {
  const candidate=await tx.accountToken.findUnique({where:{tokenHash:hashToken(token)},select:{userId:true}});
  if(!candidate)throw new ApiError(400,"This link is invalid or has expired.","INVALID_TOKEN");
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${candidate.userId} FOR UPDATE`;
  const record = await tx.accountToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date() || !record.user.isActive) {
    throw new ApiError(400, "This link is invalid or has expired.", "INVALID_TOKEN");
  }

  const updated = await tx.accountToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) throw new ApiError(400, "This link has already been used.", "INVALID_TOKEN");
  return record.user;
}
