import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!hasDatabase()) {
    return NextResponse.json({ data: { id }, source: "preview" });
  }

  await prisma.holiday.delete({ where: { id } });
  return NextResponse.json({ data: { id }, source: "database" });
}
