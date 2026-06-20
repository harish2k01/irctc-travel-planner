import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendTemporaryPasswordEmail } from "@/lib/mail";
import { generateTemporaryPassword, hashPassword } from "@/lib/passwords";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  role: z.enum(["ADMIN", "USER"]),
});

export async function GET() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustResetPassword: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: users });
}

export async function POST(request: Request) {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash: await hashPassword(temporaryPassword),
      mustResetPassword: true,
    },
  });

  let mail: { sent: boolean; reason?: string } = { sent: false };
  try {
    mail = await sendTemporaryPasswordEmail(user.email, temporaryPassword);
  } catch (error) {
    mail = { sent: false, reason: error instanceof Error ? error.message : "Mail failed." };
  }

  return NextResponse.json(
    {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        mustResetPassword: user.mustResetPassword,
      },
      mail,
      temporaryPassword: mail.sent ? undefined : temporaryPassword,
    },
    { status: 201 },
  );
}
