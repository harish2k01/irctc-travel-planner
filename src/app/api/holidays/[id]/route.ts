import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  if (!hasDatabase()) {
    return NextResponse.json({ data: { id }, source: "preview" });
  }

  await prisma.holiday.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ data: { id }, source: "database" });
}
