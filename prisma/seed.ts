import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { buildJourneyReminders } from "../src/lib/dates";
import { holidays, journeys, routes, trains } from "../src/lib/seed-data";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });
const DEMO_USER_ID = "demo-user";
const INCLUDE_DEMO_JOURNEYS = process.env.INCLUDE_DEMO_JOURNEYS === "true";

function toDate(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

async function main() {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo@commuterail.in",
      name: "Demo Commuter",
    },
  });

  for (const route of routes) {
    await prisma.route.upsert({
      where: { id: route.id },
      update: route,
      create: {
        ...route,
        userId: DEMO_USER_ID,
      },
    });
  }

  for (const train of trains) {
    await prisma.train.upsert({
      where: { id: train.id },
      update: train,
      create: train,
    });
  }

  if (INCLUDE_DEMO_JOURNEYS) {
    for (const journey of journeys) {
      await prisma.journey.upsert({
        where: { id: journey.id },
        update: {
          status: journey.status,
          pnr: journey.pnr,
          coach: journey.coach,
          seat: journey.seat,
          bookingDate: journey.bookingDate ? toDate(journey.bookingDate) : null,
          farePaid: journey.farePaid,
          waitlistPosition: journey.waitlistPosition,
        },
        create: {
          id: journey.id,
          userId: DEMO_USER_ID,
          routeId: journey.routeId,
          trainId: journey.trainId,
          travelDate: toDate(journey.travelDate),
          bookingOpenDate: toDate(journey.bookingOpenDate),
          preferredClass: journey.preferredClass,
          direction: journey.direction,
          recurrence: journey.recurrence,
          status: journey.status,
          notes: journey.notes,
          pnr: journey.pnr,
          coach: journey.coach,
          seat: journey.seat,
          bookingDate: journey.bookingDate ? toDate(journey.bookingDate) : undefined,
          farePaid: journey.farePaid,
          waitlistPosition: journey.waitlistPosition,
        },
      });

      for (const reminder of buildJourneyReminders(journey)) {
        await prisma.journeyReminder.upsert({
          where: {
            journeyId_type: {
              journeyId: journey.id,
              type: reminder.type,
            },
          },
          update: { dueAt: toDate(reminder.dueDate) },
          create: {
            journeyId: journey.id,
            type: reminder.type,
            dueAt: toDate(reminder.dueDate),
          },
        });
      }
    }
  }

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: { id: holiday.id },
      update: {
        name: holiday.name,
        date: toDate(holiday.date),
        type: holiday.type,
        region: holiday.region,
      },
      create: {
        id: holiday.id,
        userId: holiday.type === "NATIONAL" || holiday.type === "STATE" ? null : DEMO_USER_ID,
        name: holiday.name,
        date: toDate(holiday.date),
        type: holiday.type,
        region: holiday.region,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
