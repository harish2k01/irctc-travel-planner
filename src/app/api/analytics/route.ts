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
          ticketsToBook: 0,
          bookedTrips: 0,
        },
      },
      source: "empty",
    });
  }

  const user = await requireUser();
  const journeys = await prisma.journey.findMany({ where: { userId: user.id }, orderBy: { travelDate: "asc" } });
  const totalTrips = journeys.length;
  const ticketsToBook = journeys.filter((journey) => ["PLANNED", "BOOKING_WINDOW_OPEN"].includes(journey.status)).length;
  const bookedTrips = journeys.filter((journey) => ["BOOKED", "CONFIRMED"].includes(journey.status)).length;
  const monthly = Array.from(
    journeys.reduce((map, journey) => {
      const month = journey.travelDate.toISOString().slice(0, 7);
      const item = map.get(month) ?? { month, trips: 0 };
      item.trips += 1;
      map.set(month, item);
      return map;
    }, new Map<string, { month: string; trips: number }>()),
  ).map(([, item]) => item);

  return NextResponse.json({
    data: {
      monthly,
      totals: {
        totalTrips,
        ticketsToBook,
        bookedTrips,
      },
    },
    source: "database",
  });
}
