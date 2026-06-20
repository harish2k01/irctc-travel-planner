import { TravelPlannerApp } from "@/components/travel-planner-app";
import { toDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Holiday, Journey, Route, Train } from "@/lib/types";
import { holidays as seedHolidays, journeys as seedJourneys, routes as seedRoutes, trains as seedTrains } from "@/lib/seed-data";

const DEMO_USER_ID = "demo-user";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function loadInitialData(): Promise<{
  journeys: Journey[];
  routes: Route[];
  trains: Train[];
  holidays: Holiday[];
}> {
  if (!process.env.DATABASE_URL) {
    return {
      journeys: process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" ? seedJourneys : [],
      routes: seedRoutes,
      trains: seedTrains,
      holidays: process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" ? seedHolidays : [],
    };
  }

  const [dbJourneys, dbRoutes, dbTrains, dbHolidays] = await Promise.all([
    prisma.journey.findMany({
      where: { userId: DEMO_USER_ID },
      include: { route: true },
      orderBy: { travelDate: "asc" },
    }),
    prisma.route.findMany({ where: { userId: DEMO_USER_ID }, orderBy: { originCode: "asc" } }),
    prisma.train.findMany({ orderBy: { trainNumber: "asc" } }),
    prisma.holiday.findMany({
      where: { OR: [{ userId: DEMO_USER_ID }, { userId: null }] },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    journeys: dbJourneys.map((journey) => ({
      id: journey.id,
      routeId: journey.routeId,
      trainId: journey.trainId,
      travelDate: dateOnly(journey.travelDate),
      bookingOpenDate: dateOnly(journey.bookingOpenDate),
      preferredClass: journey.preferredClass,
      sourceCode: journey.sourceCode ?? journey.route.originCode,
      sourceName: journey.sourceName ?? journey.route.originName,
      destinationCode: journey.destinationCode ?? journey.route.destinationCode,
      destinationName: journey.destinationName ?? journey.route.destinationName,
      direction: journey.direction,
      recurrence: journey.recurrence,
      status: journey.status,
      notes: journey.notes ?? undefined,
      pnr: journey.pnr ?? undefined,
      coach: journey.coach ?? undefined,
      seat: journey.seat ?? undefined,
      bookingDate: journey.bookingDate ? dateOnly(journey.bookingDate) : undefined,
      farePaid: journey.farePaid ? Number(journey.farePaid) : undefined,
      waitlistPosition: journey.waitlistPosition ?? undefined,
    })),
    routes: dbRoutes.map((route) => ({
      id: route.id,
      originCode: route.originCode,
      originName: route.originName,
      destinationCode: route.destinationCode,
      destinationName: route.destinationName,
    })),
    trains: dbTrains.map((train) => ({
      id: train.id,
      routeId: train.routeId,
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      preferredClasses: train.preferredClasses,
    })),
    holidays: dbHolidays.map((holiday) => ({
      id: holiday.id,
      name: holiday.name,
      date: dateOnly(holiday.date),
      type: holiday.type,
      region: holiday.region ?? undefined,
    })),
  };
}

export default async function Home() {
  const { journeys, routes, trains, holidays } = await loadInitialData();

  return (
    <TravelPlannerApp
      initialJourneys={journeys}
      routes={routes}
      trains={trains}
      holidays={holidays}
      today={toDateOnly(new Date())}
    />
  );
}
