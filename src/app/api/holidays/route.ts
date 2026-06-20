import { NextResponse } from "next/server";
import { createHolidaySchema } from "@/lib/api-schemas";
import { prisma } from "@/lib/db";
import { holidays } from "@/lib/seed-data";

const DEMO_USER_ID = "demo-user";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function toDate(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({
      data: process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" ? holidays : [],
      source: "seed",
    });
  }

  const data = await prisma.holiday.findMany({
    where: {
      OR: [{ userId: DEMO_USER_ID }, { userId: null }],
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ data, source: "database" });
}

export async function POST(request: Request) {
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
      userId: null,
      name: parsed.data.name,
      date: toDate(parsed.data.date),
      type: parsed.data.type,
      region: parsed.data.region,
    },
  });

  return NextResponse.json({ data, source: "database" }, { status: 201 });
}
