import { randomUUID } from "crypto";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { lookupPnr } from "@/lib/pnr-provider";
import { getAppSettings } from "@/lib/settings";
import { ticketBookingInstant } from "@/lib/tickets";

export async function syncTicketPnr(ticketId: string, userId: string) {
  const ticket = await prisma.ticketPlan.findFirst({ where: { id: ticketId, userId } });
  const pnr = decryptSecret(ticket?.pnrEncrypted);
  if (!ticket || !pnr) return null;

  const result = await lookupPnr(pnr);
  const settings = await getAppSettings();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
  const travelDate = result.travelDate ?? ticket.travelDate.toISOString().slice(0, 10);
  const bookingOpensAt = result.travelDate
    ? ticketBookingInstant({
        travelDate,
        bookingWindowDays: settings.bookingWindowDays,
        bookingOpenHour: settings.bookingOpenHour,
        bookingOpenMinute: settings.bookingOpenMinute,
        timeZone: user.timeZone,
      })
    : ticket.bookingOpensAt;
  const nextSyncAt = settings.pnrAutoSyncEnabled
    ? new Date(Date.now() + settings.pnrSyncIntervalMinutes * 60_000)
    : null;

  await prisma.$transaction([
    prisma.ticketPlan.update({
      where: { id: ticket.id },
      data: {
        sourceCode: result.sourceCode ?? ticket.sourceCode,
        sourceName: result.sourceName ?? ticket.sourceName,
        destinationCode: result.destinationCode ?? ticket.destinationCode,
        destinationName: result.destinationName ?? ticket.destinationName,
        travelDate: result.travelDate ? new Date(`${result.travelDate}T00:00:00.000Z`) : ticket.travelDate,
        bookingOpensAt,
        status: "BOOKED",
        pnrEncrypted: isEncrypted(ticket.pnrEncrypted) ? ticket.pnrEncrypted : encryptSecret(pnr),
        pnrLast4: pnr.slice(-4),
        version: { increment: 1 },
      },
    }),
    prisma.pnrSnapshot.upsert({
      where: { ticketId: ticket.id },
      update: {
        provider: "configured-provider",
        trainNumber: result.trainNumber,
        trainName: result.trainName,
        bookedClass: result.bookedClass,
        providerStatus: result.providerStatus,
        coach: result.coach,
        seat: result.seat,
        syncedAt: new Date(),
        nextSyncAt,
      },
      create: {
        id: randomUUID(),
        ticketId: ticket.id,
        provider: "configured-provider",
        trainNumber: result.trainNumber,
        trainName: result.trainName,
        bookedClass: result.bookedClass,
        providerStatus: result.providerStatus,
        coach: result.coach,
        seat: result.seat,
        nextSyncAt,
      },
    }),
    prisma.reminderSchedule.updateMany({
      where: { ticketId: ticket.id, processedAt: null },
      data: { processedAt: new Date() },
    }),
  ]);
  return result;
}

export async function syncDuePnrs() {
  const settings = await getAppSettings();
  if (!settings.pnrAutoSyncEnabled || !process.env.PNR_PROVIDER_URL) return { attempted: 0, synced: 0 };
  const snapshots = await prisma.pnrSnapshot.findMany({
    where: { nextSyncAt: { lte: new Date() }, ticket: { pnrEncrypted: { not: null }, status: "BOOKED" } },
    include: { ticket: true },
    take: 25,
  });
  let synced = 0;
  for (const snapshot of snapshots) {
    try {
      await syncTicketPnr(snapshot.ticketId, snapshot.ticket.userId);
      synced += 1;
    } catch {
      await prisma.pnrSnapshot.update({
        where: { id: snapshot.id },
        data: { nextSyncAt: new Date(Date.now() + settings.pnrSyncIntervalMinutes * 60_000) },
      });
    }
  }
  return { attempted: snapshots.length, synced };
}
