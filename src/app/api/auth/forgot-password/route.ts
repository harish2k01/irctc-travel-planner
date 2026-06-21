import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import { generateTemporaryPassword, hashPassword } from "@/lib/passwords";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return NextResponse.json({
      data: { ok: true },
      message: "If that account exists, a reset email has been sent.",
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  const mail = await sendPasswordResetEmail(user.email, temporaryPassword);

  if (!mail.sent) {
    return NextResponse.json(
      { error: "Password reset email is not configured. Contact an administrator." },
      { status: 503 },
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        mustResetPassword: true,
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    data: { ok: true },
    message: "If that account exists, a reset email has been sent.",
  });
}
