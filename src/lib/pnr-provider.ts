import { z } from "zod";
import { ApiError } from "@/lib/http";
import { fetchExternal, limitedResponseText, validateExternalUrl } from "@/lib/safe-fetch";

const normalizedSchema = z.object({
  trainNumber: z.string().max(20).optional(),
  trainName: z.string().max(160).optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookedClass: z.string().max(20).optional(),
  sourceCode: z.string().max(20).optional(),
  sourceName: z.string().max(160).optional(),
  destinationCode: z.string().max(20).optional(),
  destinationName: z.string().max(160).optional(),
  providerStatus: z.string().max(120).optional(),
  coach: z.string().max(20).optional(),
  seat: z.string().max(40).optional(),
});

export type PnrProviderResult = z.infer<typeof normalizedSchema>;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function object(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) return undefined;
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const match = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : undefined;
}

export function normalizePnrPayload(payload: unknown): PnrProviderResult {
  const root = object(payload);
  const data = object(root.data ?? root.result ?? root);
  const train = object(data.train);
  const boarding = object(data.boardingStation ?? data.fromStation);
  const destination = object(data.destinationStation ?? data.toStation);
  const passengers = Array.isArray(data.passengers) ? data.passengers : Array.isArray(data.passenger) ? data.passenger : [];
  const passenger = object(passengers[0]);
  const currentStatus = text(data.currentStatus) ?? text(passenger.currentStatus) ?? text(passenger.current_status);
  const coachSeat = currentStatus?.match(/\b([A-Z]{1,3}\d{0,2})[\s/-]+(\d{1,3})\b/i);

  return normalizedSchema.parse({
    trainNumber: text(data.trainNumber) ?? text(data.train_number) ?? text(train.number) ?? text(train.trainNumber),
    trainName: text(data.trainName) ?? text(data.train_name) ?? text(train.name) ?? text(train.trainName),
    travelDate: dateOnly(data.dateOfJourney ?? data.travelDate ?? data.doj),
    bookedClass: text(data.class) ?? text(data.bookingClass) ?? text(data.journeyClass),
    sourceCode: text(data.sourceCode) ?? text(data.from) ?? text(boarding.code) ?? text(boarding.stationCode),
    sourceName: text(data.sourceName) ?? text(boarding.name) ?? text(boarding.stationName),
    destinationCode: text(data.destinationCode) ?? text(data.to) ?? text(destination.code) ?? text(destination.stationCode),
    destinationName: text(data.destinationName) ?? text(destination.name) ?? text(destination.stationName),
    providerStatus: currentStatus ?? text(data.status) ?? text(data.chartStatus),
    coach: text(data.coach) ?? coachSeat?.[1],
    seat: text(data.seat) ?? text(data.berth) ?? coachSeat?.[2],
  });
}

export async function lookupPnr(pnr: string) {
  const providerTemplate = process.env.PNR_PROVIDER_URL;
  if (!providerTemplate) throw new ApiError(503, "PNR sync is not configured.", "PNR_PROVIDER_NOT_CONFIGURED");

  const rawUrl = providerTemplate.includes("{pnr}") ? providerTemplate.replace("{pnr}", pnr) : providerTemplate;
  const url = await validateExternalUrl(rawUrl);
  if (!providerTemplate.includes("{pnr}")) url.searchParams.set("pnr", pnr);
  const apiKey = process.env.PNR_PROVIDER_API_KEY;
  const response = await fetchExternal(url, {
    headers: {
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey } : {}),
    },
  });
  if (!response.ok) throw new ApiError(502, "The PNR provider did not accept the request.", "PNR_PROVIDER_FAILED");

  try {
    return normalizePnrPayload(JSON.parse(await limitedResponseText(response)));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "The PNR provider returned an unsupported response.", "PNR_PROVIDER_INVALID_RESPONSE");
  }
}
