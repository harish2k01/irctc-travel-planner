import { NextResponse } from "next/server";
import { createJourneySchema, normalizeJourneyInput } from "@/lib/api-schemas";
import { buildJourneyReminders } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { journeys } from "@/lib/seed-data";

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
      data: process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" ? journeys : [],
      source: "seed",
    });
  }

  const data = await prisma.journey.findMany({
    where: { userId: DEMO_USER_ID },
    include: { route: true, train: true, reminders: true, attachments: true },
    orderBy: { travelDate: "asc" },
  });

  return NextResponse.json({ data, source: "database" });
}

export async function POST(request: Request) {
  const parsed = createJourneySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!hasDatabase()) {
    const journey = {
      id: `draft-${Date.now()}`,
      ...normalizeJourneyInput(parsed.data),
    };

    return NextResponse.json(
      {
        data: journey,
        reminders: buildJourneyReminders(journey),
        source: "preview",
      },
      { status: 201 },
    );
  }

  const normalized = normalizeJourneyInput(parsed.data);

  const data = await prisma.$transaction(async (tx) => {
    const journey = await tx.journey.create({
      data: {
        userId: DEMO_USER_ID,
        routeId: normalized.routeId,
        trainId: normalized.trainId,
        travelDate: toDate(normalized.travelDate),
        bookingOpenDate: toDate(normalized.bookingOpenDate),
        preferredClass: normalized.preferredClass,
        direction: normalized.direction,
        recurrence: normalized.recurrence,
        status: normalized.status,
        notes: normalized.notes,
      },
    });

    await tx.journeyReminder.createMany({
      data: buildJourneyReminders({
        ...normalized,
        id: journey.id,
      }).map((reminder) => ({
        journeyId: journey.id,
        type: reminder.type,
        dueAt: toDate(reminder.dueDate),
      })),
    });

    return journey;
  });

  return NextResponse.json({ data, source: "database" }, { status: 201 });
}
