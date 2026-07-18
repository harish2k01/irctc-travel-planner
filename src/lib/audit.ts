import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requestIpHash } from "@/lib/rate-limit";

export async function writeAudit(input: {
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  await prisma.auditLog.create({
    data: {
      id: randomUUID(),
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      ipHash: input.request ? requestIpHash(input.request) : undefined,
    },
  });
}
