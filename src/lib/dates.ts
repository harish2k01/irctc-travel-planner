import type { Journey, Reminder } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(input: Date | string): string {
  const date = typeof input === "string" ? new Date(`${input}T12:00:00.000Z`) : input;
  return date.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

export function calculateBookingOpenDate(travelDate: string): string {
  return addDays(travelDate, -60);
}

export function calculateReminderDates(bookingOpenDate: string) {
  return {
    sevenDaysBefore: addDays(bookingOpenDate, -7),
    oneDayBefore: addDays(bookingOpenDate, -1),
    bookingOpen: bookingOpenDate,
  };
}

export function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDate}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / DAY_MS);
}

export function buildJourneyReminders(journey: Journey): Reminder[] {
  const reminderDates = calculateReminderDates(journey.bookingOpenDate);
  const routeLabel = [journey.sourceCode, journey.destinationCode].filter(Boolean).join(" to ");
  const ticketLabel = routeLabel || "this ticket";

  return [
    {
      id: `${journey.id}-r7`,
      journeyId: journey.id,
      type: "SEVEN_DAYS_BEFORE",
      dueDate: reminderDates.sevenDaysBefore,
      message: `Booking opens in 7 days for ${ticketLabel}.`,
    },
    {
      id: `${journey.id}-r1`,
      journeyId: journey.id,
      type: "ONE_DAY_BEFORE",
      dueDate: reminderDates.oneDayBefore,
      message: `Booking opens tomorrow for ${ticketLabel}.`,
    },
    {
      id: `${journey.id}-r0`,
      journeyId: journey.id,
      type: "BOOKING_OPEN",
      dueDate: reminderDates.bookingOpen,
      message: `Booking opens today for ${ticketLabel}.`,
    },
  ];
}

export function getBookingUrgency(journey: Journey, today = toDateOnly(new Date())) {
  const daysUntilOpen = daysBetween(today, journey.bookingOpenDate);

  if (journey.pnr || journey.status === "CONFIRMED" || journey.status === "BOOKED") {
    return { label: "Booked", tone: "green", daysUntilOpen };
  }

  if (daysUntilOpen <= 0) {
    return { label: "Book Today", tone: "red", daysUntilOpen };
  }

  if (daysUntilOpen === 1) {
    return { label: "Opens Tomorrow", tone: "amber", daysUntilOpen };
  }

  if (daysUntilOpen <= 7) {
    return { label: "Opening Soon", tone: "amber", daysUntilOpen };
  }

  return { label: "Planned", tone: "slate", daysUntilOpen };
}

export function isWithinNextDays(dateOnly: string, today: string, days: number) {
  const delta = daysBetween(today, dateOnly);
  return delta >= 0 && delta <= days;
}
