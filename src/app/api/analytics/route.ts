import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({
      data: {
        monthly: [],
        totals: {
          totalTrips: 0,
          bookedTrips: 0,
          waitlistedTrips: 0,
          bookingSuccessRate: 0,
        },
      },
      source: "empty",
    });
  }

  const user = await requireUser();
  const journeys = await prisma.journey.findMany({ where: { userId: user.id }, orderBy: { travelDate: "asc" } });
  const totalTrips = journeys.length;
  const bookedTrips = journeys.filter((journey) =>
    ["BOOKED", "CONFIRMED", "RAC", "WAITLISTED", "COMPLETED"].includes(journey.status),
  ).length;
  const waitlistedTrips = journeys.filter((journey) => journey.status === "WAITLISTED").length;
  const monthly = Array.from(
    journeys.reduce((map, journey) => {
      const month = journey.travelDate.toISOString().slice(0, 7);
      const item = map.get(month) ?? { month, trips: 0, waitlisted: 0 };
      item.trips += 1;
      item.waitlisted += ["WAITLISTED", "RAC"].includes(journey.status) ? 1 : 0;
      map.set(month, item);
      return map;
    }, new Map<string, { month: string; trips: number; waitlisted: number }>()),
  ).map(([, item]) => item);

  return NextResponse.json({
    data: {
      monthly,
      totals: {
        totalTrips,
        bookedTrips,
        waitlistedTrips,
        bookingSuccessRate: totalTrips > 0 ? Math.round((bookedTrips / totalTrips) * 100) : 0,
      },
    },
    source: "database",
  });
}
