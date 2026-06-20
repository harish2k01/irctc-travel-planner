import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";

const resetSchema = z.object({
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = resetSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      mustResetPassword: false,
    },
  });

  return NextResponse.json({ data: { ok: true } });
}
