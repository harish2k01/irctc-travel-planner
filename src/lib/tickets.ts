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
    journeyGroupId: ticket.journeyGroupId ?? undefined,
    pnrLastError: ticket.pnrLastError ?? undefined,
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
    "Asia/Kolkata",
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
  const now = new Date();
  const active = await tx.reminderSchedule.findMany({ where: { ticketId: ticket.id, cancelledAt: null } });
  const times = reminderInstants(ticket.bookingOpensAt);
  const enabledChannel = ticket.reminderEmailEnabled || ticket.reminderDiscordEnabled || ticket.reminderInAppEnabled;
  // Channel/notes edits must not resend an opening notification already delivered.
  if (ticket.status === "PLANNED" && ticket.remindersEnabled && enabledChannel && active.length
    && active.every((schedule) => schedule.dueAt.getTime() === times[schedule.type].getTime())) {
    const disabled = [!ticket.reminderEmailEnabled && "EMAIL", !ticket.reminderDiscordEnabled && "DISCORD", !ticket.reminderInAppEnabled && "IN_APP"].filter(Boolean) as ("EMAIL" | "DISCORD" | "IN_APP")[];
    await tx.reminderDelivery.updateMany({
      where: { schedule: { ticketId: ticket.id }, channel: { in: disabled }, status: { in: ["PENDING", "FAILED", "SENDING"] } },
      data: { status: "CANCELLED", nextAttemptAt: null, leaseToken: null, leaseExpiresAt: null },
    });
    return;
  }
  await tx.reminderSchedule.updateMany({
    where: { ticketId: ticket.id, cancelledAt: null },
    data: { cancelledAt: now, processedAt: now },
  });
  await tx.reminderDelivery.updateMany({
    where: { schedule: { ticketId: ticket.id }, status: { in: ["PENDING", "FAILED", "SENDING"] } },
    data: { status: "CANCELLED", nextAttemptAt: null, leaseToken: null, leaseExpiresAt: null },
  });
  const { scheduleRevision } = await tx.ticketPlan.update({
    where: { id: ticket.id }, data: { scheduleRevision: { increment: 1 } },
    select: { scheduleRevision: true },
  });
  if (ticket.status !== "PLANNED" || !ticket.remindersEnabled || !enabledChannel) {
    await tx.reminderSchedule.updateMany({
      where: { ticketId: ticket.id, processedAt: null },
      data: { processedAt: new Date() },
    });
    return;
  }

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
    await tx.reminderSchedule.create({
      data: { id: randomUUID(), ticketId: ticket.id, revision: scheduleRevision, type, dueAt: times[type] },
    });
  }
}
