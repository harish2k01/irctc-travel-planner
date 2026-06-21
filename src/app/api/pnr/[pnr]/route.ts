import { NextResponse } from "next/server";
import { z } from "zod";
import { journeyStatusSchema } from "@/lib/api-schemas";

const providerResponseSchema = z.object({
  trainNumber: z.string().max(12).optional(),
  trainName: z.string().max(120).optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredClass: z.string().max(12).optional(),
  sourceCode: z.string().max(16).optional(),
  sourceName: z.string().max(120).optional(),
  destinationCode: z.string().max(16).optional(),
  destinationName: z.string().max(120).optional(),
  status: journeyStatusSchema.optional(),
  coach: z.string().max(8).optional(),
  seat: z.string().max(12).optional(),
  waitlistPosition: z.number().int().positive().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) {
    return undefined;
  }

  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) {
    return iso;
  }

  const slash = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!slash) {
    return undefined;
  }

  const [, day, month, year] = slash;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeProviderPayload(payload: unknown) {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const train = (data.train && typeof data.train === "object" ? data.train : {}) as Record<string, unknown>;
  const journey = (data.journey && typeof data.journey === "object" ? data.journey : {}) as Record<string, unknown>;
  const boarding = (data.boardingStation && typeof data.boardingStation === "object" ? data.boardingStation : {}) as Record<string, unknown>;
  const destination = (data.destinationStation && typeof data.destinationStation === "object" ? data.destinationStation : {}) as Record<string, unknown>;
  const passengers = Array.isArray(data.passengers)
    ? data.passengers
    : Array.isArray(data.passenger)
      ? data.passenger
      : [];
  const firstPassenger = passengers[0] && typeof passengers[0] === "object" ? passengers[0] as Record<string, unknown> : {};
  const currentStatus = text(data.currentStatus) ?? text(firstPassenger.currentStatus) ?? text(firstPassenger.current_status);
  const coachSeat = currentStatus?.match(/\b([A-Z]{1,3}\d{0,2})\s+(\d{1,3})\b/i);

  return providerResponseSchema.parse({
    trainNumber: text(data.trainNumber) ?? text(data.train_number) ?? text(train.number) ?? text(train.trainNumber),
    trainName: text(data.trainName) ?? text(data.train_name) ?? text(train.name) ?? text(train.trainName),
    travelDate: dateOnly(data.dateOfJourney) ?? dateOnly(data.travelDate) ?? dateOnly(data.doj) ?? dateOnly(journey.date),
    preferredClass: text(data.class) ?? text(data.bookingClass) ?? text(data.journeyClass),
    sourceCode: text(data.sourceCode) ?? text(data.from) ?? text(boarding.code) ?? text(boarding.stationCode),
    sourceName: text(data.sourceName) ?? text(data.boardingStation) ?? text(boarding.name) ?? text(boarding.stationName),
    destinationCode: text(data.destinationCode) ?? text(data.to) ?? text(destination.code) ?? text(destination.stationCode),
    destinationName: text(data.destinationName) ?? text(data.destinationStation) ?? text(destination.name) ?? text(destination.stationName),
    status: normalizeStatus(currentStatus ?? text(data.status) ?? text(data.chartStatus)),
    coach: text(data.coach) ?? coachSeat?.[1],
    seat: text(data.seat) ?? text(data.berth) ?? coachSeat?.[2],
    bookingDate: dateOnly(data.bookingDate),
  });
}

function normalizeStatus(value?: string) {
  const normalized = value?.toUpperCase() ?? "";

  if (normalized.includes("CNF") || normalized.includes("CONFIRM")) return "CONFIRMED";
  if (normalized.includes("RAC")) return "RAC";
  if (normalized.includes("WL") || normalized.includes("WAIT")) return "WAITLISTED";
  if (normalized.includes("CANCEL")) return "CANCELLED";
  return undefined;
}

export async function GET(_request: Request, { params }: { params: Promise<{ pnr: string }> }) {
  const { pnr } = await params;

  if (!/^\d{10}$/.test(pnr)) {
    return NextResponse.json({ error: "PNR must be a 10 digit number." }, { status: 400 });
  }

  const providerUrl = process.env.PNR_PROVIDER_URL;

  if (!providerUrl) {
    return NextResponse.json(
      {
        error: "Ticket lookup is not connected yet. Configure PNR_PROVIDER_URL for automatic PNR status sync.",
      },
      { status: 501 },
    );
  }

  const url = new URL(providerUrl.replace("{pnr}", pnr));
  if (!providerUrl.includes("{pnr}")) {
    url.searchParams.set("pnr", pnr);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: process.env.PNR_PROVIDER_API_KEY
      ? {
          Authorization: `Bearer ${process.env.PNR_PROVIDER_API_KEY}`,
          "x-api-key": process.env.PNR_PROVIDER_API_KEY,
        }
      : undefined,
  });

  if (!response.ok) {
    return NextResponse.json({ error: "PNR provider request failed." }, { status: 502 });
  }

  try {
    const data = normalizeProviderPayload(await response.json());
    return NextResponse.json({ data, source: "provider" });
  } catch {
    return NextResponse.json({ error: "PNR provider response did not match the expected shape." }, { status: 502 });
  }
}
