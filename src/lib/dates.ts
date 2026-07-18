import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export function toDateOnly(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateBookingOpenDate(travelDate: string, bookingWindowDays = 60) {
  return addDays(travelDate, -bookingWindowDays);
}

export function bookingOpenInstant(
  travelDate: string,
  bookingWindowDays = 60,
  hour = 8,
  minute = 0,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const bookingDate = calculateBookingOpenDate(travelDate, bookingWindowDays);
  const local = `${bookingDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  return fromZonedTime(local, timeZone);
}

export function reminderInstants(bookingOpensAt: Date) {
  return {
    SEVEN_DAYS_BEFORE: new Date(bookingOpensAt.getTime() - 7 * 24 * 60 * 60 * 1000),
    ONE_DAY_BEFORE: new Date(bookingOpensAt.getTime() - 24 * 60 * 60 * 1000),
    BOOKING_OPEN: bookingOpensAt,
  } as const;
}

export function todayInTimeZone(timeZone = DEFAULT_TIME_ZONE) {
  return formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
}

export function dateInTimeZone(value: Date | string, timeZone = DEFAULT_TIME_ZONE) {
  return formatInTimeZone(new Date(value), timeZone, "yyyy-MM-dd");
}

export function daysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T12:00:00.000Z`).getTime();
  const to = new Date(`${toDate}T12:00:00.000Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function isWithinNextDays(dateOnly: string, today: string, days: number) {
  const delta = daysBetween(today, dateOnly);
  return delta >= 0 && delta <= days;
}

export function ticketUrgency(bookingOpensAt: string, status: "PLANNED" | "BOOKED" | "ARCHIVED", timeZone = DEFAULT_TIME_ZONE) {
  if (status === "BOOKED") return { label: "Booked", tone: "green" as const, daysUntilOpen: 0 };
  if (status === "ARCHIVED") return { label: "Archived", tone: "slate" as const, daysUntilOpen: 0 };
  const daysUntilOpen = daysBetween(todayInTimeZone(timeZone), dateInTimeZone(bookingOpensAt, timeZone));
  if (daysUntilOpen <= 0) return { label: "Book now", tone: "red" as const, daysUntilOpen };
  if (daysUntilOpen === 1) return { label: "Opens tomorrow", tone: "amber" as const, daysUntilOpen };
  if (daysUntilOpen <= 7) return { label: "Opening soon", tone: "amber" as const, daysUntilOpen };
  return { label: "Planned", tone: "slate" as const, daysUntilOpen };
}
