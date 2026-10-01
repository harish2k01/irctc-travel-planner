import { isDay, type Journey } from "./travel-planner";

export type TicketDetails = Partial<Pick<Journey, "from" | "to" | "date" | "trainNumber" | "trainName" | "travelClass" | "pnr" | "coach" | "seat" | "berth" | "departure">>;
export function parseTicketDetails(raw: string): TicketDetails {
  const text = raw.replace(/\r/g, ""); const details: TicketDetails = {};
  let json: Record<string, unknown> | undefined;
  try { const value = JSON.parse(text); if (value && typeof value === "object" && !Array.isArray(value)) json = value; } catch { /* A QR may contain plain ticket text. */ }
  if (json) {
    const aliases: Record<keyof TicketDetails, string[]> = { from: ["from", "source", "boardingStation"], to: ["to", "destination"], date: ["date", "journeyDate", "travelDate"], trainNumber: ["trainNumber", "trainNo", "train_no"], trainName: ["trainName", "train_name"], travelClass: ["travelClass", "class"], pnr: ["pnr", "PNR"], coach: ["coach", "coachNumber"], seat: ["seat", "seatNumber", "seatNo"], berth: ["berth", "berthType"], departure: ["departure", "departureTime"] };
    for (const [key, keys] of Object.entries(aliases)) { const value = keys.map(k => json![k]).find(v => typeof v === "string" || typeof v === "number"); if (value !== undefined) (details as Record<string, string>)[key] = String(value).trim(); }
  } else {
    const match = (pattern: RegExp) => text.match(pattern)?.[1]?.trim();
    details.pnr = match(/\bPNR(?:\s*(?:No\.?|Number))?\s*[:#\-]?\s*(\d{10})\b/i);
    details.trainNumber = match(/\bTrain\s*(?:No\.?|Number)(?:\s*\/\s*Name)?\s*[:#\-]?\s*(\d{5})\b/i);
    details.trainName = match(/\bTrain\s*Name\s*[:\-]\s*([^\n]+)/i) ?? match(/\bTrain\s*(?:No\.?|Number)\s*\/\s*Name\s*[:\-]?\s*\d{5}\s*\/\s*([^\n]+)/i);
    details.travelClass = match(/\bClass\s*[:\-]\s*(1A|2A|3A|3E|SL|CC|EC|2S)\b/i)?.toUpperCase();
    details.date = match(/\b(?:Date of Journey|Journey Date|Travel Date|Boarding Date)\s*[:\-]\s*(\d{4}-\d{2}-\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    details.from = match(/(?:^|\n)\s*(?:From|Boarding Station)\s*[:\-]\s*([^\n]+)/i);
    details.to = match(/(?:^|\n)\s*(?:To|Destination)\s*[:\-]\s*([^\n]+)/i);
    details.coach = match(/\bCoach(?:\s*(?:No\.?|Number))?\s*[:\-]\s*([A-Z0-9-]{1,10})\b/i);
    details.seat = match(/\b(?:Seat|Berth)(?:\s*(?:No\.?|Number))\s*[:\-]\s*(\d{1,3}(?:\s*[,/]\s*\d{1,3})*)/i);
    details.berth = match(/\bBerth(?:\s*Type)?\s*[:\-]\s*(Lower|Middle|Upper|Side Lower|Side Upper|LB|MB|UB|SL|SU|Chair)\b/i);
    details.departure = match(/\b(?:Departure(?: Time)?|Boarding Time)\s*[:\-]\s*((?:[01]\d|2[0-3]):[0-5]\d)/i);
    // Many tickets print passenger rows rather than labelled coach/seat fields.
    const allocation = text.match(/\bCNF\s*\/\s*([A-Z]\d{1,2})\s*\/\s*(\d{1,3})\s*\/\s*(LB|MB|UB|SL|SU)\b/i);
    if (allocation) { details.coach ??= allocation[1]; details.seat ??= allocation[2]; details.berth ??= allocation[3]; }
  }
  if (details.date && /^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(details.date)) { const [day, month, year] = details.date.split(/[-\/]/); details.date = `${year}-${month}-${day}`; }
  if (details.date && !isDay(details.date)) delete details.date;
  if (details.pnr && !/^\d{10}$/.test(details.pnr)) delete details.pnr;
  if (details.trainNumber && !/^\d{5}$/.test(details.trainNumber)) delete details.trainNumber;
  if (details.departure && !/^([01]\d|2[0-3]):[0-5]\d$/.test(details.departure)) delete details.departure;
  for (const key of Object.keys(details) as (keyof TicketDetails)[]) if (!details[key]) delete details[key];
  return details;
}
