import { dateInTimeZone, daysBetween, todayInTimeZone } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { Holiday, Ticket } from "@/lib/types";

export type TravelSuggestion = { id: string; title: string; detail: string; tone: "amber" | "green" | "blue"; ticketId?: string };

export function buildTravelSuggestions(tickets: Ticket[], holidays: Holiday[], timeZone: string, weekendDays = [0, 6]) {
  const today = todayInTimeZone(timeZone);
  const suggestions: TravelSuggestion[] = [];
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]));

  for (const ticket of tickets.filter((item) => item.status === "PLANNED")) {
    const route = `${ticket.sourceCode} to ${ticket.destinationCode}`;
    const bookingDate = dateInTimeZone(ticket.bookingOpensAt, timeZone);
    const days = daysBetween(today, bookingDate);
    if (days >= 0 && days <= 14) suggestions.push({
      id: `window:${ticket.id}`,
      title: days === 0 ? "Booking opens today" : "Booking window coming up",
      detail: `${route} for travel on ${formatDate(ticket.travelDate)} opens on ${formatDate(bookingDate)}.`,
      tone: days <= 2 ? "amber" : "blue",
      ticketId: ticket.id,
    });

    const bookingWeekday = new Date(`${bookingDate}T12:00:00.000Z`).getUTCDay();
    if (weekendDays.includes(bookingWeekday)) suggestions.push({
      id: `weekend:${ticket.id}`,
      title: "Booking opens on a leave day",
      detail: `${route} opens on ${formatDate(bookingDate)}, which is one of your default leave days.`,
      tone: "amber",
      ticketId: ticket.id,
    });

    for (let offset = -2; offset <= 2; offset += 1) {
      const nearby = new Date(`${ticket.travelDate}T12:00:00.000Z`);
      nearby.setUTCDate(nearby.getUTCDate() + offset);
      const holiday = holidayByDate.get(nearby.toISOString().slice(0, 10));
      if (holiday) suggestions.push({
        id: `travel-leave:${ticket.id}:${holiday.id}`,
        title: offset === 0 ? "Travel overlaps leave" : "Travel is near planned leave",
        detail: `${route} on ${formatDate(ticket.travelDate)} is ${offset === 0 ? "on" : "within two days of"} ${holiday.name}.`,
        tone: offset === 0 ? "amber" : "green",
        ticketId: ticket.id,
      });
    }

    if (!ticket.reminderEmailEnabled && !ticket.reminderDiscordEnabled && !ticket.reminderInAppEnabled) suggestions.push({
      id: `no-reminders:${ticket.id}`,
      title: "No booking reminder enabled",
      detail: `${route} for ${formatDate(ticket.travelDate)} has no active reminder channel.`,
      tone: "amber",
      ticketId: ticket.id,
    });
  }

  for (const holiday of holidays) {
    const weekday = new Date(`${holiday.date}T12:00:00.000Z`).getUTCDay();
    if (weekday === 1 || weekday === 5) suggestions.push({
      id: `long-weekend:${holiday.id}`,
      title: weekday === 1 ? "Monday long weekend" : "Friday long weekend",
      detail: `${holiday.name} on ${formatDate(holiday.date)} extends your Saturday-Sunday leave block.`,
      tone: "green",
    });
  }

  const bookingGroups = new Map<string, Ticket[]>();
  for (const ticket of tickets.filter((item) => item.status === "PLANNED")) {
    const date = dateInTimeZone(ticket.bookingOpensAt, timeZone);
    bookingGroups.set(date, [...(bookingGroups.get(date) ?? []), ticket]);
  }
  for (const [date, group] of bookingGroups) {
    if (group.length > 1) suggestions.push({
      id: `booking-clash:${date}`,
      title: "Multiple bookings open together",
      detail: `${group.length} ticket plans open on ${formatDate(date)}. Prioritize them before the booking window starts.`,
      tone: "amber",
      ticketId: group[0].id,
    });
  }

  return Array.from(new Map(suggestions.map((item) => [item.id, item])).values()).slice(0, 30);
}
