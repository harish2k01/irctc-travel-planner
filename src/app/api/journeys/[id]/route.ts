import { NextResponse } from "next/server";
import { updateJourneyStatusSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/auth";
import { buildJourneyReminders, calculateBookingOpenDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function toDate(dateOnly?: string) {
  return dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`) : undefined;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const parsed = updateJourneyStatusSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bookingOpenDate = parsed.data.travelDate ? calculateBookingOpenDate(parsed.data.travelDate) : undefined;

  if (!hasDatabase()) {
    return NextResponse.json({
      data: { id, ...parsed.data, ...(bookingOpenDate ? { bookingOpenDate } : {}) },
      source: "preview",
    });
  }

  const existing = await prisma.journey.findFirst({ where: { id, userId: user.id } });

  if (!existing) {
    return NextResponse.json({ error: "Journey not found." }, { status: 404 });
  }

  const data = await prisma.$transaction(async (tx) => {
    if (parsed.data.trainNumber || parsed.data.trainName) {
      const currentTrain = await tx.train.findFirst({
        where: {
          id: existing.trainId,
          route: { userId: user.id },
        },
      });

      if (currentTrain) {
        await tx.train.update({
          where: { id: currentTrain.id },
          data: {
            trainNumber: parsed.data.trainNumber ?? currentTrain.trainNumber,
            trainName: parsed.data.trainName ?? currentTrain.trainName,
            preferredClasses: parsed.data.preferredClass
              ? Array.from(new Set([parsed.data.preferredClass, ...currentTrain.preferredClasses]))
              : currentTrain.preferredClasses,
          },
        });
      }
    }

    const journeyPatch = { ...parsed.data };
    delete journeyPatch.trainNumber;
    delete journeyPatch.trainName;
    const journey = await tx.journey.update({
      where: { id },
      data: {
        ...journeyPatch,
        travelDate: toDate(parsed.data.travelDate),
        bookingOpenDate: toDate(bookingOpenDate),
        bookingDate: toDate(parsed.data.bookingDate),
      },
    });

    if (
      bookingOpenDate ||
      parsed.data.remindersEnabled !== undefined ||
      parsed.data.reminderEmailEnabled !== undefined ||
      parsed.data.reminderDiscordEnabled !== undefined ||
      parsed.data.reminderInAppEnabled !== undefined
    ) {
      await tx.journeyReminder.deleteMany({ where: { journeyId: id } });
      if (journey.remindersEnabled && (journey.reminderEmailEnabled || journey.reminderDiscordEnabled || journey.reminderInAppEnabled)) {
        const nextBookingOpenDate = bookingOpenDate ?? journey.bookingOpenDate.toISOString().slice(0, 10);
        await tx.journeyReminder.createMany({
          data: buildJourneyReminders({
            id,
            routeId: journey.routeId,
            trainId: journey.trainId,
            travelDate: parsed.data.travelDate ?? journey.travelDate.toISOString().slice(0, 10),
            bookingOpenDate: nextBookingOpenDate,
            preferredClass: journey.preferredClass,
            direction: journey.direction,
            recurrence: journey.recurrence,
            status: journey.status,
          }).map((reminder) => ({
            journeyId: id,
            type: reminder.type,
            dueAt: toDate(reminder.dueDate) as Date,
          })),
        });
      }
    }

    return journey;
  });

  return NextResponse.json({ data, source: "database" });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  if (!hasDatabase()) {
    return NextResponse.json({ data: { id }, source: "preview" });
  }

  await prisma.journey.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ data: { id }, source: "database" });
}
