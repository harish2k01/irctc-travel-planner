import { dateInTimeZone, todayInTimeZone } from "@/lib/dates";
import type { Ticket } from "@/lib/types";

export function dateLabel(value: string, year = false) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
export function bookingLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date(value)) + " IST";
}
export const bookingDay = (trip: Ticket) => dateInTimeZone(trip.bookingOpensAt);
export const routeLabel = (trip: Ticket) => `${trip.sourceName || trip.sourceCode} to ${trip.destinationName || trip.destinationCode}`;
export function tripState(trip: Ticket) {
  if (trip.travelDate < todayInTimeZone() || trip.status === "ARCHIVED") return { label: "History", tone: "neutral" };
  if (trip.status === "BOOKED") return { label: "Booked", tone: "success" };
  if (new Date(trip.bookingOpensAt) <= new Date()) return { label: "Window open", tone: "attention" };
  return { label: "To book", tone: "neutral" };
}
export const CHANNELS = [
  { key: "email", field: "reminderEmailEnabled", defaultField: "defaultEmail", label: "Email" },
  { key: "discord", field: "reminderDiscordEnabled", defaultField: "defaultDiscord", label: "Discord" },
  { key: "inApp", field: "reminderInAppEnabled", defaultField: "defaultInApp", label: "In-app" },
] as const;
