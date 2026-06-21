import { AuthScreen } from "@/components/auth-screen";
import { TravelPlannerApp } from "@/components/travel-planner-app";
import { getCurrentUser } from "@/lib/auth";
import { toDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import type { Holiday, Journey, Route, Train } from "@/lib/types";

export const dynamic = "force-dynamic";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

type InitialData = {
  journeys: Journey[];
  routes: Route[];
  trains: Train[];
  holidays: Holiday[];
};

async function loadInitialData(userId: string): Promise<InitialData> {
  const [dbJourneys, dbRoutes, dbTrains, dbHolidays] = await Promise.all([
    prisma.journey.findMany({
      where: { userId },
      include: { route: true },
      orderBy: { travelDate: "asc" },
    }),
    prisma.route.findMany({ where: { userId }, orderBy: { originCode: "asc" } }),
    prisma.train.findMany({ where: { route: { userId } }, orderBy: { trainNumber: "asc" } }),
    prisma.holiday.findMany({
      where: { userId },
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
  if (!process.env.DATABASE_URL) {
    return <AuthScreen mode="missingDatabase" allowSignups={false} />;
  }

  const [currentUser, userCount, settings] = await Promise.all([
    getCurrentUser(),
    prisma.user.count(),
    getAppSettings(),
  ]);

  if (userCount === 0) {
    return <AuthScreen mode="firstSignup" allowSignups />;
  }

  if (!currentUser) {
    return <AuthScreen mode="login" allowSignups={settings.allowSignups} />;
  }

  if (currentUser.mustResetPassword) {
    return <AuthScreen mode="resetPassword" allowSignups={settings.allowSignups} />;
  }

  const [{ journeys, routes, trains, holidays }, users] = await Promise.all([
    loadInitialData(currentUser.id),
    currentUser.role === "ADMIN"
      ? prisma.user.findMany({
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            mustResetPassword: true,
            createdAt: true,
          },
        })
      : [],
  ]);

  return (
    <TravelPlannerApp
      currentUser={currentUser}
      initialSettings={{ allowSignups: settings.allowSignups }}
      initialUsers={users.map((user) => ({
        ...user,
        name: user.name ?? undefined,
        createdAt: user.createdAt.toISOString(),
      }))}
      initialJourneys={journeys}
      routes={routes}
      trains={trains}
      holidays={holidays}
      today={toDateOnly(new Date())}
    />
  );
}
