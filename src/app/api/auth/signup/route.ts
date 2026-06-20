import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { provisionUserCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { getAppSettings } from "@/lib/settings";

const signupSchema = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userCount = await prisma.user.count();
  const settings = await getAppSettings();

  if (userCount > 0 && !settings.allowSignups) {
    return NextResponse.json({ error: "Signups are disabled." }, { status: 403 });
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      role: userCount === 0 ? "ADMIN" : "USER",
      mustResetPassword: false,
    },
  });

  await provisionUserCatalog(user.id);
  await createSession(user.id);

  return NextResponse.json({ data: { id: user.id, role: user.role } }, { status: 201 });
}
