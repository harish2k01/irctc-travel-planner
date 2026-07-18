import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { bookingOpenInstant, reminderInstants, toDateOnly } from "@/lib/dates";
import type { Ticket } from "@/lib/types";

export type TicketWithSnapshot = Prisma.TicketPlanGetPayload<{ include: { pnrSnapshot: true } }>;

export function serializeTicket(ticket: TicketWithSnapshot): Ticket {
  return {
    id: ticket.id,
    sourceCode: ticket.sourceCode,
    sourceName: ticket.sourceName ?? undefined,
    destinationCode: ticket.destinationCode,
    destinationName: ticket.destinationName ?? undefined,
    travelDate: toDateOnly(ticket.travelDate),
    bookingOpensAt: ticket.bookingOpensAt.toISOString(),
    status: ticket.status,
    notes: ticket.notes ?? undefined,
    pnrTagged: Boolean(ticket.pnrEncrypted),
    pnrLast4: ticket.pnrLast4 ?? undefined,
    remindersEnabled: ticket.remindersEnabled,
    reminderEmailEnabled: ticket.reminderEmailEnabled,
    reminderDiscordEnabled: ticket.reminderDiscordEnabled,
    reminderInAppEnabled: ticket.reminderInAppEnabled,
    version: ticket.version,
    pnrSnapshot: ticket.pnrSnapshot ? {
      trainNumber: ticket.pnrSnapshot.trainNumber ?? undefined,
      trainName: ticket.pnrSnapshot.trainName ?? undefined,
      bookedClass: ticket.pnrSnapshot.bookedClass ?? undefined,
      providerStatus: ticket.pnrSnapshot.providerStatus ?? undefined,
      coach: ticket.pnrSnapshot.coach ?? undefined,
      seat: ticket.pnrSnapshot.seat ?? undefined,
      syncedAt: ticket.pnrSnapshot.syncedAt.toISOString(),
    } : undefined,
  };
}

export function ticketBookingInstant(input: {
  travelDate: string;
  bookingWindowDays: number;
  bookingOpenHour: number;
  bookingOpenMinute: number;
  timeZone: string;
}) {
  return bookingOpenInstant(
    input.travelDate,
    input.bookingWindowDays,
    input.bookingOpenHour,
    input.bookingOpenMinute,
    input.timeZone,
  );
}

export async function syncReminderSchedules(
  tx: Prisma.TransactionClient,
  ticket: {
    id: string;
    bookingOpensAt: Date;
    remindersEnabled: boolean;
    reminderEmailEnabled: boolean;
    reminderDiscordEnabled: boolean;
    reminderInAppEnabled: boolean;
    status: "PLANNED" | "BOOKED" | "ARCHIVED";
  },
  settings: {
    reminderSevenDaysEnabled: boolean;
    reminderOneDayEnabled: boolean;
    reminderBookingOpenEnabled: boolean;
  },
) {
  const enabledChannel = ticket.reminderEmailEnabled || ticket.reminderDiscordEnabled || ticket.reminderInAppEnabled;
  if (ticket.status !== "PLANNED" || !ticket.remindersEnabled || !enabledChannel) {
    await tx.reminderSchedule.updateMany({
      where: { ticketId: ticket.id, processedAt: null },
      data: { processedAt: new Date() },
    });
    return;
  }

  const times = reminderInstants(ticket.bookingOpensAt);
  const enabled = [
    ["SEVEN_DAYS_BEFORE", settings.reminderSevenDaysEnabled],
    ["ONE_DAY_BEFORE", settings.reminderOneDayEnabled],
    ["BOOKING_OPEN", settings.reminderBookingOpenEnabled],
  ] as const;

  const disabledTypes = enabled.filter(([, value]) => !value).map(([type]) => type);
  if (disabledTypes.length) {
    await tx.reminderSchedule.updateMany({
      where: { ticketId: ticket.id, type: { in: disabledTypes }, processedAt: null },
      data: { processedAt: new Date() },
    });
  }

  for (const [type, isEnabled] of enabled) {
    if (!isEnabled) continue;
    await tx.reminderSchedule.upsert({
      where: { ticketId_type: { ticketId: ticket.id, type } },
      update: { dueAt: times[type], processedAt: null },
      create: { id: randomUUID(), ticketId: ticket.id, type, dueAt: times[type] },
    });
  }
}
