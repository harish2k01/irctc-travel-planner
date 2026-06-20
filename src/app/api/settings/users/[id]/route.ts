import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateUserSchema = z.object({
  name: z.string().max(120).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAdmin();
  const { id } = await params;
  const parsed = updateUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (id === currentUser.id && parsed.data.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
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

  return NextResponse.json({ data: user });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAdmin();
  const { id } = await params;

  if (id === currentUser.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
