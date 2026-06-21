import { NextResponse } from "next/server";
import { createJourneySchema, normalizeJourneyInput } from "@/lib/api-schemas";
import { requireUser } from "@/lib/auth";
import { buildJourneyReminders } from "@/lib/dates";
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
  const data = await prisma.journey.findMany({
    where: { userId: user.id },
    include: { route: true, train: true, reminders: true, attachments: true },
    orderBy: { travelDate: "asc" },
  });

  return NextResponse.json({ data, source: "database" });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = createJourneySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!hasDatabase()) {
    const normalized = normalizeJourneyInput(parsed.data);
    const journey = {
      id: `draft-${Date.now()}`,
      ...normalized,
      routeId: normalized.routeId ?? "preview-route",
      trainId: normalized.trainId ?? normalized.trainNumber ?? "preview-train",
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
    let routeId = normalized.routeId;
    let trainId = normalized.trainId;

    if (trainId) {
      const existingTrain = await tx.train.findFirst({
        where: {
          id: trainId,
          route: { userId: user.id },
        },
        include: { route: true },
      });

      if (!existingTrain) {
        return null;
      }

      routeId = existingTrain.routeId;
    } else {
      const sourceCode = normalized.sourceCode?.trim().toUpperCase();
      const destinationCode = normalized.destinationCode?.trim().toUpperCase();
      const trainNumber = normalized.trainNumber?.trim() || `PNR-${normalized.pnr.slice(-4)}`;
      const trainName = normalized.trainName?.trim() || "Pending train details";

      if (!sourceCode || !destinationCode) {
        return null;
      }

      const route =
        (await tx.route.findFirst({
          where: {
            userId: user.id,
            originCode: sourceCode,
            destinationCode,
          },
        })) ??
        (await tx.route.create({
          data: {
            userId: user.id,
            originCode: sourceCode,
            originName: normalized.sourceName?.trim() || sourceCode,
            destinationCode,
            destinationName: normalized.destinationName?.trim() || destinationCode,
          },
        }));

      routeId = route.id;

      const train =
        (await tx.train.findFirst({
          where: {
            routeId,
            trainNumber,
          },
        })) ??
        (await tx.train.create({
          data: {
            routeId,
            trainNumber,
            trainName,
            preferredClasses: [normalized.preferredClass],
          },
        }));

      trainId = train.id;
    }

    const journey = await tx.journey.create({
      data: {
        userId: user.id,
        routeId,
        trainId,
        travelDate: toDate(normalized.travelDate),
        bookingOpenDate: toDate(normalized.bookingOpenDate),
        preferredClass: normalized.preferredClass,
        sourceCode: normalized.sourceCode,
        sourceName: normalized.sourceName,
        destinationCode: normalized.destinationCode,
        destinationName: normalized.destinationName,
        direction: normalized.direction,
        recurrence: normalized.recurrence,
        status: normalized.status,
        notes: normalized.notes,
        pnr: normalized.pnr,
        remindersEnabled: normalized.remindersEnabled ?? true,
        reminderEmailEnabled: normalized.reminderEmailEnabled ?? true,
        reminderDiscordEnabled: normalized.reminderDiscordEnabled ?? false,
        reminderInAppEnabled: normalized.reminderInAppEnabled ?? true,
      },
    });

    if (journey.remindersEnabled && (journey.reminderEmailEnabled || journey.reminderDiscordEnabled || journey.reminderInAppEnabled)) {
      await tx.journeyReminder.createMany({
        data: buildJourneyReminders({
          ...normalized,
          id: journey.id,
          routeId,
          trainId,
        }).map((reminder) => ({
          journeyId: journey.id,
          type: reminder.type,
          dueAt: toDate(reminder.dueDate),
        })),
      });
    }

    return journey;
  });

  if (!data) {
    return NextResponse.json({ error: "Train and route details are required." }, { status: 400 });
  }

  return NextResponse.json({ data, source: "database" }, { status: 201 });
}
