import { NextResponse } from "next/server";
import { analytics, journeys } from "@/lib/seed-data";

export async function GET() {
  const totalTrips = journeys.length;
  const bookedTrips = journeys.filter((journey) =>
    ["BOOKED", "CONFIRMED", "RAC", "WAITLISTED", "COMPLETED"].includes(journey.status),
  ).length;
  const waitlistedTrips = journeys.filter((journey) => journey.status === "WAITLISTED").length;
  const spend = journeys.reduce((sum, journey) => sum + (journey.farePaid ?? 0), 0);

  return NextResponse.json({
    data: {
      monthly: analytics,
      totals: {
        totalTrips,
        bookedTrips,
        waitlistedTrips,
        bookingSuccessRate: Math.round((bookedTrips / totalTrips) * 100),
        spend,
      },
    },
  });
}
