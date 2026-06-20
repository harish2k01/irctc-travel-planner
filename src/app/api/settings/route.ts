import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";

const settingsSchema = z.object({
  allowSignups: z.boolean(),
});

export async function GET() {
  await requireAdmin();
  const settings = await getAppSettings();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.appSettings.update({
    where: { id: "global" },
    data: { allowSignups: parsed.data.allowSignups },
  });

  return NextResponse.json({ data: settings });
}
