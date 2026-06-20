import { NextResponse } from "next/server";
import { createHolidaySchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function toDate(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ data: [], source: "empty" });
  }

  const user = await requireUser();
  const data = await prisma.holiday.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ data, source: "database" });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = createHolidaySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      { data: { id: `holiday-${Date.now()}`, ...parsed.data }, source: "preview" },
      { status: 201 },
    );
  }

  const data = await prisma.holiday.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      date: toDate(parsed.data.date),
      type: parsed.data.type,
      region: parsed.data.region,
    },
  });

  return NextResponse.json({ data, source: "database" }, { status: 201 });
}
